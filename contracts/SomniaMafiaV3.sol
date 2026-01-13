// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MafiaPortal V3 - Optimized
 * @notice Optimizations:
 *   1. Batch Share Keys - one tx instead of N×(N-1)
 *   2. Auto-Finalize - no separate finalize transactions
 *   3. Join + Session Key - register session on join
 *   4. Gas-optimized structures
 */
contract MafiaPortalV3 {
    // ============ ENUMS ============
    enum GamePhase { LOBBY, SHUFFLING, REVEAL, DAY, VOTING, NIGHT, ENDED }
    enum NightActionType { NONE, KILL, HEAL, CHECK }

    // ============ OPTIMIZED STRUCTURES ============
    struct Player {
        address wallet;
        string nickname;
        bytes publicKey;          // bytes instead of string - gas saving
        uint32 flags;             // packed: bit0=hasConfirmedRole, bit1=isActive, bit2=hasVoted, bit3=hasCommitted, bit4=hasRevealed
    }

    struct GameRoom {
        uint64 id;
        address host;
        GamePhase phase;
        uint8 maxPlayers;
        uint8 playersCount;
        uint8 aliveCount;         // track alive separately for faster win check
        uint16 dayCount;
        uint8 currentShufflerIndex;
        uint32 lastActionTimestamp;
        
        // Auto-finalize counters
        uint8 confirmedCount;     // for REVEAL phase
        uint8 votedCount;         // for VOTING phase  
        uint8 committedCount;     // for NIGHT phase
        uint8 revealedCount;      // for NIGHT phase
    }

    struct SessionKey {
        address sessionAddress;
        uint32 expiresAt;         // uint32 enough for timestamps until 2106
        uint64 roomId;
        bool isActive;
    }

    struct NightCommit {
        bytes32 commitHash;
        bool revealed;
    }

    // ============ STATE ============
    mapping(uint256 => GameRoom) public rooms;
    mapping(uint256 => Player[]) public roomPlayers;
    mapping(uint256 => mapping(address => bool)) public isPlayerInRoom;
    mapping(uint256 => mapping(address => uint8)) public playerIndex; // address => index for O(1) lookup
    mapping(uint256 => string[]) public roomDeck;
    
    // Batch keys: roomId => player => encrypted deck key for that player
    mapping(uint256 => mapping(address => bytes)) public playerDeckKeys;
    
    // Voting
    mapping(uint256 => mapping(address => address)) public votes;
    mapping(uint256 => mapping(address => uint8)) public voteCounts;

    // Night
    mapping(uint256 => mapping(address => NightCommit)) public nightCommits;
    mapping(uint256 => mapping(address => NightActionType)) public revealedActions;
    mapping(uint256 => mapping(address => address)) public revealedTargets;

    // Session Keys
    mapping(address => SessionKey) public sessionKeys;
    mapping(address => address) public sessionToMain;

    uint256 public nextRoomId = 1;
    
    // Constants - using uint32 for gas
    uint32 public constant TURN_TIMEOUT = 2 minutes;
    uint32 public constant SESSION_DURATION = 4 hours;
    uint256 public constant DEFAULT_SESSION_FUND = 0.02 ether;

    // Player flags
    uint32 constant FLAG_CONFIRMED_ROLE = 1;
    uint32 constant FLAG_ACTIVE = 2;
    uint32 constant FLAG_HAS_VOTED = 4;
    uint32 constant FLAG_HAS_COMMITTED = 8;
    uint32 constant FLAG_HAS_REVEALED = 16;

    // ============ EVENTS ============
    event RoomCreated(uint256 indexed roomId, address host, uint256 maxPlayers);
    event PlayerJoined(uint256 indexed roomId, address player, string nickname, address sessionKey);
    event GameStarted(uint256 indexed roomId);
    event DeckSubmitted(uint256 indexed roomId, address byPlayer, uint256 nextIndex);
    event PlayerKicked(uint256 indexed roomId, address player, string reason);
    
    // Batch events
    event KeysSharedToAll(uint256 indexed roomId, address from);
    event RoleConfirmed(uint256 indexed roomId, address player);
    event AllRolesConfirmed(uint256 indexed roomId); // Auto-transition to DAY
    
    event DayStarted(uint256 indexed roomId, uint256 dayNumber);
    event VotingStarted(uint256 indexed roomId);
    event VoteCast(uint256 indexed roomId, address voter, address target);
    event VotingFinalized(uint256 indexed roomId, address eliminated, uint256 voteCount);
    
    event NightStarted(uint256 indexed roomId);
    event NightActionCommitted(uint256 indexed roomId, address player);
    event NightActionRevealed(uint256 indexed roomId, address player, NightActionType action);
    event NightFinalized(uint256 indexed roomId, address killed, address healed);
    
    event PlayerEliminated(uint256 indexed roomId, address player, string reason);
    event GameEnded(uint256 indexed roomId, string winCondition);

    event SessionKeyRegistered(address indexed mainWallet, address indexed sessionKey, uint256 roomId, uint256 expiresAt);
    event SessionKeyRevoked(address indexed mainWallet, address indexed sessionKey);

    // ============ ERRORS ============
    error NotParticipant();
    error NotYourTurn();
    error WrongPhase();
    error Unauthorized();
    error RoomFull();
    error AlreadyJoined();
    error InvalidDeckSize();
    error TimeNotExpired();
    error PlayerInactive();
    error NoStalledPlayers();
    error InvalidReveal();
    error AlreadyRevealed();
    error AlreadyVoted();
    error AlreadyCommitted();
    error SessionExpired();
    error SessionNotForThisRoom();
    error InvalidSessionKey();
    error InvalidArrayLength();

    // ============ MODIFIERS ============
    
    modifier onlyActiveParticipant(uint256 roomId) {
        address player = _resolvePlayer(roomId);
        if (!isPlayerInRoom[roomId][player]) revert NotParticipant();
        if (!_hasFlag(roomId, player, FLAG_ACTIVE)) revert PlayerInactive();
        _;
    }

    // ============ SESSION KEY LOGIC ============

    function _resolvePlayer(uint256 roomId) internal view returns (address) {
        address potentialMain = sessionToMain[msg.sender];
        
        if (potentialMain != address(0)) {
            SessionKey storage session = sessionKeys[potentialMain];
            if (!session.isActive) revert InvalidSessionKey();
            if (block.timestamp > session.expiresAt) revert SessionExpired();
            if (session.roomId != roomId) revert SessionNotForThisRoom();
            return potentialMain;
        }
        
        return msg.sender;
    }

    function _registerSessionKey(address mainWallet, address sessionAddress, uint256 roomId) internal {
        // Revoke old session if exists
        if (sessionKeys[mainWallet].isActive) {
            address oldSession = sessionKeys[mainWallet].sessionAddress;
            delete sessionToMain[oldSession];
        }

        uint32 expiresAt = uint32(block.timestamp + SESSION_DURATION);
        
        sessionKeys[mainWallet] = SessionKey({
            sessionAddress: sessionAddress,
            expiresAt: expiresAt,
            roomId: uint64(roomId),
            isActive: true
        });
        
        sessionToMain[sessionAddress] = mainWallet;
        
        emit SessionKeyRegistered(mainWallet, sessionAddress, roomId, expiresAt);
    }

    /**
     * @notice Revoke your session key (logout)
     */
    function revokeSessionKey() external {
        SessionKey storage session = sessionKeys[msg.sender];
        if (session.isActive) {
            emit SessionKeyRevoked(msg.sender, session.sessionAddress);
            delete sessionToMain[session.sessionAddress];
            session.isActive = false;
        }
    }

    function isSessionValid(address mainWallet, uint256 roomId) external view returns (bool) {
        SessionKey storage session = sessionKeys[mainWallet];
        return session.isActive && 
               block.timestamp <= session.expiresAt && 
               session.roomId == roomId;
    }

    function getSessionKey(address mainWallet) external view returns (
        address sessionAddress,
        uint256 expiresAt,
        uint256 roomId,
        bool isActive
    ) {
        SessionKey storage session = sessionKeys[mainWallet];
        return (session.sessionAddress, session.expiresAt, session.roomId, session.isActive);
    }

    // ============ FLAG HELPERS ============

    function _hasFlag(uint256 roomId, address wallet, uint32 flag) internal view returns (bool) {
        uint8 idx = playerIndex[roomId][wallet];
        return (roomPlayers[roomId][idx].flags & flag) != 0;
    }

    function _setFlag(uint256 roomId, address wallet, uint32 flag) internal {
        uint8 idx = playerIndex[roomId][wallet];
        roomPlayers[roomId][idx].flags |= flag;
    }

    function _clearFlag(uint256 roomId, address wallet, uint32 flag) internal {
        uint8 idx = playerIndex[roomId][wallet];
        roomPlayers[roomId][idx].flags &= ~flag;
    }

    // ============ LOBBY - JOIN WITH SESSION KEY ============

    function createRoom(uint8 maxPlayers) external returns (uint256) {
        uint256 roomId = nextRoomId++;
        
        rooms[roomId] = GameRoom({
            id: uint64(roomId),
            host: msg.sender,
            phase: GamePhase.LOBBY,
            maxPlayers: maxPlayers,
            playersCount: 0,
            aliveCount: 0,
            dayCount: 0,
            currentShufflerIndex: 0,
            lastActionTimestamp: uint32(block.timestamp),
            confirmedCount: 0,
            votedCount: 0,
            committedCount: 0,
            revealedCount: 0
        });
        
        emit RoomCreated(roomId, msg.sender, maxPlayers);
        return roomId;
    }

    /**
     * @notice Join room AND register session key in ONE transaction
     * @param roomId Room to join
     * @param nickname Player display name
     * @param publicKey Player's public key for encryption
     * @param sessionAddress Session key address (generated client-side)
     * @dev If msg.value > 0, it's forwarded to session key for gas
     */
    function joinRoom(
        uint256 roomId, 
        string calldata nickname, 
        bytes calldata publicKey,
        address sessionAddress
    ) external payable {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.LOBBY) revert WrongPhase();
        if (room.playersCount >= room.maxPlayers) revert RoomFull();
        if (isPlayerInRoom[roomId][msg.sender]) revert AlreadyJoined();

        // Add player
        uint8 idx = uint8(roomPlayers[roomId].length);
        roomPlayers[roomId].push(Player({
            wallet: msg.sender,
            nickname: nickname,
            publicKey: publicKey,
            flags: FLAG_ACTIVE  // active by default
        }));
        
        isPlayerInRoom[roomId][msg.sender] = true;
        playerIndex[roomId][msg.sender] = idx;
        room.playersCount++;
        room.aliveCount++;

        // Register session key if provided
        if (sessionAddress != address(0)) {
            _registerSessionKey(msg.sender, sessionAddress, roomId);
            
            // Forward ETH to session key for gas
            if (msg.value > 0) {
                (bool success, ) = payable(sessionAddress).call{value: msg.value}("");
                require(success, "ETH transfer failed");
            }
        }

        emit PlayerJoined(roomId, msg.sender, nickname, sessionAddress);
    }

    /**
     * @notice Register session key separately (if didn't do it on join)
     */
    function registerSessionKey(address sessionAddress, uint256 roomId) external payable {
        require(sessionAddress != address(0), "Invalid session address");
        require(isPlayerInRoom[roomId][msg.sender], "Not in room");
        
        _registerSessionKey(msg.sender, sessionAddress, roomId);
        
        if (msg.value > 0) {
            (bool success, ) = payable(sessionAddress).call{value: msg.value}("");
            require(success, "ETH transfer failed");
        }
    }

    // ============ SHUFFLING ============

    function startGame(uint256 roomId) external {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.LOBBY) revert WrongPhase();
        if (msg.sender != room.host) revert Unauthorized();
        if (room.playersCount < 2) revert("Need at least 2 players");

        room.phase = GamePhase.SHUFFLING;
        room.currentShufflerIndex = 0;
        room.lastActionTimestamp = uint32(block.timestamp);
        
        emit GameStarted(roomId);
    }

    function submitDeck(uint256 roomId, string[] calldata deck) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.SHUFFLING) revert WrongPhase();
        
        if (roomPlayers[roomId][room.currentShufflerIndex].wallet != player) revert NotYourTurn();

        if (roomDeck[roomId].length == 0) {
            if (deck.length < room.playersCount) revert InvalidDeckSize();
        } else {
            if (deck.length != roomDeck[roomId].length) revert InvalidDeckSize();
        }

        roomDeck[roomId] = deck;
        room.currentShufflerIndex = _findNextActive(roomId, room.currentShufflerIndex + 1);
        room.lastActionTimestamp = uint32(block.timestamp);

        emit DeckSubmitted(roomId, player, room.currentShufflerIndex);

        // Auto-transition to REVEAL when all shuffled
        if (room.currentShufflerIndex >= roomPlayers[roomId].length) {
            room.phase = GamePhase.REVEAL;
        }
    }

    function _findNextActive(uint256 roomId, uint8 startIndex) internal view returns (uint8) {
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = startIndex; i < players.length; i++) {
            if ((players[i].flags & FLAG_ACTIVE) != 0) {
                return i;
            }
        }
        return uint8(players.length);
    }

    // ============ REVEAL - BATCH SHARE KEYS ============

    /**
     * @notice Share encrypted deck keys to ALL players in ONE transaction
     * @param roomId Room ID
     * @param recipients Array of player addresses
     * @param encryptedKeys Array of encrypted keys (one per recipient)
     * @dev Arrays must be same length and cover all other active players
     */
    function shareKeysToAll(
        uint256 roomId, 
        address[] calldata recipients, 
        bytes[] calldata encryptedKeys
    ) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        if (rooms[roomId].phase != GamePhase.REVEAL) revert WrongPhase();
        if (recipients.length != encryptedKeys.length) revert InvalidArrayLength();
        
        // Store all keys in one tx
        for (uint256 i = 0; i < recipients.length; i++) {
            address to = recipients[i];
            if (!isPlayerInRoom[roomId][to]) revert NotParticipant();
            playerDeckKeys[roomId][to] = encryptedKeys[i];
        }
        
        emit KeysSharedToAll(roomId, player);
    }

    /**
     * @notice Confirm role after decrypting - with AUTO-FINALIZE
     */
    function confirmRole(uint256 roomId) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.REVEAL) revert WrongPhase();
        
        // Check not already confirmed
        if (_hasFlag(roomId, player, FLAG_CONFIRMED_ROLE)) revert("Already confirmed");
        
        _setFlag(roomId, player, FLAG_CONFIRMED_ROLE);
        room.confirmedCount++;
        
        emit RoleConfirmed(roomId, player);
        
        // AUTO-FINALIZE: Check if all confirmed
        if (room.confirmedCount == room.aliveCount) {
            room.phase = GamePhase.DAY;
            room.dayCount = 1;
            room.lastActionTimestamp = uint32(block.timestamp);
            emit AllRolesConfirmed(roomId);
            emit DayStarted(roomId, 1);
        }
    }

    // ============ DAY & VOTING - AUTO-FINALIZE ============

    function startVoting(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.DAY) revert WrongPhase();
        
        room.phase = GamePhase.VOTING;
        room.votedCount = 0;
        
        // Reset vote flags for all alive players
        for (uint8 i = 0; i < roomPlayers[roomId].length; i++) {
            if ((roomPlayers[roomId][i].flags & FLAG_ACTIVE) != 0) {
                roomPlayers[roomId][i].flags &= ~FLAG_HAS_VOTED;
            }
        }
        
        emit VotingStarted(roomId);
    }

    /**
     * @notice Cast vote - with AUTO-FINALIZE when all voted
     */
    function vote(uint256 roomId, address target) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.VOTING) revert WrongPhase();
        if (!isPlayerInRoom[roomId][target]) revert NotParticipant();
        if (!_hasFlag(roomId, target, FLAG_ACTIVE)) revert PlayerInactive();
        
        bool alreadyVoted = _hasFlag(roomId, player, FLAG_HAS_VOTED);
        
        // Handle vote change
        address oldTarget = votes[roomId][player];
        if (oldTarget != address(0) && voteCounts[roomId][oldTarget] > 0) {
            voteCounts[roomId][oldTarget]--;
        }

        votes[roomId][player] = target;
        voteCounts[roomId][target]++;
        
        // Mark as voted (first vote)
        if (!alreadyVoted) {
            _setFlag(roomId, player, FLAG_HAS_VOTED);
            room.votedCount++;
        }
        
        emit VoteCast(roomId, player, target);
        
        // AUTO-FINALIZE: Check if all alive players voted
        if (room.votedCount == room.aliveCount) {
            _finalizeVoting(roomId);
        }
    }

    function _finalizeVoting(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        
        address victim = address(0);
        uint8 maxVotes = 0;
        
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            if ((players[i].flags & FLAG_ACTIVE) != 0) {
                address p = players[i].wallet;
                uint8 v = voteCounts[roomId][p];
                if (v > maxVotes) {
                    maxVotes = v;
                    victim = p;
                }
            }
        }

        // Quorum: > 50%
        if (maxVotes > room.aliveCount / 2 && victim != address(0)) {
            _killPlayer(roomId, victim);
            emit PlayerEliminated(roomId, victim, "Voted out");
            emit VotingFinalized(roomId, victim, maxVotes);
        } else {
            emit VotingFinalized(roomId, address(0), 0); // No elimination
        }

        _resetVotingState(roomId);

        if (!_checkWinCondition(roomId)) {
            room.phase = GamePhase.NIGHT;
            room.committedCount = 0;
            room.revealedCount = 0;
            emit NightStarted(roomId);
        }
    }

    // ============ NIGHT - AUTO-FINALIZE ============

    /**
     * @notice Commit night action - tracks count for auto-finalize
     */
    function commitNightAction(uint256 roomId, bytes32 hash) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.NIGHT) revert WrongPhase();
        if (_hasFlag(roomId, player, FLAG_HAS_COMMITTED)) revert AlreadyCommitted();
        
        nightCommits[roomId][player] = NightCommit({
            commitHash: hash,
            revealed: false
        });
        
        _setFlag(roomId, player, FLAG_HAS_COMMITTED);
        room.committedCount++;
        
        emit NightActionCommitted(roomId, player);
    }

    /**
     * @notice Reveal night action - with AUTO-FINALIZE when all revealed
     */
    function revealNightAction(
        uint256 roomId, 
        NightActionType action, 
        address target, 
        string calldata salt
    ) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.NIGHT) revert WrongPhase();
        if (_hasFlag(roomId, player, FLAG_HAS_REVEALED)) revert AlreadyRevealed();

        bytes32 calculatedHash = keccak256(abi.encodePacked(action, target, salt));
        if (calculatedHash != nightCommits[roomId][player].commitHash) revert InvalidReveal();

        nightCommits[roomId][player].revealed = true;
        revealedActions[roomId][player] = action;
        revealedTargets[roomId][player] = target;
        
        _setFlag(roomId, player, FLAG_HAS_REVEALED);
        room.revealedCount++;

        emit NightActionRevealed(roomId, player, action);
        
        // AUTO-FINALIZE: Check if all who committed have revealed
        if (room.revealedCount == room.committedCount && room.committedCount > 0) {
            _finalizeNight(roomId);
        }
    }

    function _finalizeNight(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        
        address victim = address(0);
        address healed = address(0);
        
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            address p = players[i].wallet;
            NightActionType action = revealedActions[roomId][p];
            
            if (action == NightActionType.KILL) {
                victim = revealedTargets[roomId][p];
            }
            if (action == NightActionType.HEAL) {
                healed = revealedTargets[roomId][p];
            }
        }

        emit NightFinalized(roomId, victim, healed);

        if (victim != address(0) && victim != healed) {
            _killPlayer(roomId, victim);
            emit PlayerEliminated(roomId, victim, "Killed at night");
        }

        _resetNightState(roomId);

        if (!_checkWinCondition(roomId)) {
            room.phase = GamePhase.DAY;
            room.dayCount++;
            room.lastActionTimestamp = uint32(block.timestamp);
            emit DayStarted(roomId, room.dayCount);
        }
    }

    // ============ HELPERS ============

    function _killPlayer(uint256 roomId, address victim) internal {
        _clearFlag(roomId, victim, FLAG_ACTIVE);
        rooms[roomId].aliveCount--;
    }

    function _resetVotingState(uint256 roomId) internal {
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            address p = players[i].wallet;
            votes[roomId][p] = address(0);
            voteCounts[roomId][p] = 0;
            players[i].flags &= ~FLAG_HAS_VOTED;
        }
        rooms[roomId].votedCount = 0;
    }

    function _resetNightState(uint256 roomId) internal {
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            address p = players[i].wallet;
            delete nightCommits[roomId][p];
            delete revealedActions[roomId][p];
            delete revealedTargets[roomId][p];
            players[i].flags &= ~(FLAG_HAS_COMMITTED | FLAG_HAS_REVEALED);
        }
        rooms[roomId].committedCount = 0;
        rooms[roomId].revealedCount = 0;
    }

    function _checkWinCondition(uint256 roomId) internal returns (bool ended) {
        GameRoom storage room = rooms[roomId];
        
        if (room.aliveCount <= 1) {
            room.phase = GamePhase.ENDED;
            emit GameEnded(roomId, room.aliveCount == 0 ? "Draw" : "Last player standing");
            return true;
        }
        
        // TODO: Add proper mafia vs town win condition
        // (requires tracking roles on-chain or trusting frontend)
        
        return false;
    }

    // ============ VIEW FUNCTIONS ============
    
    function getPlayers(uint256 roomId) external view returns (Player[] memory) {
        return roomPlayers[roomId];
    }
    
    function getDeck(uint256 roomId) external view returns (string[] memory) {
        return roomDeck[roomId];
    }
    
    function getRoom(uint256 roomId) external view returns (GameRoom memory) {
        return rooms[roomId];
    }
    
    function getMyKey(uint256 roomId) external view returns (bytes memory) {
        address player = sessionToMain[msg.sender];
        if (player == address(0)) {
            player = msg.sender;
        }
        return playerDeckKeys[roomId][player];
    }

    function getPlayerFlags(uint256 roomId, address player) external view returns (
        bool isActive,
        bool hasConfirmedRole,
        bool hasVoted,
        bool hasCommitted,
        bool hasRevealed
    ) {
        uint8 idx = playerIndex[roomId][player];
        uint32 flags = roomPlayers[roomId][idx].flags;
        return (
            (flags & FLAG_ACTIVE) != 0,
            (flags & FLAG_CONFIRMED_ROLE) != 0,
            (flags & FLAG_HAS_VOTED) != 0,
            (flags & FLAG_HAS_COMMITTED) != 0,
            (flags & FLAG_HAS_REVEALED) != 0
        );
    }
}
