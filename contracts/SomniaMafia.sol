// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MafiaPortal {
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

    uint256 public nextRoomId = 1;
    uint256 public constant TURN_TIMEOUT = 2 minutes;

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

    modifier onlyActiveParticipant(uint256 roomId) {
        if (!isPlayerInRoom[roomId][msg.sender]) revert NotParticipant();
        if (!_isPlayerActive(roomId, msg.sender)) revert PlayerInactive();
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

    // --- LOBBY ---

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

    // --- SHUFFLE ---

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
        if (msg.sender != rooms[roomId].host) revert Unauthorized();
        if (rooms[roomId].phase != GamePhase.LOBBY) revert WrongPhase();
        
        rooms[roomId].phase = GamePhase.SHUFFLING;
        rooms[roomId].currentShufflerIndex = _findNextActive(roomId, 0);
        rooms[roomId].lastActionTimestamp = block.timestamp;
        
        emit GameStarted(roomId);
    }

    function submitDeck(uint256 roomId, string[] memory deck) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.SHUFFLING) revert WrongPhase();
        
        if (roomPlayers[roomId][room.currentShufflerIndex].wallet != msg.sender) revert NotYourTurn();

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

        emit DeckSubmitted(roomId, msg.sender, room.currentShufflerIndex);
    }

    // --- KICK / AFK ---

    function kickStalledPlayer(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase == GamePhase.LOBBY || room.phase == GamePhase.ENDED) revert WrongPhase();
        
        if (block.timestamp < room.lastActionTimestamp + TURN_TIMEOUT) revert TimeNotExpired();

        uint256 targetIndex = 9999;

        if (room.phase == GamePhase.SHUFFLING) {
            targetIndex = room.currentShufflerIndex;
        } else {
            // В других фазах ищем первого, кто не совершил действие (упрощение)
            // В продакшене нужна более сложная логика "кто не проголосовал"
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

    // --- REVEAL ---

    function shareKey(uint256 roomId, address to, string calldata encryptedKey) external onlyActiveParticipant(roomId) {
        if (rooms[roomId].phase != GamePhase.REVEAL) revert WrongPhase();
        if (!isPlayerInRoom[roomId][to]) revert NotParticipant();
        
        keyMailbox[roomId][msg.sender][to] = encryptedKey;
        emit KeyShared(roomId, msg.sender, to);
    }

    function confirmRole(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.REVEAL) revert WrongPhase();

        for(uint256 i = 0; i < roomPlayers[roomId].length; i++) {
            if (roomPlayers[roomId][i].wallet == msg.sender) {
                roomPlayers[roomId][i].hasConfirmedRole = true;
                break;
            }
        }
        
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

    // --- DAY & VOTING ---

    function startVoting(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.DAY) revert WrongPhase();
        // Можно добавить проверку "только Хост", но демократичнее "любой"
        room.phase = GamePhase.VOTING;
        emit VotingStarted(roomId);
    }

    function vote(uint256 roomId, address target) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.VOTING) revert WrongPhase();
        if (!isPlayerInRoom[roomId][target]) revert NotParticipant();
        if (!_isPlayerActive(roomId, target)) revert PlayerInactive();

        address oldTarget = votes[roomId][msg.sender];
        if (oldTarget != address(0)) {
            if (voteCounts[roomId][oldTarget] > 0) {
                voteCounts[roomId][oldTarget]--;
            }
        }

        votes[roomId][msg.sender] = target;
        voteCounts[roomId][target]++;
        
        emit VoteCast(roomId, msg.sender, target);
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

        // Кворум > 50%
        if (maxVotes > room.playersCount / 2) {
            _killPlayer(roomId, victim);
            emit PlayerEliminated(roomId, victim, "Voted out");
        }

        // Clean up votes for next day!
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
        // Очистка голосов - дорого по газу, но для 16 игроков приемлемо
        for(uint256 i=0; i<roomPlayers[roomId].length; i++) {
            address p = roomPlayers[roomId][i].wallet;
            votes[roomId][p] = address(0);
            voteCounts[roomId][p] = 0;
            
            // Clean Night state as well
            delete nightCommits[roomId][p];
            delete revealedActions[roomId][p];
            delete revealedTargets[roomId][p];
        }
    }

    // --- NIGHT PHASE (COMMIT-REVEAL) ---

    function commitNightAction(uint256 roomId, bytes32 hash) external onlyActiveParticipant(roomId) {
        if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
        nightCommits[roomId][msg.sender] = NightCommit({
            commitHash: hash,
            revealed: false
        });
        emit NightActionCommitted(roomId, msg.sender);
    }

    function revealNightAction(uint256 roomId, NightActionType action, address target, string calldata salt) external onlyActiveParticipant(roomId) {
        if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
        if (nightCommits[roomId][msg.sender].revealed) revert AlreadyRevealed();

        // 1. Verify Hash
        bytes32 calculatedHash = keccak256(abi.encodePacked(action, target, salt));
        if (calculatedHash != nightCommits[roomId][msg.sender].commitHash) revert InvalidReveal();

        // 2. Save
        nightCommits[roomId][msg.sender].revealed = true;
        revealedActions[roomId][msg.sender] = action;
        revealedTargets[roomId][msg.sender] = target;

        emit NightActionRevealed(roomId, msg.sender, action);
    }

    function finalizeNight(uint256 roomId) external onlyActiveParticipant(roomId) {
        GameRoom storage room = rooms[roomId];
        if (room.phase != GamePhase.NIGHT) revert WrongPhase();

        // LOGIC: Apply Actions
        // В MVP мы просто ищем того, кого "KILL" больше всего, и проверяем "HEAL"
        // Контракт НЕ ЗНАЕТ кто мафия, поэтому доверяет большинству действий KILL.
        // Это требует честности ночных игроков (или ZK в будущем).
        
        address victim = address(0);
        address healed = address(0);
        
        // Simple iteration to find generic kill target
        for(uint256 i=0; i<roomPlayers[roomId].length; i++) {
            address p = roomPlayers[roomId][i].wallet;
            if (revealedActions[roomId][p] == NightActionType.KILL) {
                // Если несколько мафий, берем цель первой (упрощение)
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

    // --- WIN CONDITION ---

    function _checkWinCondition(uint256 roomId) internal {
        GameRoom storage room = rooms[roomId];
        
        if (room.playersCount <= 1) { // Упрощенно
            room.phase = GamePhase.ENDED;
            emit GameEnded(roomId, "Game Over");
        }
        // Реальную проверку Mafia vs Civilians надо делать с подсчетом ролей,
        // но роли зашифрованы. Поэтому в MVP играем до последнего.
    }

    // --- VIEW ---
    function getPlayers(uint256 roomId) external view returns (Player[] memory) {
        return roomPlayers[roomId];
    }
    function getDeck(uint256 roomId) external view returns (string[] memory) {
        return roomDeck[roomId];
    }
    function getKeyFrom(uint256 roomId, address from) external view returns (string memory) {
        return keyMailbox[roomId][from][msg.sender];
    }
}