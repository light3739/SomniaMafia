// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata a,
        uint[2][2] calldata b,
        uint[2] calldata c,
        uint[5] calldata input
    ) external view returns (bool);
}


contract MafiaPortal is ReentrancyGuard, Pausable, AccessControl {
bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
address public zkVerifier;

enum GamePhase { LOBBY, SHUFFLING, REVEAL, DAY, VOTING, NIGHT, ENDED }
enum NightActionType { NONE, KILL, HEAL, CHECK }
enum Role { NONE, MAFIA, DOCTOR, DETECTIVE, CITIZEN }

struct Player {
    address wallet;
    string nickname;
    bytes publicKey;
    uint32 flags;
}

struct GameRoom {
    uint64 id;
    address host;
    string name;
    GamePhase phase;
    uint8 maxPlayers;
    uint8 playersCount;
    uint8 aliveCount;
    uint16 dayCount;
    uint8 currentShufflerIndex;
    uint32 lastActionTimestamp;
    uint32 phaseDeadline;
    uint8 confirmedCount;
    uint8 votedCount;
    uint8 committedCount;
    uint8 revealedCount;
    uint8 keysSharedCount;
}

struct SessionKey {
    address sessionAddress;
    uint32 expiresAt;
    uint64 roomId;
    bool isActive;
}

struct NightCommit {
    bytes32 commitHash;
    bool revealed;
    uint32 commitTime;
}

struct DeckCommit {
    bytes32 commitHash;
    string[] deck;
    bool revealed;
}

struct MafiaMessage {
    bytes encryptedMessage;
    uint32 timestamp;
    address sender;
}

struct MafiaTargetCommit {
    bytes32 commitHash;
    address target;
    bool revealed;
}

mapping(uint256 => GameRoom) public rooms;
mapping(uint256 => Player[]) public roomPlayers;
mapping(uint256 => mapping(address => bool)) public isPlayerInRoom;
mapping(uint256 => mapping(address => uint8)) public playerIndex;
mapping(uint256 => mapping(address => DeckCommit)) public deckCommits;
mapping(uint256 => string[]) public revealedDeck;
mapping(uint256 => mapping(address => mapping(address => bytes))) public playerDeckKeys;
mapping(uint256 => mapping(address => address)) public votes;
mapping(uint256 => mapping(address => uint8)) public voteCounts;
mapping(uint256 => mapping(address => NightCommit)) public nightCommits;
mapping(uint256 => mapping(address => NightActionType)) public revealedActions;
mapping(uint256 => mapping(address => address)) public revealedTargets;
mapping(uint256 => mapping(address => Role)) public playerRoles;
mapping(uint256 => mapping(address => bytes32)) public roleCommits;
mapping(uint256 => MafiaMessage[]) public mafiaChat;
mapping(uint256 => mapping(address => MafiaTargetCommit)) public mafiaTargetCommits;
mapping(uint256 => uint8) public mafiaCommittedCount;
mapping(uint256 => uint8) public mafiaRevealedCount;
mapping(uint256 => address) public mafiaConsensusTarget;
mapping(address => SessionKey) public sessionKeys;
mapping(address => address) public sessionToMain;
mapping(address => bool) public isRegisteredSession;

uint256 public nextRoomId = 1;
uint32 public constant TURN_TIMEOUT = 2 minutes;
uint32 public constant PHASE_TIMEOUT = 3 minutes;
uint32 public constant NIGHT_TIMEOUT = 1 minutes;
uint32 public constant SESSION_DURATION = 4 hours;
uint32 public constant MAX_ARRAY_SIZE = 50;

uint32 constant FLAG_CONFIRMED_ROLE = 0x1;
uint32 constant FLAG_ACTIVE = 0x2;
uint32 constant FLAG_HAS_VOTED = 0x4;
uint32 constant FLAG_HAS_COMMITTED = 0x8;
uint32 constant FLAG_HAS_REVEALED = 0x10;
uint32 constant FLAG_HAS_SHARED_KEYS = 0x20;
uint32 constant FLAG_DECK_COMMITTED = 0x40;
uint32 constant FLAG_CLAIMED_MAFIA = 0x80;
uint32 constant FLAG_CLAIMED_DETECTIVE = 0x100;

event RoomCreated(uint256 indexed roomId, address host, string name, uint256 maxPlayers);
event PlayerJoined(uint256 indexed roomId, address player, string nickname, address sessionKey);
event GameStarted(uint256 indexed roomId);
event DeckCommitted(uint256 indexed roomId, address player, bytes32 commitHash);
event DeckRevealed(uint256 indexed roomId, address player, string[] deck);
event PlayerKicked(uint256 indexed roomId, address player, string reason);
event KeysSharedToAll(uint256 indexed roomId, address from);
event AllKeysShared(uint256 indexed roomId);
event RoleConfirmed(uint256 indexed roomId, address player);
event AllRolesConfirmed(uint256 indexed roomId);
event DayStarted(uint256 indexed roomId, uint256 dayNumber);
event VotingStarted(uint256 indexed roomId);
event VoteCast(uint256 indexed roomId, address voter, address target);
event VotingFinalized(uint256 indexed roomId, address eliminated, uint256 voteCount);
event NightStarted(uint256 indexed roomId);
event NightActionCommitted(uint256 indexed roomId, address player, bytes32 commitHash);
event NightActionRevealed(uint256 indexed roomId, address player, NightActionType action, address target);
event NightFinalized(uint256 indexed roomId, address killed, address healed);
event PhaseTimeout(uint256 indexed roomId, GamePhase phase);
event PlayerEliminated(uint256 indexed roomId, address player, string reason);
event GameEnded(uint256 indexed roomId, string winCondition);
event SessionKeyRegistered(address indexed mainWallet, address indexed sessionKey, uint256 roomId, uint256 expiresAt);
event SessionKeyRevoked(address indexed mainWallet, address indexed sessionKey);
event EmergencyPause(address indexed admin);
event EmergencyUnpause(address indexed admin);
event RoleCommitted(uint256 indexed roomId, address player, bytes32 commitHash);
event RoleRevealed(uint256 indexed roomId, address player, Role role);
event MafiaMessageSent(uint256 indexed roomId, address sender, bytes encryptedMessage);
event MafiaTargetCommitted(uint256 indexed roomId, address player, bytes32 commitHash);
event MafiaTargetRevealed(uint256 indexed roomId, address player, address target);
event MafiaConsensusReached(uint256 indexed roomId, address target, bool success);
event MafiaCheaterPunished(uint256 indexed roomId, address cheater, Role actualRole);

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
error AlreadySharedKeys();
error SessionExpired();
error SessionNotForThisRoom();
error InvalidSessionKey();
error InvalidArrayLength();
error PhaseDeadlinePassed();
error SessionAlreadyRegistered();
error InvalidSessionAddress();
error ArrayTooLarge();
error NicknameTooLong();
error PublicKeyTooLong();
error RoleAlreadyCommitted();
error RoleAlreadyRevealed();
error InvalidRoleReveal();
error NotMafiaMember();
error MafiaTargetAlreadyCommitted();
error MafiaTargetAlreadyRevealed();
error InvalidMafiaTargetReveal();
error MafiaNotReady();
error NotEnoughPlayers();
error NotAllRolesRevealed();
error WinConditionNotMet();
error RoleNotCommitted();
error NotCommitted();
error InvalidPlayerCount();
error SaltTooLong();
error RoomNameTooLong();

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

constructor() {
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
}

function setZkVerifier(address v) external onlyRole(ADMIN_ROLE) {
    zkVerifier = v;
}

function pause() external onlyRole(ADMIN_ROLE) {
    _pause();
    emit EmergencyPause(msg.sender);
}

function unpause() external onlyRole(ADMIN_ROLE) {
    _unpause();
    emit EmergencyUnpause(msg.sender);
}

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
    if (sessionAddress == address(0)) revert InvalidSessionAddress();
    if (isRegisteredSession[sessionAddress]) revert SessionAlreadyRegistered();
    if (sessionToMain[sessionAddress] != address(0)) revert SessionAlreadyRegistered();
    
    if (sessionKeys[mainWallet].isActive) {
        address oldSession = sessionKeys[mainWallet].sessionAddress;
        delete sessionToMain[oldSession];
        isRegisteredSession[oldSession] = false;
    }

    uint32 expiresAt = uint32(block.timestamp + SESSION_DURATION);
    sessionKeys[mainWallet] = SessionKey({
        sessionAddress: sessionAddress,
        expiresAt: expiresAt,
        roomId: uint64(roomId),
        isActive: true
    });
    sessionToMain[sessionAddress] = mainWallet;
    isRegisteredSession[sessionAddress] = true;
    
    emit SessionKeyRegistered(mainWallet, sessionAddress, roomId, expiresAt);
}

