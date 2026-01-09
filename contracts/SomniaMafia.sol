// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IZKVerifier {
    function verifyProof(bytes calldata proof, uint256[] calldata publicInputs) external view returns (bool);
}

contract SomniaMafia {
    enum GamePhase { LOBBY, SHUFFLE, NIGHT, DAY, VOTING, ENDED }

    struct Player {
        address wallet;
        uint256 stake;
        bool isAlive;
        bool hasActed;
    }

    uint256 public constant MIN_STAKE = 0.01 ether;
    uint256 public constant ACTION_TIMEOUT = 120 seconds;
    uint8 public constant MAX_PLAYERS = 8;

    GamePhase public currentPhase;
    uint256 public lastPhaseChangeTime;
    address[] public playerAddresses;
    
    mapping(address => Player) public players;
    mapping(address => bool) public hasJoined;
    mapping(address => address) public votes;
    mapping(address => uint256) public voteCounts;

    IZKVerifier public verifier;

    event PlayerJoined(address indexed player, uint256 stake);
    event PhaseChanged(GamePhase newPhase);
    event ActionSubmitted(address indexed player, string actionType);
    event PlayerSlashed(address indexed player, uint256 amount);
    event PlayerEliminated(address indexed player);
    event GameReset();

    constructor(address _verifier) {
        verifier = IZKVerifier(_verifier);
        currentPhase = GamePhase.LOBBY;
    }

    modifier onlyPhase(GamePhase _phase) {
        require(currentPhase == _phase, "Invalid phase");
        _;
    }

    modifier onlyAlive() {
        require(players[msg.sender].isAlive, "Player is dead");
        _;
    }

    function joinGame() external payable {
        require(currentPhase == GamePhase.LOBBY, "Game active");
        require(msg.value >= MIN_STAKE, "Stake too low");
        require(!hasJoined[msg.sender], "Already joined");
        require(playerAddresses.length < MAX_PLAYERS, "Lobby full");

        players[msg.sender] = Player({
            wallet: msg.sender,
            stake: msg.value,
            isAlive: true,
            hasActed: false
        });

        hasJoined[msg.sender] = true;
        playerAddresses.push(msg.sender);

        emit PlayerJoined(msg.sender, msg.value);

        if (playerAddresses.length == MAX_PLAYERS) {
            _setPhase(GamePhase.SHUFFLE);
        }
    }

    function submitShuffleProof(bytes calldata proof, uint256[] calldata inputs) external onlyPhase(GamePhase.SHUFFLE) onlyAlive {
        require(!players[msg.sender].hasActed, "Already submitted");
        require(verifier.verifyProof(proof, inputs), "Invalid ZK proof");

        players[msg.sender].hasActed = true;
        emit ActionSubmitted(msg.sender, "SHUFFLE");

        if (_checkAllActed()) {
            _setPhase(GamePhase.NIGHT);
        }
    }

    function commitNightAction(bytes32 actionHash) external onlyPhase(GamePhase.NIGHT) onlyAlive {
        require(!players[msg.sender].hasActed, "Already acted");
        
        players[msg.sender].hasActed = true;
        emit ActionSubmitted(msg.sender, "NIGHT_COMMIT");

        if (_checkAllActed()) {
            _setPhase(GamePhase.DAY);
        }
    }

    function castVote(address target) external onlyPhase(GamePhase.VOTING) onlyAlive {
        require(players[target].isAlive, "Target dead");
        require(votes[msg.sender] == address(0), "Already voted");

        votes[msg.sender] = target;
        voteCounts[target]++;
        players[msg.sender].hasActed = true;
        
        emit ActionSubmitted(msg.sender, "VOTE");

        if (_checkAllActed()) {
            _resolveVoting();
        }
    }

    function slashTimeout(address target) external {
        require(currentPhase != GamePhase.LOBBY && currentPhase != GamePhase.ENDED, "Cannot slash");
        require(block.timestamp > lastPhaseChangeTime + ACTION_TIMEOUT, "Timeout not reached");
        require(players[target].isAlive && !players[target].hasActed, "Invalid target");

        uint256 slashedAmount = players[target].stake;
        players[target].stake = 0;
        players[target].isAlive = false;
        
        emit PlayerSlashed(target, slashedAmount);

        if (_checkAllActed()) {
             _advancePhase();
        }
    }

    function _setPhase(GamePhase _nextPhase) internal {
        currentPhase = _nextPhase;
        lastPhaseChangeTime = block.timestamp;
        _resetTurn();
        emit PhaseChanged(_nextPhase);
    }

    function _resetTurn() internal {
        for (uint i = 0; i < playerAddresses.length; i++) {
            address p = playerAddresses[i];
            players[p].hasActed = false;
            votes[p] = address(0);
            voteCounts[p] = 0;
        }
    }

    function _checkAllActed() internal view returns (bool) {
        for (uint i = 0; i < playerAddresses.length; i++) {
            if (players[playerAddresses[i]].isAlive && !players[playerAddresses[i]].hasActed) {
                return false;
            }
        }
        return true;
    }

    function _resolveVoting() internal {
        address maxVoted = address(0);
        uint256 maxCount = 0;
        bool tie = false;

        for (uint i = 0; i < playerAddresses.length; i++) {
            address p = playerAddresses[i];
            if (players[p].isAlive) {
                if (voteCounts[p] > maxCount) {
                    maxCount = voteCounts[p];
                    maxVoted = p;
                    tie = false;
                } else if (voteCounts[p] == maxCount && maxCount > 0) {
                    tie = true;
                }
            }
        }

        if (maxVoted != address(0) && !tie) {
            players[maxVoted].isAlive = false;
            emit PlayerEliminated(maxVoted);
        }

        _setPhase(GamePhase.NIGHT);
    }

    function _advancePhase() internal {
        if (currentPhase == GamePhase.SHUFFLE) _setPhase(GamePhase.NIGHT);
        else if (currentPhase == GamePhase.NIGHT) _setPhase(GamePhase.DAY);
        else if (currentPhase == GamePhase.DAY) _setPhase(GamePhase.VOTING);
        else if (currentPhase == GamePhase.VOTING) _resolveVoting();
    }
}