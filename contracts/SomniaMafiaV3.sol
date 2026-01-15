// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MafiaPortal V3.1 - Security Fixes
 * @notice Fixes:
 *   1. shareKeysToAll - one-time per player, counter tracking
 *   2. Night phase - timeout + default action for AFK
 *   3. VoteCounts - proper reset for alive only
 *   4. _findNextActive - fixed edge case
 *   5. Timeout enforcement for all phases
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
        uint32 flags;             // packed flags: bit0-5 for various states
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
        uint32 phaseDeadline;     // NEW: deadline for current phase
        
        // Auto-finalize counters
        uint8 confirmedCount;     // for REVEAL phase
        uint8 votedCount;         // for VOTING phase  
        uint8 committedCount;     // for NIGHT phase
        uint8 revealedCount;      // for NIGHT phase
        uint8 keysSharedCount;    // NEW: track how many shared keys
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
    
    // FIX: 3D mapping - roomId => from => to => encryptedKey
    // Each sender stores their key for each recipient
    mapping(uint256 => mapping(address => mapping(address => bytes))) public playerDeckKeys;
    
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
    
    // Timeouts
    uint32 public constant TURN_TIMEOUT = 2 minutes;
    uint32 public constant PHASE_TIMEOUT = 5 minutes;    // Max time per phase
    uint32 public constant SESSION_DURATION = 4 hours;
    uint256 public constant DEFAULT_SESSION_FUND = 0.02 ether;

    // Player flags
    uint32 constant FLAG_CONFIRMED_ROLE = 1;
    uint32 constant FLAG_ACTIVE = 2;
    uint32 constant FLAG_HAS_VOTED = 4;
    uint32 constant FLAG_HAS_COMMITTED = 8;
    uint32 constant FLAG_HAS_REVEALED = 16;
    uint32 constant FLAG_HAS_SHARED_KEYS = 32;  // NEW: prevent double key sharing

    // ============ EVENTS ============
    event RoomCreated(uint256 indexed roomId, address host, uint256 maxPlayers);
    event PlayerJoined(uint256 indexed roomId, address player, string nickname, address sessionKey);
    event GameStarted(uint256 indexed roomId);
    event DeckSubmitted(uint256 indexed roomId, address byPlayer, uint256 nextIndex);
    event PlayerKicked(uint256 indexed roomId, address player, string reason);
    
    // Batch events
    event KeysSharedToAll(uint256 indexed roomId, address from);
    event AllKeysShared(uint256 indexed roomId);  // NEW: all players shared
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
    event PhaseTimeout(uint256 indexed roomId, GamePhase phase);
    
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
    error AlreadySharedKeys();   // NEW
    error SessionExpired();
    error SessionNotForThisRoom();
    error InvalidSessionKey();
    error InvalidArrayLength();
    error PhaseDeadlinePassed(); // NEW

    // ============ MODIFIERS ============
    
    modifier onlyActiveParticipant(uint256 roomId) {
        address player = _resolvePlayer(roomId);
        if (!isPlayerInRoom[roomId][player]) revert NotParticipant();
        if (!_hasFlag(roomId, player, FLAG_ACTIVE)) revert PlayerInactive();
        _;
    }

    modifier beforeDeadline(uint256 roomId) {
        if (rooms[roomId].phaseDeadline != 0 && block.timestamp > rooms[roomId].phaseDeadline) {
            revert PhaseDeadlinePassed();
        }
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
            phaseDeadline: 0,
            confirmedCount: 0,
            votedCount: 0,
            committedCount: 0,
            revealedCount: 0,
            keysSharedCount: 0
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
        room.currentShufflerIndex = _findNextActive(roomId, 0);
        room.lastActionTimestamp = uint32(block.timestamp);
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
        
        emit GameStarted(roomId);
    }

    function submitDeck(uint256 roomId, string[] calldata deck) 
        external 
        onlyActiveParticipant(roomId)
        beforeDeadline(roomId)
    {
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
        
        uint8 nextIndex = _findNextActive(roomId, room.currentShufflerIndex + 1);
        room.currentShufflerIndex = nextIndex;
        room.lastActionTimestamp = uint32(block.timestamp);
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);

        emit DeckSubmitted(roomId, player, nextIndex);

        // FIX: transition to REVEAL only when all have shuffled
        if (nextIndex >= roomPlayers[roomId].length) {
            _transitionToReveal(roomId);
        }
    }

    function _transitionToReveal(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        room.phase = GamePhase.REVEAL;
        room.keysSharedCount = 0;
        room.confirmedCount = 0;
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
        
        // Reset shared keys flag for all alive players
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            if ((players[i].flags & FLAG_ACTIVE) != 0) {
                players[i].flags &= ~(FLAG_HAS_SHARED_KEYS | FLAG_CONFIRMED_ROLE);
            }
        }
    }

    // FIX: Returns length if no active found (instead of potential loop/stuck)
    function _findNextActive(uint256 roomId, uint8 startIndex) internal view returns (uint8) {
        Player[] storage players = roomPlayers[roomId];
        uint8 len = uint8(players.length);
        
        for (uint8 i = startIndex; i < len; i++) {
            if ((players[i].flags & FLAG_ACTIVE) != 0) {
                return i;
            }
        }
        return len; // No more active players - signals completion
    }

    // ============ REVEAL - BATCH SHARE KEYS (FIXED) ============

    /**
     * @notice Share encrypted deck keys to ALL players in ONE transaction
     * @dev FIX: Each player can only share once, counter tracks completion
     */
    function shareKeysToAll(
        uint256 roomId, 
        address[] calldata recipients, 
        bytes[] calldata encryptedKeys
    ) external onlyActiveParticipant(roomId) beforeDeadline(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        
        if (room.phase != GamePhase.REVEAL) revert WrongPhase();
        if (recipients.length != encryptedKeys.length) revert InvalidArrayLength();
        
        // FIX: Check player hasn't already shared
        if (_hasFlag(roomId, player, FLAG_HAS_SHARED_KEYS)) revert AlreadySharedKeys();
        
        // Store all keys in one tx (FIX: 3D mapping - sender => recipient)
        for (uint256 i = 0; i < recipients.length; i++) {
            address to = recipients[i];
            if (!isPlayerInRoom[roomId][to]) revert NotParticipant();
            playerDeckKeys[roomId][player][to] = encryptedKeys[i];
        }
        
        // Mark player as having shared
        _setFlag(roomId, player, FLAG_HAS_SHARED_KEYS);
        room.keysSharedCount++;
        
        emit KeysSharedToAll(roomId, player);
        
        // Check if all alive players have shared
        if (room.keysSharedCount == room.aliveCount) {
            emit AllKeysShared(roomId);
        }
    }

    /**
     * @notice Confirm role after decrypting - with AUTO-FINALIZE
     */
    function confirmRole(uint256 roomId) 
        external 
        onlyActiveParticipant(roomId) 
        beforeDeadline(roomId) 
    {
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
            _transitionToDay(roomId);
            emit AllRolesConfirmed(roomId);
        }
    }

    function _transitionToDay(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        room.phase = GamePhase.DAY;
        room.dayCount++;
        room.lastActionTimestamp = uint32(block.timestamp);
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
        emit DayStarted(roomId, room.dayCount);
    }

    // ============ DAY & VOTING - AUTO-FINALIZE ============

    function startVoting(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.DAY) revert WrongPhase();
        
        room.phase = GamePhase.VOTING;
        room.votedCount = 0;
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
        
        // FIX: Reset vote flags AND voteCounts for all ALIVE players only
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            address p = players[i].wallet;
            players[i].flags &= ~FLAG_HAS_VOTED;
            votes[roomId][p] = address(0);
            
            // Only reset voteCounts for alive players
            if ((players[i].flags & FLAG_ACTIVE) != 0) {
                voteCounts[roomId][p] = 0;
            }
        }
        
        emit VotingStarted(roomId);
    }

    /**
     * @notice Cast vote - with AUTO-FINALIZE when all voted
     */
    function vote(uint256 roomId, address target) 
        external 
        onlyActiveParticipant(roomId) 
        beforeDeadline(roomId) 
    {
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
            _transitionToNight(roomId);
        }
    }

    function _transitionToNight(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        room.phase = GamePhase.NIGHT;
        room.committedCount = 0;
        room.revealedCount = 0;
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
        
        // Reset night flags for all players
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            address p = players[i].wallet;
            players[i].flags &= ~(FLAG_HAS_COMMITTED | FLAG_HAS_REVEALED);
            delete nightCommits[roomId][p];
            delete revealedActions[roomId][p];
            delete revealedTargets[roomId][p];
        }
        
        emit NightStarted(roomId);
    }

    // ============ NIGHT - AUTO-FINALIZE ============

    /**
     * @notice Commit night action - tracks count for auto-finalize
     */
    function commitNightAction(uint256 roomId, bytes32 hash) 
        external 
        onlyActiveParticipant(roomId) 
        beforeDeadline(roomId)
    {
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
    ) external onlyActiveParticipant(roomId) beforeDeadline(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.NIGHT) revert WrongPhase();
        if (_hasFlag(roomId, player, FLAG_HAS_REVEALED)) revert AlreadyRevealed();
        
        // Must have committed first
        require(_hasFlag(roomId, player, FLAG_HAS_COMMITTED), "Must commit first");
        
        // FIX: Validate target is alive (for KILL/HEAL/CHECK actions)
        if (action != NightActionType.NONE && target != address(0)) {
            require(isPlayerInRoom[roomId][target], "Target not in room");
            require(_hasFlag(roomId, target, FLAG_ACTIVE), "Target is dead");
        }

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

    /**
     * @notice Finalize night - classic mafia rules (majority vote for kill)
     * @dev Counts KILL votes per target, kills only if majority agrees
     */
    function _finalizeNight(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        
        // If no one committed, just skip night
        if (room.committedCount == 0) {
            emit NightFinalized(roomId, address(0), address(0));
            _resetNightState(roomId);
            if (!_checkWinCondition(roomId)) {
                _transitionToDay(roomId);
            }
            return;
        }
        
        // Count votes for each target and find healed player
        address[] memory targets = new address[](room.aliveCount);
        uint8[] memory killVotes = new uint8[](room.aliveCount);
        uint8 targetCount = 0;
        uint8 totalKillVotes = 0;
        address healed = address(0);
        bool healedSet = false;
        
        Player[] storage players = roomPlayers[roomId];
        for (uint8 i = 0; i < players.length; i++) {
            address p = players[i].wallet;
            NightActionType action = revealedActions[roomId][p];
            
            if (action == NightActionType.KILL) {
                address target = revealedTargets[roomId][p];
                if (target == address(0)) continue;
                
                totalKillVotes++;
                
                // Find or add target
                bool found = false;
                for (uint8 j = 0; j < targetCount; j++) {
                    if (targets[j] == target) {
                        killVotes[j]++;
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    targets[targetCount] = target;
                    killVotes[targetCount] = 1;
                    targetCount++;
                }
            }
            // First HEAL wins
            if (action == NightActionType.HEAL && !healedSet) {
                healed = revealedTargets[roomId][p];
                healedSet = true;
            }
        }
        
        // Find target with majority votes (> 50% of total KILL votes)
        address victim = address(0);
        uint8 majorityThreshold = (totalKillVotes / 2) + 1; // strict majority
        
        for (uint8 i = 0; i < targetCount; i++) {
            if (killVotes[i] >= majorityThreshold) {
                victim = targets[i];
                break;
            }
        }

        emit NightFinalized(roomId, victim, healed);

        // Kill victim only if majority agreed AND not healed
        if (victim != address(0) && victim != healed) {
            _killPlayer(roomId, victim);
            emit PlayerEliminated(roomId, victim, "Killed at night");
        }

        _resetNightState(roomId);

        if (!_checkWinCondition(roomId)) {
            _transitionToDay(roomId);
        }
    }

    // ============ HELPERS ============

    function _killPlayer(uint256 roomId, address victim) internal {
        if (!_hasFlag(roomId, victim, FLAG_ACTIVE)) return;
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
            _endGame(roomId, room.aliveCount == 0 ? "Draw" : "Last player standing");
            return true;
        }
        
        // TODO: Add proper mafia vs town win condition
        // (requires tracking roles on-chain or trusting frontend)
        
        return false;
    }

    function _endGame(uint256 roomId, string memory reason) internal {
        rooms[roomId].phase = GamePhase.ENDED;
        rooms[roomId].phaseDeadline = 0;
        emit GameEnded(roomId, reason);
    }

    // ============ TIMEOUT ENFORCEMENT ============

    /**
     * @notice Force phase transition when deadline passed
     * @dev Anyone can call if deadline passed - griefing protection
     */
    function forcePhaseTimeout(uint256 roomId) external {
        GameRoom storage room = rooms[roomId];
        
        require(room.phaseDeadline != 0, "No deadline set");
        require(block.timestamp > room.phaseDeadline, "Deadline not passed");
        require(room.phase != GamePhase.LOBBY && room.phase != GamePhase.ENDED, "Cannot timeout this phase");
        
        emit PhaseTimeout(roomId, room.phase);
        
        if (room.phase == GamePhase.SHUFFLING) {
            _kickCurrentShuffler(roomId);
        } 
        else if (room.phase == GamePhase.REVEAL) {
            _kickUnconfirmedPlayers(roomId);
            if (room.aliveCount >= 2) {
                _transitionToDay(roomId);
            } else {
                _endGame(roomId, "Too few players remaining");
            }
        }
        else if (room.phase == GamePhase.VOTING) {
            // Finalize with current votes
            _finalizeVoting(roomId);
        }
        else if (room.phase == GamePhase.NIGHT) {
            // FIX: If no commits, skip night; otherwise finalize with current reveals
            if (room.committedCount == 0) {
                emit NightFinalized(roomId, address(0), address(0));
                _resetNightState(roomId);
                if (!_checkWinCondition(roomId)) {
                    _transitionToDay(roomId);
                }
            } else {
                _finalizeNight(roomId);
            }
        }
        else if (room.phase == GamePhase.DAY) {
            // Auto-start voting
            room.phase = GamePhase.VOTING;
            room.votedCount = 0;
            room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
            emit VotingStarted(roomId);
        }
    }

    function _kickCurrentShuffler(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        
        if (room.currentShufflerIndex < roomPlayers[roomId].length) {
            address stalledPlayer = roomPlayers[roomId][room.currentShufflerIndex].wallet;
            _killPlayer(roomId, stalledPlayer);
            emit PlayerKicked(roomId, stalledPlayer, "Timeout during shuffle");
        }
        
        // Find next active
        uint8 nextIndex = _findNextActive(roomId, room.currentShufflerIndex + 1);
        room.currentShufflerIndex = nextIndex;
        room.lastActionTimestamp = uint32(block.timestamp);
        room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
        
        if (nextIndex >= roomPlayers[roomId].length) {
            if (room.aliveCount >= 2) {
                _transitionToReveal(roomId);
            } else {
                _endGame(roomId, "Too few players remaining");
            }
        }
    }

    function _kickUnconfirmedPlayers(uint256 roomId) internal {
        Player[] storage players = roomPlayers[roomId];
        
        for (uint8 i = 0; i < players.length; i++) {
            if ((players[i].flags & FLAG_ACTIVE) != 0) {
                // Kick if didn't share keys OR didn't confirm role
                bool shared = (players[i].flags & FLAG_HAS_SHARED_KEYS) != 0;
                bool confirmed = (players[i].flags & FLAG_CONFIRMED_ROLE) != 0;
                
                if (!shared || !confirmed) {
                    _killPlayer(roomId, players[i].wallet);
                    emit PlayerKicked(roomId, players[i].wallet, "Timeout during reveal");
                }
            }
        }
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
    
    /**
     * @notice Get decryption key that `from` shared for `to`
     * @dev FIX: Updated for 3D mapping
     */
    function getKeyFromTo(uint256 roomId, address from, address to) external view returns (bytes memory) {
        return playerDeckKeys[roomId][from][to];
    }
    
    /**
     * @notice Get all decryption keys shared TO me (by all other players)
     * @dev Returns arrays of senders and their keys
     */
    function getAllKeysForMe(uint256 roomId) external view returns (address[] memory senders, bytes[] memory keys) {
        address player = sessionToMain[msg.sender];
        if (player == address(0)) {
            player = msg.sender;
        }
        
        Player[] storage players = roomPlayers[roomId];
        uint8 count = 0;
        
        // Count how many keys we have
        for (uint8 i = 0; i < players.length; i++) {
            address sender = players[i].wallet;
            if (sender != player && playerDeckKeys[roomId][sender][player].length > 0) {
                count++;
            }
        }
        
        // Build arrays
        senders = new address[](count);
        keys = new bytes[](count);
        uint8 idx = 0;
        
        for (uint8 i = 0; i < players.length; i++) {
            address sender = players[i].wallet;
            if (sender != player && playerDeckKeys[roomId][sender][player].length > 0) {
                senders[idx] = sender;
                keys[idx] = playerDeckKeys[roomId][sender][player];
                idx++;
            }
        }
        
        return (senders, keys);
    }

    function getPlayerFlags(uint256 roomId, address player) external view returns (
        bool isActive,
        bool hasConfirmedRole,
        bool hasVoted,
        bool hasCommitted,
        bool hasRevealed,
        bool hasSharedKeys
    ) {
        uint8 idx = playerIndex[roomId][player];
        uint32 flags = roomPlayers[roomId][idx].flags;
        return (
            (flags & FLAG_ACTIVE) != 0,
            (flags & FLAG_CONFIRMED_ROLE) != 0,
            (flags & FLAG_HAS_VOTED) != 0,
            (flags & FLAG_HAS_COMMITTED) != 0,
            (flags & FLAG_HAS_REVEALED) != 0,
            (flags & FLAG_HAS_SHARED_KEYS) != 0
        );
    }

    function getPhaseDeadline(uint256 roomId) external view returns (uint32) {
        return rooms[roomId].phaseDeadline;
    }
}