function revokeSessionKey() external {
    SessionKey storage session = sessionKeys[msg.sender];
    if (session.isActive) {
        emit SessionKeyRevoked(msg.sender, session.sessionAddress);
        delete sessionToMain[session.sessionAddress];
        isRegisteredSession[session.sessionAddress] = false;
        session.isActive = false;
    }
}

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

function createAndJoin(
    string calldata roomName,
    uint8 maxPlayers,
    string calldata nickname,
    bytes calldata publicKey,
    address sessionAddress
) external payable nonReentrant whenNotPaused returns (uint256) {
    if (maxPlayers < 4 || maxPlayers > 20) revert InvalidPlayerCount();
    if (bytes(roomName).length > 32) revert RoomNameTooLong();
    
    uint256 roomId = nextRoomId++;
    
    rooms[roomId] = GameRoom({
        id: uint64(roomId),
        host: msg.sender,
        name: roomName,
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
    
    emit RoomCreated(roomId, msg.sender, roomName, maxPlayers);

    if (bytes(nickname).length > 128) revert NicknameTooLong();
    if (publicKey.length > 1024) revert PublicKeyTooLong();

    roomPlayers[roomId].push(Player({
        wallet: msg.sender,
        nickname: nickname,
        publicKey: publicKey,
        flags: FLAG_ACTIVE
    }));
    
    isPlayerInRoom[roomId][msg.sender] = true;
    playerIndex[roomId][msg.sender] = 0;
    rooms[roomId].playersCount = 1;
    rooms[roomId].aliveCount = 1;

    if (sessionAddress != address(0)) {
        _registerSessionKey(msg.sender, sessionAddress, roomId);
        if (msg.value > 0) {
            (bool sent, ) = payable(sessionAddress).call{value: msg.value}("");
            require(sent, "Failed to fund session");
        }
    }

    emit PlayerJoined(roomId, msg.sender, nickname, sessionAddress);
    return roomId;
}

function joinRoom(
    uint256 roomId, 
    string calldata nickname, 
    bytes calldata publicKey,
    address sessionAddress
) external payable nonReentrant whenNotPaused {
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.LOBBY) revert WrongPhase();
    if (room.playersCount >= room.maxPlayers) revert RoomFull();
    if (isPlayerInRoom[roomId][msg.sender]) revert AlreadyJoined();

    if (bytes(nickname).length > 128) revert NicknameTooLong();
    if (publicKey.length > 1024) revert PublicKeyTooLong();

    uint8 idx = uint8(roomPlayers[roomId].length);
    roomPlayers[roomId].push(Player({
        wallet: msg.sender,
        nickname: nickname,
        publicKey: publicKey,
        flags: FLAG_ACTIVE
    }));
    
    isPlayerInRoom[roomId][msg.sender] = true;
    playerIndex[roomId][msg.sender] = idx;
    room.playersCount++;
    room.aliveCount++;

    if (sessionAddress != address(0)) {
        _registerSessionKey(msg.sender, sessionAddress, roomId);
        if (msg.value > 0) {
            (bool sent, ) = payable(sessionAddress).call{value: msg.value}("");
            require(sent, "Failed to fund session");
        }
    }

    emit PlayerJoined(roomId, msg.sender, nickname, sessionAddress);
}

function startGame(uint256 roomId) 
    external nonReentrant onlyActiveParticipant(roomId) whenNotPaused 
{
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.LOBBY) revert WrongPhase();
    if (room.playersCount < 4) revert NotEnoughPlayers();

    room.phase = GamePhase.SHUFFLING;
    room.currentShufflerIndex = _findNextActive(roomId, 0);
    room.lastActionTimestamp = uint32(block.timestamp);
    room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
    
    emit GameStarted(roomId);
}

