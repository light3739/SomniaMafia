// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MafiaPortal V2 with Session Keys
 * @notice Session Keys allow players to sign game actions automatically without wallet popups
 * @dev Player signs once to register a session key, then all game actions use that key
 */
contract MafiaPortalV2 {
    enum GamePhase { LOBBY, SHUFFLING, REVEAL, DAY, NIGHT, VOTING, ENDED }
    enum NightActionType { NONE, KILL, HEAL, CHECK }

    struct Player {
        address wallet;
        string nickname;
        string publicKey;
        bool hasConfirmedRole;
        bool isActive;
    }

    struct GameRoom {
        uint256 id;
        address host;
        GamePhase phase;
        uint256 maxPlayers;
        uint256 playersCount;
        uint256 dayCount;
        uint256 currentShufflerIndex; 
        uint256 lastActionTimestamp;
    }

    struct NightCommit {
        bytes32 commitHash;
        bool revealed;
    }

    // ============ SESSION KEY STRUCTURES ============
    struct SessionKey {
        address sessionAddress;   // The temporary key address
        uint256 expiresAt;        // Timestamp when session expires
        uint256 roomId;           // Session is valid only for this room
        bool isActive;            // Can be revoked by owner
    }

    // ============ STATE VARIABLES ============
    mapping(uint256 => GameRoom) public rooms;
    mapping(uint256 => Player[]) public roomPlayers;
    mapping(uint256 => mapping(address => bool)) public isPlayerInRoom;
    mapping(uint256 => string[]) public roomDeck;
    
    // Keys: RoomID => From => To => Key
    mapping(uint256 => mapping(address => mapping(address => string))) public keyMailbox;

    // Voting
    mapping(uint256 => mapping(address => address)) public votes;
    mapping(uint256 => mapping(address => uint256)) public voteCounts;

    // Night Logic
    mapping(uint256 => mapping(address => NightCommit)) public nightCommits;
    mapping(uint256 => mapping(address => NightActionType)) public revealedActions;
    mapping(uint256 => mapping(address => address)) public revealedTargets;

    // ============ SESSION KEY MAPPINGS ============
    // Main wallet => SessionKey (one active session per wallet)
    mapping(address => SessionKey) public sessionKeys;
    // Session address => Main wallet (reverse lookup)
    mapping(address => address) public sessionToMain;

    uint256 public nextRoomId = 1;
    uint256 public constant TURN_TIMEOUT = 2 minutes;
    uint256 public constant SESSION_DURATION = 4 hours; // Session keys last 4 hours

    // Events
    event RoomCreated(uint256 indexed roomId, address host, uint256 maxPlayers);
    event PlayerJoined(uint256 indexed roomId, address player, string nickname);
    event GameStarted(uint256 indexed roomId);
    event DeckSubmitted(uint256 indexed roomId, address byPlayer, uint256 nextIndex);
    event PlayerKicked(uint256 indexed roomId, address player, string reason);
    event KeyShared(uint256 indexed roomId, address from, address to);
    event RoleConfirmed(uint256 indexed roomId, address player);
    event DayStarted(uint256 indexed roomId, uint256 dayNumber);
    event VotingStarted(uint256 indexed roomId);
    
    event VoteCast(uint256 indexed roomId, address voter, address target);
    event PlayerEliminated(uint256 indexed roomId, address player, string reason);
    event NightStarted(uint256 indexed roomId);
    event NightActionCommitted(uint256 indexed roomId, address player);
    event NightActionRevealed(uint256 indexed roomId, address player, NightActionType action);
    event GameEnded(uint256 indexed roomId, string reason);

    // Session Key Events
    event SessionKeyRegistered(address indexed mainWallet, address indexed sessionKey, uint256 roomId, uint256 expiresAt);
    event SessionKeyRevoked(address indexed mainWallet, address indexed sessionKey);

    // Errors
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
    error SessionExpired();
    error SessionNotForThisRoom();
    error InvalidSessionKey();

    // ============ SESSION KEY LOGIC ============

    /**
     * @notice Register a session key for automatic game action signing
     * @param sessionAddress The address of the temporary session key (generated client-side)
     * @param roomId The room this session key is valid for
     * @dev Player signs this once with main wallet, then uses sessionAddress for all game actions
     * @dev If ETH is sent with this call, it will be forwarded to the session key for gas
     */
    function registerSessionKey(address sessionAddress, uint256 roomId) external payable {
        require(sessionAddress != address(0), "Invalid session address");
        require(isPlayerInRoom[roomId][msg.sender], "Not in room");
        
        // Revoke old session if exists
        if (sessionKeys[msg.sender].isActive) {
            address oldSession = sessionKeys[msg.sender].sessionAddress;
            delete sessionToMain[oldSession];
        }

        // Register new session
        sessionKeys[msg.sender] = SessionKey({
            sessionAddress: sessionAddress,
            expiresAt: block.timestamp + SESSION_DURATION,
            roomId: roomId,
            isActive: true
        });
        
        sessionToMain[sessionAddress] = msg.sender;
        
        // Forward any ETH sent to the session key for gas
        if (msg.value > 0) {
            (bool success, ) = payable(sessionAddress).call{value: msg.value}("");
            require(success, "ETH transfer failed");
        }
        
        emit SessionKeyRegistered(msg.sender, sessionAddress, roomId, block.timestamp + SESSION_DURATION);
    }

    /**
     * @notice Revoke your session key (logout)
     */
    function revokeSessionKey() external {
        SessionKey storage session = sessionKeys[msg.sender];
        if (session.isActive) {
            delete sessionToMain[session.sessionAddress];
            session.isActive = false;
            emit SessionKeyRevoked(msg.sender, session.sessionAddress);
        }
    }

    /**
     * @notice Get the main wallet for a given sender (handles both direct and session calls)
     * @param roomId The room to validate against
     * @return mainWallet The actual player's main wallet address
     */
    function _resolvePlayer(uint256 roomId) internal view returns (address mainWallet) {
        // Check if msg.sender is a session key
        address potentialMain = sessionToMain[msg.sender];
        
        if (potentialMain != address(0)) {
            // msg.sender is a session key
            SessionKey storage session = sessionKeys[potentialMain];
            
            if (!session.isActive) revert InvalidSessionKey();
            if (block.timestamp > session.expiresAt) revert SessionExpired();
            if (session.roomId != roomId) revert SessionNotForThisRoom();
            
            return potentialMain;
        }
        
        // msg.sender is the main wallet directly
        return msg.sender;
    }

    /**
     * @notice Check if a session key is valid
     */
    function isSessionValid(address mainWallet, uint256 roomId) external view returns (bool) {
        SessionKey storage session = sessionKeys[mainWallet];
        return session.isActive && 
               block.timestamp <= session.expiresAt && 
               session.roomId == roomId;
    }

    /**
     * @notice Get session key info for a wallet
     */
    function getSessionKey(address mainWallet) external view returns (
        address sessionAddress,
        uint256 expiresAt,
        uint256 roomId,
        bool isActive
    ) {
        SessionKey storage session = sessionKeys[mainWallet];
        return (session.sessionAddress, session.expiresAt, session.roomId, session.isActive);
    }

    // ============ MODIFIERS (Updated for Session Keys) ============

    modifier onlyActiveParticipant(uint256 roomId) {
        address player = _resolvePlayer(roomId);
        if (!isPlayerInRoom[roomId][player]) revert NotParticipant();
        if (!_isPlayerActive(roomId, player)) revert PlayerInactive();
        _;
    }

    function _isPlayerActive(uint256 roomId, address wallet) internal view returns (bool) {
        Player[] storage players = roomPlayers[roomId];
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i].wallet == wallet) {
                return players[i].isActive;
            }
        }
        return false;
    }

    // ============ LOBBY (No session key needed - use main wallet) ============

    function createRoom(uint256 maxPlayers, string calldata hostNickname, string calldata publicKey) external {
        require(maxPlayers >= 2 && maxPlayers <= 16, "Invalid count");
        
        uint256 roomId = nextRoomId++;
        GameRoom storage room = rooms[roomId];
        room.id = roomId;
        room.host = msg.sender;
        room.phase = GamePhase.LOBBY;
        room.maxPlayers = maxPlayers;
        room.lastActionTimestamp = block.timestamp;
        
        _addPlayer(roomId, msg.sender, hostNickname, publicKey);
        emit RoomCreated(roomId, msg.sender, maxPlayers);
    }

    function joinRoom(uint256 roomId, string calldata nickname, string calldata publicKey) external {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.LOBBY) revert WrongPhase();
        if (room.playersCount >= room.maxPlayers) revert RoomFull();
        if (isPlayerInRoom[roomId][msg.sender]) revert AlreadyJoined();

        _addPlayer(roomId, msg.sender, nickname, publicKey);
    }

    function _addPlayer(uint256 roomId, address player, string calldata nick, string calldata pubKey) internal {
        roomPlayers[roomId].push(Player({
            wallet: player,
            nickname: nick,
            publicKey: pubKey,
            hasConfirmedRole: false,
            isActive: true
        }));
        
        rooms[roomId].playersCount++;
        isPlayerInRoom[roomId][player] = true;
        emit PlayerJoined(roomId, player, nick);
    }

    // ============ SHUFFLE (Supports Session Keys) ============

    function _findNextActive(uint256 roomId, uint256 startIndex) internal view returns (uint256) {
        Player[] storage players = roomPlayers[roomId];
        uint256 len = players.length;
        for (uint256 i = startIndex; i < len; i++) {
            if (players[i].isActive) {
                return i;
            }
        }
        return len;
    }

    function startShuffle(uint256 roomId) external {
        // Host must use main wallet for this
        if (msg.sender != rooms[roomId].host) revert Unauthorized();
        if (rooms[roomId].phase != GamePhase.LOBBY) revert WrongPhase();
        
        rooms[roomId].phase = GamePhase.SHUFFLING;
        rooms[roomId].currentShufflerIndex = _findNextActive(roomId, 0);
        rooms[roomId].lastActionTimestamp = block.timestamp;
        
        emit GameStarted(roomId);
    }

    function submitDeck(uint256 roomId, string[] memory deck) external onlyActiveParticipant(roomId) {
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
        room.lastActionTimestamp = block.timestamp;

        if (room.currentShufflerIndex >= roomPlayers[roomId].length) {
            room.phase = GamePhase.REVEAL;
        }

        emit DeckSubmitted(roomId, player, room.currentShufflerIndex);
    }

    // ============ KICK / AFK ============

    function kickStalledPlayer(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase == GamePhase.LOBBY || room.phase == GamePhase.ENDED) revert WrongPhase();
        
        if (block.timestamp < room.lastActionTimestamp + TURN_TIMEOUT) revert TimeNotExpired();

        uint256 targetIndex = 9999;

        if (room.phase == GamePhase.SHUFFLING) {
            targetIndex = room.currentShufflerIndex;
        } else {
            revert("Kick only supported in Shuffle for MVP");
        }

        if (targetIndex == 9999) revert NoStalledPlayers();

        Player storage stalledPlayer = roomPlayers[roomId][targetIndex];
        stalledPlayer.isActive = false;
        room.playersCount--;
        
        emit PlayerKicked(roomId, stalledPlayer.wallet, "Timeout");

        if (room.phase == GamePhase.SHUFFLING) {
            room.currentShufflerIndex = _findNextActive(roomId, targetIndex);
            room.lastActionTimestamp = block.timestamp;
            if (room.currentShufflerIndex >= roomPlayers[roomId].length) {
                room.phase = GamePhase.REVEAL;
            }
        }
        
        _checkWinCondition(roomId);
    }

    // ============ REVEAL (Supports Session Keys) ============

    function shareKey(uint256 roomId, address to, string calldata encryptedKey) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        if (rooms[roomId].phase != GamePhase.REVEAL) revert WrongPhase();
        if (!isPlayerInRoom[roomId][to]) revert NotParticipant();
        
        keyMailbox[roomId][player][to] = encryptedKey;
        emit KeyShared(roomId, player, to);
    }

    function confirmRole(uint256 roomId) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.REVEAL) revert WrongPhase();

        for(uint256 i = 0; i < roomPlayers[roomId].length; i++) {
            if (roomPlayers[roomId][i].wallet == player) {
                roomPlayers[roomId][i].hasConfirmedRole = true;
                break;
            }
        }
        
        emit RoleConfirmed(roomId, player);
        _checkRevealCompletion(roomId);
    }

    function _checkRevealCompletion(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        uint256 confirmedCount = 0;
        uint256 activeCount = 0;

        for(uint256 i = 0; i < roomPlayers[roomId].length; i++) {
            if (roomPlayers[roomId][i].isActive) {
                activeCount++;
                if (roomPlayers[roomId][i].hasConfirmedRole) {
                    confirmedCount++;
                }
            }
        }

        if (confirmedCount == activeCount && activeCount > 0) {
            room.phase = GamePhase.DAY;
            room.dayCount = 1;
            room.lastActionTimestamp = block.timestamp;
            emit DayStarted(roomId, 1);
        }
    }

    // ============ DAY & VOTING (Supports Session Keys) ============

    function startVoting(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.DAY) revert WrongPhase();
        room.phase = GamePhase.VOTING;
        emit VotingStarted(roomId);
    }

    function vote(uint256 roomId, address target) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.VOTING) revert WrongPhase();
        if (!isPlayerInRoom[roomId][target]) revert NotParticipant();
        if (!_isPlayerActive(roomId, target)) revert PlayerInactive();

        address oldTarget = votes[roomId][player];
        if (oldTarget != address(0)) {
            if (voteCounts[roomId][oldTarget] > 0) {
                voteCounts[roomId][oldTarget]--;
            }
        }

        votes[roomId][player] = target;
        voteCounts[roomId][target]++;
        
        emit VoteCast(roomId, player, target);
    }

    function finalizeVoting(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.VOTING) revert WrongPhase();

        address victim = address(0);
        uint256 maxVotes = 0;
        
        for(uint256 i=0; i<roomPlayers[roomId].length; i++) {
            address p = roomPlayers[roomId][i].wallet;
            if (roomPlayers[roomId][i].isActive) {
                uint256 v = voteCounts[roomId][p];
                if (v > maxVotes) {
                    maxVotes = v;
                    victim = p;
                }
            }
        }

        // Quorum > 50%
        if (maxVotes > room.playersCount / 2) {
            _killPlayer(roomId, victim);
            emit PlayerEliminated(roomId, victim, "Voted out");
        }

        _resetDayState(roomId);

        _checkWinCondition(roomId);
        if (room.phase != GamePhase.ENDED) {
            room.phase = GamePhase.NIGHT;
            emit NightStarted(roomId);
        }
    }

    function _killPlayer(uint256 roomId, address victim) internal {
        for(uint256 i=0; i<roomPlayers[roomId].length; i++) {
            if (roomPlayers[roomId][i].wallet == victim) {
                roomPlayers[roomId][i].isActive = false;
                rooms[roomId].playersCount--;
                break;
            }
        }
    }

    function _resetDayState(uint256 roomId) internal {
        for(uint256 i=0; i<roomPlayers[roomId].length; i++) {
            address p = roomPlayers[roomId][i].wallet;
            votes[roomId][p] = address(0);
            voteCounts[roomId][p] = 0;
            
            delete nightCommits[roomId][p];
            delete revealedActions[roomId][p];
            delete revealedTargets[roomId][p];
        }
    }

    // ============ NIGHT PHASE (Supports Session Keys) ============

    function commitNightAction(uint256 roomId, bytes32 hash) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
        nightCommits[roomId][player] = NightCommit({
            commitHash: hash,
            revealed: false
        });
        emit NightActionCommitted(roomId, player);
    }

    function revealNightAction(uint256 roomId, NightActionType action, address target, string calldata salt) external onlyActiveParticipant(roomId) {
        address player = _resolvePlayer(roomId);
        if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
        if (nightCommits[roomId][player].revealed) revert AlreadyRevealed();

        bytes32 calculatedHash = keccak256(abi.encodePacked(action, target, salt));
        if (calculatedHash != nightCommits[roomId][player].commitHash) revert InvalidReveal();

        nightCommits[roomId][player].revealed = true;
        revealedActions[roomId][player] = action;
        revealedTargets[roomId][player] = target;

        emit NightActionRevealed(roomId, player, action);
    }

    function finalizeNight(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.NIGHT) revert WrongPhase();
        
        address victim = address(0);
        address healed = address(0);
        
        for(uint256 i=0; i<roomPlayers[roomId].length; i++) {
            address p = roomPlayers[roomId][i].wallet;
            if (revealedActions[roomId][p] == NightActionType.KILL) {
                victim = revealedTargets[roomId][p];
            }
            if (revealedActions[roomId][p] == NightActionType.HEAL) {
                healed = revealedTargets[roomId][p];
            }
        }

        if (victim != address(0) && victim != healed) {
            _killPlayer(roomId, victim);
            emit PlayerEliminated(roomId, victim, "Killed at night");
        }

        _checkWinCondition(roomId);
        
        if (room.phase != GamePhase.ENDED) {
            room.phase = GamePhase.DAY;
            room.dayCount++;
            emit DayStarted(roomId, room.dayCount);
        }
    }

    // ============ WIN CONDITION ============

    function _checkWinCondition(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        
        if (room.playersCount <= 1) {
            room.phase = GamePhase.ENDED;
            emit GameEnded(roomId, "Game Over");
        }
    }

    // ============ VIEW FUNCTIONS ============
    
    function getPlayers(uint256 roomId) external view returns (Player[] memory) {
        return roomPlayers[roomId];
    }
    
    function getDeck(uint256 roomId) external view returns (string[] memory) {
        return roomDeck[roomId];
    }
    
    function getKeyFrom(uint256 roomId, address from) external view returns (string memory) {
        // Resolve msg.sender in case it's a session key
        address player = sessionToMain[msg.sender];
        if (player == address(0)) {
            player = msg.sender;
        }
        return keyMailbox[roomId][from][player];
    }
}