function commitDeck(uint256 roomId, bytes32 deckHash) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused
{
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.SHUFFLING) revert WrongPhase();
    if (roomPlayers[roomId][room.currentShufflerIndex].wallet != player) revert NotYourTurn();
    if (_hasFlag(roomId, player, FLAG_DECK_COMMITTED)) revert AlreadyCommitted();
    
    deckCommits[roomId][player].commitHash = deckHash;
    deckCommits[roomId][player].revealed = false;
    _setFlag(roomId, player, FLAG_DECK_COMMITTED);
    
    emit DeckCommitted(roomId, player, deckHash);
}

function revealDeck(uint256 roomId, string[] calldata deck, string calldata salt) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused
{
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.SHUFFLING) revert WrongPhase();
    
    bytes32 calculatedHash = keccak256(abi.encode(deck, salt));
    if (calculatedHash != deckCommits[roomId][player].commitHash) revert InvalidReveal();
    
    if (deck.length > MAX_ARRAY_SIZE) revert ArrayTooLarge();
    if (revealedDeck[roomId].length == 0 && deck.length < room.playersCount) revert InvalidDeckSize();
    if (revealedDeck[roomId].length != 0 && deck.length != revealedDeck[roomId].length) revert InvalidDeckSize();
    
    revealedDeck[roomId] = deck;
    deckCommits[roomId][player].revealed = true;
    
    uint8 nextIndex = _findNextActive(roomId, room.currentShufflerIndex + 1);
    room.currentShufflerIndex = nextIndex;
    room.lastActionTimestamp = uint32(block.timestamp);
    room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
    room.revealedCount++;

    emit DeckRevealed(roomId, player, deck);

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
    
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        if ((players[i].flags & FLAG_ACTIVE) != 0) {
            players[i].flags &= ~(FLAG_HAS_SHARED_KEYS | FLAG_CONFIRMED_ROLE | FLAG_DECK_COMMITTED);
        }
    }
}

function _findNextActive(uint256 roomId, uint8 startIndex) internal view returns (uint8) {
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = startIndex; i < players.length; i++) {
        if ((players[i].flags & FLAG_ACTIVE) != 0) return i;
    }
    return uint8(players.length);
}

function shareKeysToAll(
    uint256 roomId, 
    address[] calldata recipients, 
    bytes[] calldata encryptedKeys
) external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused {
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    
    if (room.phase != GamePhase.REVEAL) revert WrongPhase();
    if (recipients.length != encryptedKeys.length) revert InvalidArrayLength();
    if (recipients.length > MAX_ARRAY_SIZE) revert ArrayTooLarge();
    if (_hasFlag(roomId, player, FLAG_HAS_SHARED_KEYS)) revert AlreadySharedKeys();
    
    for (uint256 i = 0; i < recipients.length; i++) {
        address to = recipients[i];
        if (!isPlayerInRoom[roomId][to]) revert NotParticipant();
        if (to == player) revert InvalidSessionAddress();
        playerDeckKeys[roomId][player][to] = encryptedKeys[i];
    }
    
    _setFlag(roomId, player, FLAG_HAS_SHARED_KEYS);
    room.keysSharedCount++;
    emit KeysSharedToAll(roomId, player);
    if (room.keysSharedCount == room.aliveCount) emit AllKeysShared(roomId);
}

function commitAndConfirmRole(uint256 roomId, bytes32 roleHash) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused 
{
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    
    if (room.phase != GamePhase.REVEAL) revert WrongPhase();
    if (roleCommits[roomId][player] != bytes32(0)) revert RoleAlreadyCommitted();
    if (_hasFlag(roomId, player, FLAG_CONFIRMED_ROLE)) revert AlreadyRevealed();

    roleCommits[roomId][player] = roleHash;
    emit RoleCommitted(roomId, player, roleHash);

    _setFlag(roomId, player, FLAG_CONFIRMED_ROLE);
    room.confirmedCount++;
    emit RoleConfirmed(roomId, player);

    if (room.confirmedCount == room.aliveCount) {
        _transitionToDay(roomId);
        emit AllRolesConfirmed(roomId);
    }
}

function commitRole(uint256 roomId, bytes32 roleHash) 
    external nonReentrant onlyActiveParticipant(roomId) whenNotPaused 
{
    address player = _resolvePlayer(roomId);
    if (rooms[roomId].phase != GamePhase.REVEAL) revert WrongPhase();
    if (roleCommits[roomId][player] != bytes32(0)) revert RoleAlreadyCommitted();
    roleCommits[roomId][player] = roleHash;
    emit RoleCommitted(roomId, player, roleHash);
}

function confirmRole(uint256 roomId) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused
{
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.REVEAL) revert WrongPhase();
    if (_hasFlag(roomId, player, FLAG_CONFIRMED_ROLE)) revert AlreadyRevealed();
    
    _setFlag(roomId, player, FLAG_CONFIRMED_ROLE);
    room.confirmedCount++;
    emit RoleConfirmed(roomId, player);
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

function startVoting(uint256 roomId) external nonReentrant onlyActiveParticipant(roomId) whenNotPaused {
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.DAY) revert WrongPhase();
    room.phase = GamePhase.VOTING;
    room.votedCount = 0;
    room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
    
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        address p = players[i].wallet;
        players[i].flags &= ~FLAG_HAS_VOTED;
        votes[roomId][p] = address(0);
        if ((players[i].flags & FLAG_ACTIVE) != 0) voteCounts[roomId][p] = 0;
    }
    emit VotingStarted(roomId);
}

function vote(uint256 roomId, address target) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused
{
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.VOTING) revert WrongPhase();
    if (!isPlayerInRoom[roomId][target]) revert NotParticipant();
    if (!_hasFlag(roomId, target, FLAG_ACTIVE)) revert PlayerInactive();
    
    bool alreadyVoted = _hasFlag(roomId, player, FLAG_HAS_VOTED);
    address oldTarget = votes[roomId][player];
    if (oldTarget != address(0) && voteCounts[roomId][oldTarget] > 0) voteCounts[roomId][oldTarget]--;

    votes[roomId][player] = target;
    voteCounts[roomId][target]++;
    
    if (!alreadyVoted) {
        _setFlag(roomId, player, FLAG_HAS_VOTED);
        room.votedCount++;
    }
    emit VoteCast(roomId, player, target);
    
    if (room.votedCount == room.aliveCount) _finalizeVoting(roomId);
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
            if (v > maxVotes) { maxVotes = v; victim = p; }
        }
    }

    if (maxVotes > room.aliveCount / 2 && victim != address(0)) {
        _killPlayer(roomId, victim);
        emit PlayerEliminated(roomId, victim, "Voted out");
        emit VotingFinalized(roomId, victim, maxVotes);
    } else {
        emit VotingFinalized(roomId, address(0), 0);
    }

    _resetVotingState(roomId);
    if (!_checkWinCondition(roomId)) _transitionToNight(roomId);
}

function _transitionToNight(uint256 roomId) internal {
    GameRoom storage room = rooms[roomId];
    room.phase = GamePhase.NIGHT;
    room.committedCount = 0;
    room.revealedCount = 0;
    room.phaseDeadline = uint32(block.timestamp + NIGHT_TIMEOUT);
    
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        address p = players[i].wallet;
        players[i].flags &= ~(FLAG_HAS_COMMITTED | FLAG_HAS_REVEALED);
        delete nightCommits[roomId][p];
        delete revealedActions[roomId][p];
        delete revealedTargets[roomId][p];
        delete mafiaTargetCommits[roomId][p];
    }
    
    mafiaCommittedCount[roomId] = 0;
    mafiaRevealedCount[roomId] = 0;
    mafiaConsensusTarget[roomId] = address(0);
    emit NightStarted(roomId);
}

function endNight(uint256 roomId) 
    external nonReentrant onlyActiveParticipant(roomId) whenNotPaused 
{
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.NIGHT) revert WrongPhase();
    
    uint8 mafiaCommitted = mafiaCommittedCount[roomId];
    if (mafiaCommitted > 0 && mafiaRevealedCount[roomId] < mafiaCommitted) revert MafiaNotReady();
    if (room.revealedCount < room.committedCount) revert InvalidReveal();
    
    _finalizeNight(roomId);
}

function commitNightAction(uint256 roomId, bytes32 hash) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused
{
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.NIGHT) revert WrongPhase();
    if (_hasFlag(roomId, player, FLAG_HAS_COMMITTED)) revert AlreadyCommitted();
    
    nightCommits[roomId][player] = NightCommit({
        commitHash: hash,
        revealed: false,
        commitTime: uint32(block.timestamp)
    });
    _setFlag(roomId, player, FLAG_HAS_COMMITTED);
    room.committedCount++;
    emit NightActionCommitted(roomId, player, hash);
}

function revealNightAction(
    uint256 roomId, 
    NightActionType action, 
    address target, 
    string calldata salt
) external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused {
    address player = _resolvePlayer(roomId);
    GameRoom storage room = rooms[roomId];
    if (room.phase != GamePhase.NIGHT) revert WrongPhase();
    if (_hasFlag(roomId, player, FLAG_HAS_REVEALED)) revert AlreadyRevealed();
    if (action == NightActionType.KILL) revert Unauthorized();
    if (!_hasFlag(roomId, player, FLAG_HAS_COMMITTED)) revert NotCommitted();
    
    if (action != NightActionType.NONE && target != address(0)) {
        if (!isPlayerInRoom[roomId][target]) revert NotParticipant();
        if (!_hasFlag(roomId, target, FLAG_ACTIVE)) revert PlayerInactive();
    }

    bytes32 calculatedHash = keccak256(abi.encode(action, target, salt));
    if (calculatedHash != nightCommits[roomId][player].commitHash) revert InvalidReveal();

    nightCommits[roomId][player].revealed = true;
    revealedActions[roomId][player] = action;
    revealedTargets[roomId][player] = target;
    _setFlag(roomId, player, FLAG_HAS_REVEALED);
    room.revealedCount++;

    if (action == NightActionType.CHECK) {
        _setFlag(roomId, player, FLAG_CLAIMED_DETECTIVE);
    }

    emit NightActionRevealed(roomId, player, action, target);
}

function sendMafiaMessage(uint256 roomId, bytes calldata encryptedMessage) 
    external nonReentrant onlyActiveParticipant(roomId) whenNotPaused 
{
    address player = _resolvePlayer(roomId);
    if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
    if (roleCommits[roomId][player] == bytes32(0)) revert RoleNotCommitted();
    if (encryptedMessage.length > 1024) revert ArrayTooLarge();
    
    _setFlag(roomId, player, FLAG_CLAIMED_MAFIA);
    mafiaChat[roomId].push(MafiaMessage({
        encryptedMessage: encryptedMessage,
        timestamp: uint32(block.timestamp),
        sender: player
    }));
    emit MafiaMessageSent(roomId, player, encryptedMessage);
}

function commitMafiaTarget(uint256 roomId, bytes32 targetHash) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused 
{
    address player = _resolvePlayer(roomId);
    if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
    if (roleCommits[roomId][player] == bytes32(0)) revert RoleNotCommitted();
    if (mafiaTargetCommits[roomId][player].commitHash != bytes32(0)) revert MafiaTargetAlreadyCommitted();
    
    _setFlag(roomId, player, FLAG_CLAIMED_MAFIA);
    mafiaTargetCommits[roomId][player].commitHash = targetHash;
    mafiaCommittedCount[roomId]++;
    emit MafiaTargetCommitted(roomId, player, targetHash);
}

function revealMafiaTarget(uint256 roomId, address target, string calldata salt) 
    external nonReentrant onlyActiveParticipant(roomId) beforeDeadline(roomId) whenNotPaused 
{
    address player = _resolvePlayer(roomId);
    if (rooms[roomId].phase != GamePhase.NIGHT) revert WrongPhase();
    if (roleCommits[roomId][player] == bytes32(0)) revert RoleNotCommitted();
    if (mafiaTargetCommits[roomId][player].revealed) revert MafiaTargetAlreadyRevealed();
    
    _setFlag(roomId, player, FLAG_CLAIMED_MAFIA);
    if (target != address(0)) {
        if (!isPlayerInRoom[roomId][target]) revert NotParticipant();
        if (!_hasFlag(roomId, target, FLAG_ACTIVE)) revert PlayerInactive();
    }
    
    bytes32 calculatedHash = keccak256(abi.encode(target, salt));
    if (calculatedHash != mafiaTargetCommits[roomId][player].commitHash) revert InvalidMafiaTargetReveal();
    
    mafiaTargetCommits[roomId][player].target = target;
    mafiaTargetCommits[roomId][player].revealed = true;
    mafiaRevealedCount[roomId]++;
    emit MafiaTargetRevealed(roomId, player, target);
    
    if (mafiaRevealedCount[roomId] == mafiaCommittedCount[roomId]) _checkMafiaConsensus(roomId);
}

function _checkMafiaConsensus(uint256 roomId) internal {
    if (mafiaCommittedCount[roomId] == 0) return;
    address firstTarget = address(0);
    bool firstSet = false;
    bool consensus = true;
    
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        address p = players[i].wallet;
        if (mafiaTargetCommits[roomId][p].revealed && (players[i].flags & FLAG_ACTIVE) != 0) {
            address target = mafiaTargetCommits[roomId][p].target;
            if (!firstSet) { firstTarget = target; firstSet = true; }
            else if (target != firstTarget) { consensus = false; break; }
        }
    }
    address consensusTarget = (consensus && firstTarget != address(0)) ? firstTarget : address(0);
    mafiaConsensusTarget[roomId] = consensusTarget;
    emit MafiaConsensusReached(roomId, consensusTarget, consensus && firstTarget != address(0));
}

function _finalizeNight(uint256 roomId) internal {
    address mafiaTarget = mafiaConsensusTarget[roomId];
    address healed = address(0);
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        address p = players[i].wallet;
        if (revealedActions[roomId][p] == NightActionType.HEAL) {
            healed = revealedTargets[roomId][p];
            break;
        }
    }

    emit NightFinalized(roomId, mafiaTarget, healed);
    if (mafiaTarget != address(0) && mafiaTarget != healed) {
        _killPlayer(roomId, mafiaTarget);
        emit PlayerEliminated(roomId, mafiaTarget, "Killed at night");
    }
    _resetNightState(roomId);
    if (!_checkWinCondition(roomId)) _transitionToDay(roomId);
}

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

function _checkWinCondition(uint256 roomId) internal returns (bool) {
    GameRoom storage room = rooms[roomId];
    if (room.aliveCount <= 1) {
        _endGame(roomId, room.aliveCount == 0 ? "Draw" : "Last player standing");
        return true;
    }
    if (_allRolesRevealed(roomId)) {
        (bool mafiaWins, bool townWins) = _calculateWinCondition(roomId);
        if (mafiaWins) { _endGame(roomId, "Mafia wins"); return true; }
        else if (townWins) { _endGame(roomId, "Town wins"); return true; }
    }
    return false;
}

function endGameAutomatically(uint256 roomId) external nonReentrant onlyActiveParticipant(roomId) whenNotPaused {
    GameRoom storage room = rooms[roomId];
    if (room.phase == GamePhase.LOBBY || room.phase == GamePhase.ENDED) revert WrongPhase();
    if (!_allRolesRevealed(roomId)) revert NotAllRolesRevealed();
    
    (bool mafiaWins, bool townWins) = _calculateWinCondition(roomId);
    if (mafiaWins) _endGame(roomId, "Mafia wins");
    else if (townWins) _endGame(roomId, "Town wins");
    else revert WinConditionNotMet();
}

function _allRolesRevealed(uint256 roomId) internal view returns (bool) {
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        if ((players[i].flags & FLAG_ACTIVE) != 0 && playerRoles[roomId][players[i].wallet] == Role.NONE) return false;
    }
    return true;
}

function _calculateWinCondition(uint256 roomId) internal view returns (bool mafiaWins, bool townWins) {
    uint8 mafiaCount = 0;
    uint8 townCount = 0;
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        if ((players[i].flags & FLAG_ACTIVE) != 0) {
            Role role = playerRoles[roomId][players[i].wallet];
            if (role == Role.MAFIA) mafiaCount++;
            else if (role != Role.NONE) townCount++;
        }
    }
    return (mafiaCount > 0 && mafiaCount >= townCount, mafiaCount == 0 && townCount > 0);
}

function _endGame(uint256 roomId, string memory reason) internal {
    rooms[roomId].phase = GamePhase.ENDED;
    rooms[roomId].phaseDeadline = 0;
    emit GameEnded(roomId, reason);
}

function revealRole(uint256 roomId, Role role, string calldata salt) 
    external nonReentrant onlyActiveParticipant(roomId) whenNotPaused 
{
    address player = _resolvePlayer(roomId);
    if (playerRoles[roomId][player] != Role.NONE) revert RoleAlreadyRevealed();
    if (roleCommits[roomId][player] == bytes32(0)) revert RoleNotCommitted();
    if (bytes(salt).length > 64) revert SaltTooLong();
    
    bytes32 calculatedHash = keccak256(abi.encode(role, salt));
    if (calculatedHash != roleCommits[roomId][player]) revert InvalidRoleReveal();
    
    playerRoles[roomId][player] = role;
    emit RoleRevealed(roomId, player, role);
    
    if (_hasFlag(roomId, player, FLAG_CLAIMED_MAFIA) && role != Role.MAFIA) {
        _killPlayer(roomId, player);
        emit MafiaCheaterPunished(roomId, player, role);
        emit PlayerEliminated(roomId, player, "Used mafia functions with non-mafia role");
    }

    if (_hasFlag(roomId, player, FLAG_CLAIMED_DETECTIVE) && role != Role.DETECTIVE) {
        _killPlayer(roomId, player);
        emit PlayerEliminated(roomId, player, "Used detective check with non-detective role");
    }
}

function forcePhaseTimeout(uint256 roomId) external nonReentrant onlyActiveParticipant(roomId) whenNotPaused {
    GameRoom storage room = rooms[roomId];
    if (room.phaseDeadline == 0 || block.timestamp <= room.phaseDeadline) revert TimeNotExpired();
    
    emit PhaseTimeout(roomId, room.phase);
    if (room.phase == GamePhase.SHUFFLING) _kickCurrentShuffler(roomId);
    else if (room.phase == GamePhase.REVEAL) {
        _kickUnconfirmedPlayers(roomId);
        if (room.aliveCount >= 2) _transitionToDay(roomId); else _endGame(roomId, "Too few players remaining");
    }
    else if (room.phase == GamePhase.VOTING) _finalizeVoting(roomId);
    else if (room.phase == GamePhase.NIGHT) _finalizeNight(roomId);
    else if (room.phase == GamePhase.DAY) {
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
    
    uint8 nextIndex = _findNextActive(roomId, room.currentShufflerIndex + 1);
    room.currentShufflerIndex = nextIndex;
    room.lastActionTimestamp = uint32(block.timestamp);
    room.phaseDeadline = uint32(block.timestamp + PHASE_TIMEOUT);
    
    if (nextIndex >= roomPlayers[roomId].length) {
        if (room.aliveCount >= 2) _transitionToReveal(roomId); else _endGame(roomId, "Too few players remaining");
    }
}

function _kickUnconfirmedPlayers(uint256 roomId) internal {
    Player[] storage players = roomPlayers[roomId];
    for (uint8 i = 0; i < players.length; i++) {
        if ((players[i].flags & FLAG_ACTIVE) != 0) {
            bool shared = (players[i].flags & FLAG_HAS_SHARED_KEYS) != 0;
            bool confirmed = (players[i].flags & FLAG_CONFIRMED_ROLE) != 0;
            if (!shared || !confirmed) {
                _killPlayer(roomId, players[i].wallet);
                emit PlayerKicked(roomId, players[i].wallet, "Timeout during reveal");
            }
        }
    }
}

function withdrawFees() external onlyRole(ADMIN_ROLE) {
    (bool sent, ) = payable(msg.sender).call{value: address(this).balance}("");
    require(sent, "Failed to withdraw");
}

function getPlayers(uint256 roomId) external view returns (Player[] memory) {
    return roomPlayers[roomId];
}

function getDeck(uint256 roomId) external view returns (string[] memory) {
    return revealedDeck[roomId];
}

function getRoom(uint256 roomId) external view returns (GameRoom memory) {
    return rooms[roomId];
}

function getKeyFromTo(uint256 roomId, address from, address to) external view returns (bytes memory) {
    return playerDeckKeys[roomId][from][to];
}

function getAllKeysForMe(uint256 roomId) external view returns (address[] memory senders, bytes[] memory keys) {
    address player = sessionToMain[msg.sender] != address(0) ? sessionToMain[msg.sender] : msg.sender;
    Player[] storage players = roomPlayers[roomId];
    uint8 count = 0;
    for (uint8 i = 0; i < players.length; i++) {
        if (players[i].wallet != player && playerDeckKeys[roomId][players[i].wallet][player].length > 0) count++;
    }
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
}

function getPlayerFlags(uint256 roomId, address player) external view returns (
    bool isActive, bool hasConfirmedRole, bool hasVoted, bool hasCommitted, bool hasRevealed, bool hasSharedKeys, bool hasClaimedMafia
) {
    uint8 idx = playerIndex[roomId][player];
    uint32 flags = roomPlayers[roomId][idx].flags;
    return (
        (flags & FLAG_ACTIVE) != 0,
        (flags & FLAG_CONFIRMED_ROLE) != 0,
        (flags & FLAG_HAS_VOTED) != 0,
        (flags & FLAG_HAS_COMMITTED) != 0,
        (flags & FLAG_HAS_REVEALED) != 0,
        (flags & FLAG_HAS_SHARED_KEYS) != 0,
        (flags & FLAG_CLAIMED_MAFIA) != 0
    );
}

function getPhaseDeadline(uint256 roomId) external view returns (uint32) {
    return rooms[roomId].phaseDeadline;
}

function getAliveMafiaCount(uint256 roomId) public view returns (uint8) {
    return mafiaCommittedCount[roomId];
}

function getRevealedMafiaCount(uint256 roomId) public view returns (uint8) { 
    uint8 count = 0;
    for(uint8 i = 0; i < roomPlayers[roomId].length; i++) {
        address p = roomPlayers[roomId][i].wallet;
        if(playerRoles[roomId][p] == Role.MAFIA && (roomPlayers[roomId][i].flags & FLAG_ACTIVE) != 0) count++;
    }
    return count;
}

function getMafiaChat(uint256 roomId) external view returns (MafiaMessage[] memory) {
    return mafiaChat[roomId];
}

function getMafiaConsensus(uint256 roomId) external view returns (uint8 committed, uint8 revealed, address consensusTarget) {
    return (mafiaCommittedCount[roomId], mafiaRevealedCount[roomId], mafiaConsensusTarget[roomId]);
}

function endGameZK(
    uint256 roomId,
    uint[2] calldata a,
    uint[2][2] calldata b,
    uint[2] calldata c,
    uint[5] calldata input  
) external nonReentrant whenNotPaused {
    GameRoom storage room = rooms[roomId];
    if (room.phase == GamePhase.LOBBY || room.phase == GamePhase.ENDED) revert WrongPhase();
    require(zkVerifier != address(0), "Verifier not set");

    bool proofOk = IGroth16Verifier(zkVerifier).verifyProof(a, b, c, input);
    require(proofOk, "Invalid ZK proof");

    uint256 townWin    = input[0];
    uint256 mafiaWin   = input[1];
    uint256 proofRoomId = input[2];
    uint256 mafiaCount = input[3];
    uint256 townCount  = input[4];

    require(proofRoomId == roomId, "RoomId mismatch");
    require(townCount > 0, "No town players");
    require(mafiaCount + townCount > 0, "Empty game");

    if (townWin == 1) {
        _endGame(roomId, "Town wins (ZK)");
    } else if (mafiaWin == 1) {
        _endGame(roomId, "Mafia wins (ZK)");
    } else {
        revert("ZK: no winner");
    }
}

}