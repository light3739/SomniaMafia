export const MafiaABI = 
{
  "_format": "hh3-artifact-1",
  "contractName": "MafiaPortal",
  "sourceName": "contracts/MafiaPortal.sol",
  "abi": [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "AccessControlBadConfirmation",
      "type": "error"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "internalType": "bytes32",
          "name": "neededRole",
          "type": "bytes32"
        }
      ],
      "name": "AccessControlUnauthorizedAccount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "AlreadyCommitted",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "AlreadyJoined",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "AlreadyRevealed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "AlreadySharedKeys",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "AlreadyVoted",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ArrayTooLarge",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "EnforcedPause",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ExpectedPause",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidArrayLength",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidDeckSize",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidMafiaTargetReveal",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidPlayerCount",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidReveal",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidRoleReveal",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidSessionAddress",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidSessionKey",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "MafiaNotReady",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "MafiaTargetAlreadyCommitted",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "MafiaTargetAlreadyRevealed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NicknameTooLong",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NoStalledPlayers",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotAllRolesRevealed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotCommitted",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotEnoughPlayers",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotMafiaMember",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotParticipant",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotYourTurn",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "PhaseDeadlinePassed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "PlayerInactive",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "PublicKeyTooLong",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "ReentrancyGuardReentrantCall",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "RoleAlreadyCommitted",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "RoleAlreadyRevealed",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "RoleNotCommitted",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "RoomFull",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "RoomNameTooLong",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "SaltTooLong",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "SessionAlreadyRegistered",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "SessionExpired",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "SessionNotForThisRoom",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "TimeNotExpired",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "Unauthorized",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "WinConditionNotMet",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "WrongPhase",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "AllKeysShared",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "AllRolesConfirmed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "dayNumber",
          "type": "uint256"
        }
      ],
      "name": "DayStarted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        }
      ],
      "name": "DeckCommitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string[]",
          "name": "deck",
          "type": "string[]"
        }
      ],
      "name": "DeckRevealed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "admin",
          "type": "address"
        }
      ],
      "name": "EmergencyPause",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "admin",
          "type": "address"
        }
      ],
      "name": "EmergencyUnpause",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "winCondition",
          "type": "string"
        }
      ],
      "name": "GameEnded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "GameStarted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "from",
          "type": "address"
        }
      ],
      "name": "KeysSharedToAll",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "cheater",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "enum MafiaPortal.Role",
          "name": "actualRole",
          "type": "uint8"
        }
      ],
      "name": "MafiaCheaterPunished",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "target",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "success",
          "type": "bool"
        }
      ],
      "name": "MafiaConsensusReached",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bytes",
          "name": "encryptedMessage",
          "type": "bytes"
        }
      ],
      "name": "MafiaMessageSent",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        }
      ],
      "name": "MafiaTargetCommitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "target",
          "type": "address"
        }
      ],
      "name": "MafiaTargetRevealed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        }
      ],
      "name": "NightActionCommitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "enum MafiaPortal.NightActionType",
          "name": "action",
          "type": "uint8"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "target",
          "type": "address"
        }
      ],
      "name": "NightActionRevealed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "killed",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "healed",
          "type": "address"
        }
      ],
      "name": "NightFinalized",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "NightStarted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "Paused",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "enum MafiaPortal.GamePhase",
          "name": "phase",
          "type": "uint8"
        }
      ],
      "name": "PhaseTimeout",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "reason",
          "type": "string"
        }
      ],
      "name": "PlayerEliminated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "nickname",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "sessionKey",
          "type": "address"
        }
      ],
      "name": "PlayerJoined",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "reason",
          "type": "string"
        }
      ],
      "name": "PlayerKicked",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "previousAdminRole",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "newAdminRole",
          "type": "bytes32"
        }
      ],
      "name": "RoleAdminChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        }
      ],
      "name": "RoleCommitted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        }
      ],
      "name": "RoleConfirmed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sender",
          "type": "address"
        }
      ],
      "name": "RoleGranted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "player",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "enum MafiaPortal.Role",
          "name": "role",
          "type": "uint8"
        }
      ],
      "name": "RoleRevealed",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "account",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sender",
          "type": "address"
        }
      ],
      "name": "RoleRevoked",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "host",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "maxPlayers",
          "type": "uint256"
        }
      ],
      "name": "RoomCreated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "mainWallet",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sessionKey",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "expiresAt",
          "type": "uint256"
        }
      ],
      "name": "SessionKeyRegistered",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "mainWallet",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "sessionKey",
          "type": "address"
        }
      ],
      "name": "SessionKeyRevoked",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "Unpaused",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "target",
          "type": "address"
        }
      ],
      "name": "VoteCast",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "address",
          "name": "eliminated",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "voteCount",
          "type": "uint256"
        }
      ],
      "name": "VotingFinalized",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "VotingStarted",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "ADMIN_ROLE",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "DEFAULT_ADMIN_ROLE",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_ARRAY_SIZE",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "NIGHT_TIMEOUT",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "PHASE_TIMEOUT",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "SESSION_DURATION",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "TURN_TIMEOUT",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "roleHash",
          "type": "bytes32"
        }
      ],
      "name": "commitAndConfirmRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "deckHash",
          "type": "bytes32"
        }
      ],
      "name": "commitDeck",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "targetHash",
          "type": "bytes32"
        }
      ],
      "name": "commitMafiaTarget",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "hash",
          "type": "bytes32"
        }
      ],
      "name": "commitNightAction",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "bytes32",
          "name": "roleHash",
          "type": "bytes32"
        }
      ],
      "name": "commitRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "confirmRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "roomName",
          "type": "string"
        },
        {
          "internalType": "uint8",
          "name": "maxPlayers",
          "type": "uint8"
        },
        {
          "internalType": "string",
          "name": "nickname",
          "type": "string"
        },
        {
          "internalType": "bytes",
          "name": "publicKey",
          "type": "bytes"
        },
        {
          "internalType": "address",
          "name": "sessionAddress",
          "type": "address"
        }
      ],
      "name": "createAndJoin",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "deckCommits",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        },
        {
          "internalType": "bool",
          "name": "revealed",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "endGameAutomatically",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "uint256[2]",
          "name": "a",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[2][2]",
          "name": "b",
          "type": "uint256[2][2]"
        },
        {
          "internalType": "uint256[2]",
          "name": "c",
          "type": "uint256[2]"
        },
        {
          "internalType": "uint256[5]",
          "name": "input",
          "type": "uint256[5]"
        }
      ],
      "name": "endGameZK",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "endNight",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "forcePhaseTimeout",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getAliveMafiaCount",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getAllKeysForMe",
      "outputs": [
        {
          "internalType": "address[]",
          "name": "senders",
          "type": "address[]"
        },
        {
          "internalType": "bytes[]",
          "name": "keys",
          "type": "bytes[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getDeck",
      "outputs": [
        {
          "internalType": "string[]",
          "name": "",
          "type": "string[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "to",
          "type": "address"
        }
      ],
      "name": "getKeyFromTo",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getMafiaChat",
      "outputs": [
        {
          "components": [
            {
              "internalType": "bytes",
              "name": "encryptedMessage",
              "type": "bytes"
            },
            {
              "internalType": "uint32",
              "name": "timestamp",
              "type": "uint32"
            },
            {
              "internalType": "address",
              "name": "sender",
              "type": "address"
            }
          ],
          "internalType": "struct MafiaPortal.MafiaMessage[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getMafiaConsensus",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "committed",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "revealed",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "consensusTarget",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getPhaseDeadline",
      "outputs": [
        {
          "internalType": "uint32",
          "name": "",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "player",
          "type": "address"
        }
      ],
      "name": "getPlayerFlags",
      "outputs": [
        {
          "internalType": "bool",
          "name": "isActive",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasConfirmedRole",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasVoted",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasCommitted",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasRevealed",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasSharedKeys",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "hasClaimedMafia",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getPlayers",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "wallet",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "nickname",
              "type": "string"
            },
            {
              "internalType": "bytes",
              "name": "publicKey",
              "type": "bytes"
            },
            {
              "internalType": "uint32",
              "name": "flags",
              "type": "uint32"
            }
          ],
          "internalType": "struct MafiaPortal.Player[]",
          "name": "",
          "type": "tuple[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getRevealedMafiaCount",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        }
      ],
      "name": "getRoleAdmin",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "getRoom",
      "outputs": [
        {
          "components": [
            {
              "internalType": "uint64",
              "name": "id",
              "type": "uint64"
            },
            {
              "internalType": "address",
              "name": "host",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "enum MafiaPortal.GamePhase",
              "name": "phase",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "maxPlayers",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "playersCount",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "aliveCount",
              "type": "uint8"
            },
            {
              "internalType": "uint16",
              "name": "dayCount",
              "type": "uint16"
            },
            {
              "internalType": "uint8",
              "name": "currentShufflerIndex",
              "type": "uint8"
            },
            {
              "internalType": "uint32",
              "name": "lastActionTimestamp",
              "type": "uint32"
            },
            {
              "internalType": "uint32",
              "name": "phaseDeadline",
              "type": "uint32"
            },
            {
              "internalType": "uint8",
              "name": "confirmedCount",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "votedCount",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "committedCount",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "revealedCount",
              "type": "uint8"
            },
            {
              "internalType": "uint8",
              "name": "keysSharedCount",
              "type": "uint8"
            }
          ],
          "internalType": "struct MafiaPortal.GameRoom",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "grantRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "hasRole",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "isPlayerInRoom",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "isRegisteredSession",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "nickname",
          "type": "string"
        },
        {
          "internalType": "bytes",
          "name": "publicKey",
          "type": "bytes"
        },
        {
          "internalType": "address",
          "name": "sessionAddress",
          "type": "address"
        }
      ],
      "name": "joinRoom",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "mafiaChat",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "encryptedMessage",
          "type": "bytes"
        },
        {
          "internalType": "uint32",
          "name": "timestamp",
          "type": "uint32"
        },
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "mafiaCommittedCount",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "mafiaConsensusTarget",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "mafiaRevealedCount",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "mafiaTargetCommits",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "target",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "revealed",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "nextRoomId",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "nightCommits",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "commitHash",
          "type": "bytes32"
        },
        {
          "internalType": "bool",
          "name": "revealed",
          "type": "bool"
        },
        {
          "internalType": "uint32",
          "name": "commitTime",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "pause",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "paused",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "playerDeckKeys",
      "outputs": [
        {
          "internalType": "bytes",
          "name": "",
          "type": "bytes"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "playerIndex",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "playerRoles",
      "outputs": [
        {
          "internalType": "enum MafiaPortal.Role",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "callerConfirmation",
          "type": "address"
        }
      ],
      "name": "renounceRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "string[]",
          "name": "deck",
          "type": "string[]"
        },
        {
          "internalType": "string",
          "name": "salt",
          "type": "string"
        }
      ],
      "name": "revealDeck",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "target",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "salt",
          "type": "string"
        }
      ],
      "name": "revealMafiaTarget",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "enum MafiaPortal.NightActionType",
          "name": "action",
          "type": "uint8"
        },
        {
          "internalType": "address",
          "name": "target",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "salt",
          "type": "string"
        }
      ],
      "name": "revealNightAction",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "enum MafiaPortal.Role",
          "name": "role",
          "type": "uint8"
        },
        {
          "internalType": "string",
          "name": "salt",
          "type": "string"
        }
      ],
      "name": "revealRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "revealedActions",
      "outputs": [
        {
          "internalType": "enum MafiaPortal.NightActionType",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "revealedDeck",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "revealedTargets",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "role",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "revokeRole",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "revokeSessionKey",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "roleCommits",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "roomPlayers",
      "outputs": [
        {
          "internalType": "address",
          "name": "wallet",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "nickname",
          "type": "string"
        },
        {
          "internalType": "bytes",
          "name": "publicKey",
          "type": "bytes"
        },
        {
          "internalType": "uint32",
          "name": "flags",
          "type": "uint32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "rooms",
      "outputs": [
        {
          "internalType": "uint64",
          "name": "id",
          "type": "uint64"
        },
        {
          "internalType": "address",
          "name": "host",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "enum MafiaPortal.GamePhase",
          "name": "phase",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "maxPlayers",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "playersCount",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "aliveCount",
          "type": "uint8"
        },
        {
          "internalType": "uint16",
          "name": "dayCount",
          "type": "uint16"
        },
        {
          "internalType": "uint8",
          "name": "currentShufflerIndex",
          "type": "uint8"
        },
        {
          "internalType": "uint32",
          "name": "lastActionTimestamp",
          "type": "uint32"
        },
        {
          "internalType": "uint32",
          "name": "phaseDeadline",
          "type": "uint32"
        },
        {
          "internalType": "uint8",
          "name": "confirmedCount",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "votedCount",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "committedCount",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "revealedCount",
          "type": "uint8"
        },
        {
          "internalType": "uint8",
          "name": "keysSharedCount",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "encryptedMessage",
          "type": "bytes"
        }
      ],
      "name": "sendMafiaMessage",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "sessionKeys",
      "outputs": [
        {
          "internalType": "address",
          "name": "sessionAddress",
          "type": "address"
        },
        {
          "internalType": "uint32",
          "name": "expiresAt",
          "type": "uint32"
        },
        {
          "internalType": "uint64",
          "name": "roomId",
          "type": "uint64"
        },
        {
          "internalType": "bool",
          "name": "isActive",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "sessionToMain",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "v",
          "type": "address"
        }
      ],
      "name": "setZkVerifier",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "address[]",
          "name": "recipients",
          "type": "address[]"
        },
        {
          "internalType": "bytes[]",
          "name": "encryptedKeys",
          "type": "bytes[]"
        }
      ],
      "name": "shareKeysToAll",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "startGame",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        }
      ],
      "name": "startVoting",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes4",
          "name": "interfaceId",
          "type": "bytes4"
        }
      ],
      "name": "supportsInterface",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "unpause",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "roomId",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "target",
          "type": "address"
        }
      ],
      "name": "vote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "voteCounts",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "votes",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "withdrawFees",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "zkVerifier",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  "bytecode": "0x6080604052346100355760015f556001601a5561001b33610039565b50610025336100af565b50604051616e3790816101438239f35b5f80fd5b6001600160a01b0381165f9081525f516020616f9a5f395f51905f52602052604090205460ff166100aa576001600160a01b03165f8181525f516020616f9a5f395f51905f5260205260408120805460ff191660011790553391905f516020616f7a5f395f51905f528180a4600190565b505f90565b6001600160a01b0381165f9081525f516020616fba5f395f51905f52602052604090205460ff166100aa576001600160a01b03165f8181525f516020616fba5f395f51905f5260205260408120805460ff191660011790553391907fa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775905f516020616f7a5f395f51905f529080a460019056fe6080806040526004361015610012575f80fd5b5f3560e01c90816301ffc9a714614fcb5750806302d947ef14614ca857806307a52cab14614c8b57806309ed3e2214614bf657806312c57f55146113fa57806314a09d6014614bc05780631bae0ac814614aa9578063248a9ca314614a835780632a51fb3a146149ae5780632f2ff15d1461497d57806330a05e7314612a9a57806334ad36f61461464a57806335b97299146145d557806336568abe1461459157806337048f21146144a65780633d2f5bda1461430f5780633deaa341146142f35780633ec09d2c146142b65780633f4ba83a1461422b5780633fb5d9f51461407c57806343cd690314613e7e578063460e204914613d2b578063476343ee14613cc157806348e69d1f14613c225780634f324d1414613be25780635099fae214613ae1578063567e8dd514613a8f5780635c975abb14613a6d5780635d99dc3e146139c65780635e82ff65146139ab57806361ea2027146139645780636594bb0c146135fa578063660e907c146135b1578063669ead17146135655780636920e3ee146135385780636d8a74cb146132b85780636e2083f4146132865780637120465b1461307757806375b238fc146130505780637fa9c28914613035578063800122d614612ac757806382fab9d814612a9a57806384411c0a14612a535780638456cb59146129d65780638a8dd7f4146129925780638d29f52f1461293357806391d14854146128ea57806394225e9d146125b55780639691352814612572578063a05bcf021461253b578063a217fddf14612521578063aa55acbf146124bc578063ac204410146124a1578063af384791146120ea578063af7efa7c146120cf578063b6bf359a14611e1b578063b7b8d60414611db3578063bb9ae875146119ee578063bcb72159146117fa578063c96f097914611632578063d065539414611505578063d23254b4146114bb578063d547741f14611483578063d6df096d1461145b578063d94a51cb146113fa578063dae2928a14611034578063e5ed1d5914610f22578063e851122d14610ed4578063ea99c3fe14610deb578063eb02410114610931578063eb0fa6f8146108e7578063f14caed714610884578063f30818ff14610787578063f3db5133146106b05763ff99233a14610355575f80fd5b346106ac5760603660031901126106ac5760043561037161501e565b6044356001600160401b0381116106ac5761039090369060040161524a565b91610399615979565b6103a284615997565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576103d39085615a1d565b1561061d57835f52600460205263ffffffff600260405f20015460581c1615158061068b575b61067c57610405615ad9565b61040e84615997565b92845f52600460205260ff600260405f2001541660078110156106685760050361065957845f52601160205260405f2060018060a01b0385165f5260205260405f20541561064a57845f52601360205260405f2060018060a01b0385165f5260205260ff600160405f20015460a01c1661063b5761048c8486615af4565b6001600160a01b03821692836105ef575b6104d06104c291604051928391602083019588875260408085015260608401916153f4565b03601f198101835282615103565b519020845f52601360205260405f2060018060a01b0385165f5260205260405f2054036105e0575f8481526013602090815260408083206001600160a01b03871684529091529020600101805460ff60a01b19939093166001600160a81b031990931692909217600160a01b1790915582917f307ed77ec1f8fe53e10faa7fa486ba5e5b66eab3a9d19902c20b0da3c3b0b26a919061056f8185615bf9565b835f52601560205260405f2060ff610589818354166152d0565b1660ff198254161790556105a2604051928392836152fe565b0390a2805f52601560205260ff60405f205416815f52601460205260ff60405f205416146105d1575b60015f55005b6105da90616a38565b5f6105cb565b6336c5b53760e11b5f5260045ffd5b855f52600660205260405f20845f5260205260ff60405f2054161561062c576106188387615a1d565b61049d575b630575d90f60e11b5f5260045ffd5b63721c7c6760e11b5f5260045ffd5b633a456ae760e11b5f5260045ffd5b631ea3b68b60e21b5f5260045ffd5b6338961af360e21b5f5260045ffd5b634e487b7160e01b5f52602160045260245ffd5b6301a6f70d60e01b5f5260045ffd5b50835f52600460205263ffffffff600260405f20015460581c1642116103f9565b5f80fd5b346106ac5760203660031901126106ac576004355f5f5b825f52600560205260405f205460ff8216101561077957825f5260056020526106f38160405f20615060565b50545f8481526010602090815260408083206001600160a01b039094168352929052205460ff1660058110156106685760011480610754575b61073f575b61073a906152d0565b6106c7565b9061074c61073a916152d0565b919050610731565b50825f5260056020526002600361076e8360405f20615060565b50015416151561072c565b60208260ff60405191168152f35b346106ac5760203660031901126106ac576004356107a3615979565b6107ac81615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576107dd9082615a1d565b1561061d576107ea615ad9565b805f52600460205260ff600260405f200154166007811015610668578015908115610879575b506106595761081e8161689f565b1561086a5761082c8161693b565b901561084557506105cb9061083f615951565b90616140565b1561085b576108569061083f61592a565b6105cb565b63308ce0f960e11b5f5260045ffd5b63837cd79f60e01b5f5260045ffd5b600691501482610810565b346106ac5760403660031901126106ac5761089d61501e565b6004355f52600d60205260405f209060018060a01b03165f52602052606060405f2063ffffffff6001825492015460405192835260ff81161515602084015260081c166040820152f35b346106ac5760403660031901126106ac5761090061501e565b6004355f908152600f602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b346106ac5760603660031901126106ac576004356024356001600160401b0381116106ac57610964903690600401615284565b6044356001600160401b0381116106ac5761098390369060040161524a565b9261098c615979565b61099585615997565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576109c69086615a1d565b1561061d57845f52600460205263ffffffff600260405f20015460581c16151580610dca575b61067c576109f8615ad9565b610a0185615997565b91855f526004602052600260405f20019485549160ff831660078110156106685760010361065957610a5f6104c291604051928391602083019560408752610a4d606085018c8b615894565b848103601f19016040860152916153f4565b519020865f52600860205260405f2060018060a01b0385165f5260205260405f205403610dbb5760328411610dac57855f52600960205260405f2054159081610d9c575b50610d7757845f52600960205260405f2054151580610d86575b610d77575f858152600960205260409020600160401b8411610cec578054848255808510610d00575b505f908152602081208694939291825b858210610c085750505090610bd97f1522116f5d4e7ac5527e161307d73b93c621a9a7627553f584afb6b6f62a74e79392855f52600860205260405f2060018060a01b0384165f52602052600260405f2001600160ff19825416179055610bb8610b6f610b6960ff8a5460301c16615918565b886167b4565b97610b7a898261577d565b610b8a63ffffffff42168261579a565b610ba263ffffffff610b9b42615341565b1682615385565b610bb260ff825460901c166152d0565b90615414565b60405193849360018060a01b03168452604060208501526040840191615894565b0390a2815f52600560205260ff60405f205491161015610bf95760015f55005b610c02906167fb565b806105cb565b90919293949550610c19818561582b565b906001600160401b038211610cec57610c3c82610c368754615079565b8761547d565b5f90601f8311600114610c825792610c65836001959460209487965f92610c77575b50506154c0565b86555b01930191018795949392610af6565b013590508e80610c5e565b601f19831691865f5260205f20925f5b818110610cd45750936020936001969387969383889510610cbb575b505050811b018655610c68565b01355f19600384901b60f8161c191690558d8080610cae565b91936020600181928787013581550195019201610c92565b634e487b7160e01b5f52604160045260245ffd5b815f528460205f2091820191015b818110610d1b5750610ae6565b80610d2860019254615079565b80610d35575b5001610d0e565b601f81118314610d4a57505f81555b89610d2e565b610d6690825f5283601f60205f20920160051c82019101615467565b805f525f6020812081835555610d44565b63d1d2a30960e01b5f5260045ffd5b50845f52600960205260405f2054831415610abd565b60ff915060101c16831086610aa3565b63376ab11160e01b5f5260045ffd5b639ea6d12760e01b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c1642116109ec565b346106ac5760203660031901126106ac57600435610e07615979565b610e1081615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57610e419082615a1d565b1561061d57610e4e615ad9565b805f526004602052600260405f20015460ff811660078110156106685760050361065957815f52601460205260ff60405f2054168015159081610ebb575b50610eac5760ff808260881c169160901c1610610dbb576105cb906164fe565b6303488f9960e61b5f5260045ffd5b9050825f52601560205260ff60405f2054161083610e8c565b346106ac5760403660031901126106ac57610eed61501e565b6004355f52601060205260405f209060018060a01b03165f52602052602060ff60405f205416610f2060405180926152b4565bf35b346106ac5760203660031901126106ac57600435610f3e615979565b610f4781615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57610f789082615a1d565b1561061d57610f85615ad9565b805f526004602052600260405f2001805460ff81166007811015610668576106595760ff60049160101c161061102557805460ff19166001178155610ffb90610fd6610fd084616767565b8261577d565b610fe663ffffffff42168261579a565b63ffffffff610ff442615341565b1690615385565b7f50ad08f58a27f2851d7e3a1b3a6a46b290f2ce677e99642d30ff639721e777905f80a260015f55005b63f770074360e01b5f5260045ffd5b346106ac5760203660031901126106ac57600435611050615979565b61105981615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c5761108a9082615a1d565b1561061d57611097615ad9565b805f526004602052600260405f2001805463ffffffff8160581c1680159081156113ef575b506113e05760ff16827f77ff69c1f99cadd93a6da75080e20a3fed43f1d42375051a5d162adcafc5fbb760206040516110f58186615224565ba260078110156106685760018103611249575050805f526004602052600260405f20018160ff825460301c16815f52600560205260405f205481106111d4575b505061115061114a60ff835460301c16615918565b836167b4565b61115a818361577d565b61116a63ffffffff42168361579a565b61118263ffffffff61117b42615341565b1683615385565b825f52600560205260ff60405f2054911610156111a2575b505060015f55005b54600260189190911c60ff16106111c3576111bc906167fb565b808061119a565b6111cf9061083f61585d565b6111bc565b60806111f95f516020616d825f395f51905f5292845f52600560205260405f20615060565b50546001600160a01b031661120e8185616475565b60405190815260406020820152601660408201527554696d656f757420647572696e672073687566666c6560501b6060820152a28183611135565b600281036113705750815f52600560205260405f205f5b815460ff8216101561134857806002600361127e61128b9486615060565b50015416611290576152d0565b611260565b6020600361129e8386615060565b5001541615600160036112b18487615060565b50015416158115611340575b50156152d0576112e16112d08285615060565b50546001600160a01b031686616475565b845f516020616d825f395f51905f5260806112fc8487615060565b5054604080516001600160a01b0390921682526020820181905260159082015274151a5b595bdd5d08191d5c9a5b99c81c995d99585b605a1b6060820152a26152d0565b9050866112bd565b505054600260189190911c60ff16106113645761085690616229565b6108569061083f61585d565b6004810361138357505061085690615c50565b60058103611396575050610856906164fe565b6003146113a5575b50506105cb565b805460ff60ff60801b01191660041781556113c89063ffffffff610ff442615341565b5f516020616d225f395f51905f525f80a2808061139e565b63489e8c8960e01b5f5260045ffd5b9050421115846110bc565b346106ac57611408366151ea565b915f52600a60205260405f209060018060a01b03165f5260205260405f209060018060a01b03165f5260205261145761144360405f20615126565b6040519182916020835260208301906151c6565b0390f35b346106ac575f3660031901126106ac576003546040516001600160a01b039091168152602090f35b346106ac5760403660031901126106ac576114b96004356114a261501e565b906114b46114af82615318565b61607a565b6161a5565b005b346106ac5760403660031901126106ac576114d461501e565b6004355f908152600b602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b346106ac5760203660031901126106ac576004355f52601260205260405f208054906115308261532a565b9161153e6040519384615103565b8083526020830180925f5260205f205f915b8383106115e857848660405191829160208301906020845251809152604083019060408160051b85010192915f905b82821061158e57505050500390f35b919360019193955060208091603f1989820301855287519060406115bb83516060845260608401906151c6565b9263ffffffff85820151168584015281878060a01b0391015116910152960192019201859493919261157f565b600260206001926040516115fb816150e8565b61160486615126565b81528486015463ffffffff811684830152858060a01b0390841c166040820152815201920192019190611550565b346106ac576116403661504a565b611648615979565b61165182615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576116829083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c161515806117d9575b61067c576116b4615ad9565b6116bd82615997565b90825f526004602052600260405f20019160ff835416600781101561066857600503610659576116ed8185615a9d565b6117ca576117b27f3cf64897479c2ba314a5a0e8cf3a0e097d9367de65da54961e4dc4148364990093604051611722816150e8565b84815260208101905f82526117786001604083019263ffffffff421684528a5f52600d60205260405f20828060a01b0389165f5260205260405f20905181550192511515839060ff801983541691151516179055565b5164ffffffff0082549160081b169064ffffffff00191617905561179c8387615b4b565b6117ac60ff825460881c166152d0565b906157bd565b6117c16040519283928361536a565b0390a260015f55005b6317fd8aab60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c1642116116a8565b346106ac576118083661504a565b611810615979565b61181982615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c5761184a9083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c161515806119cd575b61067c5761187c615ad9565b61188582615997565b90825f526004602052600260405f20019160ff83541660078110156106685760020361065957835f52601160205260405f2060018060a01b0382165f5260205260405f20546119be576118d88185615a62565b6119af5760205f516020616dc25f395f51905f5291855f516020616ce25f395f51905f5261192c8296835f526011865260405f2060018060a01b0386165f5286528060405f2055604051918291868361536a565b0390a26119398185615ba2565b61195261194c60ff875460781c166152d0565b866153d7565b6040516001600160a01b039091168152a25460ff808260181c169160781c161461197c5760015f55005b61198581616229565b7f54ccd98022ba3fd547cb241a4f3dfc13e7f9bb54550b7babf4080021c6c2f1265f80a2806105cb565b63a89ac15160e01b5f5260045ffd5b630890382360e21b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211611870565b346106ac5760603660031901126106ac576004356024356001600160401b0381116106ac57611a21903690600401615284565b6044356001600160401b0381116106ac57611a40903690600401615284565b9092611a4a615979565b611a5385615997565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57611a849086615a1d565b1561061d57845f52600460205263ffffffff600260405f20015460581c16151580611d92575b61067c57611ab6615ad9565b611abf85615997565b93855f526004602052600260405f200160ff81541660078110156106685760020361065957838503611d835760328511610dac57865f52600760205260405f2060018060a01b0387165f5260205260206003611b2c60ff60405f2054168a5f526005845260405f20615060565b50015416611d745793946001600160a01b0316935f5b8787821015611ca457506001600160a01b03600582901b8581013591821692918390036106ac57895f52600660205260405f20835f5260205260ff60405f2054161561062c57878314611c955786821015611c8157611ba39085018561582b565b9190928a5f52600a60205260405f20895f5260205260405f20905f5260205260405f2060018060401b038311610cec5782611be98c94611be38454615079565b8461547d565b5f601f8211600114611c17579080611c0c92600196975f92610c775750506154c0565b90555b019050611b42565b94601f19821695835f5260205f20965f5b818110611c6657509160019697918488959410611c4d575b505050811b019055611c0f565b01355f19600384901b60f8161c191690558d8080611c40565b8284013589556001909801978f975060209283019201611c28565b634e487b7160e01b5f52603260045260245ffd5b637f043f9b60e01b5f5260045ffd5b82817f9204f1001d8059e799b3a233fa5114eab3b5d30762de3ff4e07fcd7e6266aad160208a835f526007825260405f20815f5282526003611cf760ff60405f205416865f526005855260405f20615060565b500163ffffffff8381835416171663ffffffff19825416179055611d2a611d2460ff875460981c166152d0565b866157da565b604051908152a25460ff808260181c169160981c1614611d4a5760015f55005b7ff6b9b3035e320bcce495d00c2d31a7bd341754f7b9919a4a736388e16ef674a55f80a2806105cb565b6387db46a560e01b5f5260045ffd5b634ec4810560e11b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c164211611aaa565b346106ac5760203660031901126106ac576001600160a01b03611dd4615034565b165f526017602052608060405f2060ff60018254920154166040519160018060a01b038116835263ffffffff8160a01c16602084015260c01c604083015215156060820152f35b346106ac5760403660031901126106ac576004356024356001600160401b0381116106ac57611e4e90369060040161524a565b611e59929192615979565b611e6282615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57611e939083615a1d565b1561061d57611ea0615ad9565b611ea982615997565b92825f52600460205260ff600260405f2001541660078110156106685760050361065957825f52601160205260405f2060018060a01b0385165f5260205260405f20541561064a576104008211610dac57611f048484615af4565b825f52601260205260405f209060405194611f1e866150e8565b611f29368584615431565b86524263ffffffff16602087019081526001600160a01b0390911660408701818152845491949091600160401b811015610cec57611f6c91600182018155615231565b9790976120bc575180519097906001600160401b038111610cec57611f9581611be38454615079565b6020601f821160011461203c5760016117c196959493611fd48463ffffffff9586955f516020616cc25f395f51905f529e9f5f926120315750506154c0565b81555b9451940180549351600160201b600160c01b03199290951692909216166001600160c01b031990921691909117602092831b600160201b600160c01b031617905560408051948552908401819052929384938401916153f4565b015190508f80610c5e565b601f19821699835f52815f209a5f5b8181106120a45750936001845f516020616cc25f395f51905f529c9d63ffffffff9695839588976117c19d9c9b9a1061208c575b505050811b018155611fd7565b01515f1960f88460031b161c191690558e808061207f565b838301518d556001909c019b6020938401930161204b565b634e487b7160e01b5f525f60045260245ffd5b346106ac575f3660031901126106ac57602060405160328152f35b346106ac5760603660031901126106ac5760043560243560058110156106ac576044356001600160401b0381116106ac5761212990369060040161524a565b612134929192615979565b61213d84615997565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c5761216e9085615a1d565b1561061d5761217b615ad9565b61218484615997565b92845f52601060205260405f2060018060a01b0385165f5260205260ff60405f20541660058110156106685761249257845f52601160205260405f2060018060a01b0385165f5260205260405f20541561064a57604082116124835761220c6104c29160405192839160208301956121fc87896152b4565b60408085015260608401916153f4565b519020835f52601160205260405f2060018060a01b0384165f5260205260405f20540361247457825f52601060205260405f2060018060a01b0383165f5260205260405f20905f9160ff1981541660ff8316179055837f9b013793e3fbc06d6ff5e9b6ce06be7c635e957579a85ae6b262b85b13ecd8746040518061229285888361580b565b0390a2835f52600760205260405f2060018060a01b0384165f52602052608060036122cf60ff60405f205416875f52600560205260405f20615060565b50015416151580612466575b6123bf575b835f52600760205260405f2060018060a01b0384165f52602052610100600361231b60ff60405f205416875f52600560205260405f20615060565b50015416151591826123ad575b50506123345760015f55005b60a08161234f5f516020616d425f395f51905f529385616475565b60405190600180841b0316815260406020820152602c60408201527f557365642064657465637469766520636865636b2077697468206e6f6e2d646560608201526b7465637469766520726f6c6560a01b6080820152a280806105cb565b90915061066857600314158380612328565b6123c98385616475565b837f7f1edd8653eda945bad547f4f89adfa659b5f748dc9d88a447ff44550d7210be604051806123fa85888361580b565b0390a2835f516020616d425f395f51905f5260a0604051600180831b038716815260406020820152602860408201527f55736564206d616669612066756e6374696f6e732077697468206e6f6e2d6d6160608201526766696120726f6c6560c01b6080820152a26122e0565b505f915060018114156122db565b63134fed2d60e01b5f5260045ffd5b63bf1ad44360e01b5f5260045ffd5b63fd8fd76760e01b5f5260045ffd5b346106ac575f3660031901126106ac576020604051603c8152f35b346106ac5760403660031901126106ac576124d561501e565b6004355f52601360205260405f209060018060a01b03165f52602052606060405f2060ff6001825492015460405192835260018060a01b038116602084015260a01c1615156040820152f35b346106ac575f3660031901126106ac5760206040515f8152f35b346106ac576125493661504a565b905f52600960205260405f2080548210156106ac5761145791611443915f5260205f2001615126565b346106ac5760203660031901126106ac5761258b615034565b61259361601e565b600380546001600160a01b0319166001600160a01b0392909216919091179055005b346106ac5760203660031901126106ac57335f90815260186020526040902054600435906001600160a01b0316156128e457335f908152601860205260409020546001600160a01b03165b815f52600560205260405f20905f5f908354915b8260ff821610612847575060ff169161262c8361532a565b9361263a6040519586615103565b8385526126468461532a565b602086019690601f190136883761265c8561532a565b9461266a6040519687615103565b808652612679601f199161532a565b015f5b8181106128345750505f915f5b8560ff82161061273d57888888604051928392604084019060408552518091526060840191905f5b81811061271b575050508281036020840152815180825260208201916020808360051b8301019401925f915b8383106126ea5786860387f35b919395509193602080612709600193601f1986820301875289516151c6565b970193019301909286959492936126dd565b82516001600160a01b03168452869550602093840193909201916001016126b1565b8761274c82849b999a9b615060565b50546001600160a01b03908116908716811415806127f5575b61277e575b5050612775906152d0565b97969597612689565b946127e56127eb9287612775959861279a60ff861680946157f7565b52875f52600a60205260405f209060018060a01b03165f5260205260405f2060018060a01b038a165f526020528b6127de826127d860405f20615126565b926157f7565b528b6157f7565b506152d0565b939050888a61276a565b505f858152600a602090815260408083206001600160a01b038581168552908352818420908b16845290915290205461282d90615079565b1515612765565b606060208289018101919091520161267c565b6128548186979597615060565b50546001600160a01b038781169116141580612896575b612881575b612879906152d0565b949294612614565b9061288e612879916152d0565b919050612870565b50835f52600a60205260405f206128ad8287615060565b50546001600160a01b039081165f90815260209283526040808220928a168252919092529020546128dd90615079565b151561286b565b33612600565b346106ac5760403660031901126106ac5761290361501e565b6004355f52600260205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b346106ac5760203660031901126106ac576060600435805f52601460205260ff60405f20541690805f52601560205260ff60405f205416905f52601660205260018060a01b0360405f2054169060405192835260208301526040820152f35b346106ac5760403660031901126106ac576129ab61501e565b6004355f52601160205260405f209060018060a01b03165f52602052602060405f2054604051908152f35b346106ac575f3660031901126106ac576129ee61601e565b6129f6615ad9565b600160ff19815416176001557f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a2586020604051338152a1337f7c83004a7e59a8ea03b200186c4dda29a4e144d9844d63dbc1a09acf7dfcd4855f80a2005b346106ac5760403660031901126106ac57612a6c61501e565b6004355f52600760205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b346106ac5760203660031901126106ac576004355f526014602052602060ff60405f205416604051908152f35b60a03660031901126106ac576004356001600160401b0381116106ac57612af290369060040161524a565b906024359160ff831683036106ac576044356001600160401b0381116106ac57612b2090369060040161524a565b9093906064356001600160401b0381116106ac57612b4290369060040161524a565b9560843594919390916001600160a01b03861686036106ac57612b63615979565b612b6b615ad9565b600460ff8316108015613028575b613019576020811161300a57601a54965f198814612ff65760018801601a5560405191612ba5836150cc565b6001600160401b0389168352336020840190815293612bc5368385615431565b604085019081525f606086015260ff821660808601525f60a08601525f60c08601525f60e08601525f61010086015263ffffffff42166101208601525f6101408601525f6101608601525f6101808601525f6101a08601525f6101c08601525f6101e08601528a5f52600460205260405f209560018060401b03865116875491600160401b600160e01b03905160401b169163ffffffff60e01b16171786555180519060018060401b038211610cec57612c8f82612c8660018a0154615079565b60018a0161547d565b602090601f8311600114612f8957612cb092915f9183612f7e5750506154c0565b60018601555b60608401519360078510156106685760028087018054608084015161ffff1990911660ff9889161760089190911b61ff001617815560a08301518d987fd9abe6195309293e802058345712163744c28bde8471531f9990f08419585bcf98612deb9591949390926101e09291612d2e918516906156b0565b612d408360c0830151168587016156c8565b612d5461ffff60e08301511685870161575e565b612d67836101008301511685870161577d565b612d7e63ffffffff6101208301511685870161579a565b612d9563ffffffff61014083015116858701615385565b612da883610160830151168587016153d7565b612dbb83610180830151168587016152e1565b612dce836101a0830151168587016157bd565b612de1836101c083015116858701615414565b01511691016157da565b60ff612e0a6040519485943386526060602087015260608601916153f4565b911660408301520390a260808211612f6f576104008611612f6057612f198594612e856020985f516020616d025f395f51905f5296885f5260058b52612e7460405f209160405193612e5b856150b1565b338552612e69368b8b615431565b8e8601523691615431565b6040830152600260608301526154d2565b5f86815260068952604080822033808452908b52818320805460ff1990811660011790915589845260078c52828420918452908b52818320805490911690558782526004808b528183206002908101805462ff0000191662010000179055898452908b52912001805463ff000000191663010000001790556001600160a01b038116612f28575b6040519384933385615727565b0390a260015f55604051908152f35b612f338682336162b8565b3415612f0c57612f5b5f808080346001600160a01b0387165af1612f556153a8565b506156e2565b612f0c565b63450bc0a760e01b5f5260045ffd5b636f6003c360e01b5f5260045ffd5b015190508e80610c5e565b9190600188015f52805f20905f935b601f1984168510612fdb576001945083601f19811610612fc3575b505050811b016001860155612cb6565b01515f1960f88460031b161c191690558d8080612fb3565b81810151835560209485019460019093019290910190612f98565b634e487b7160e01b5f52601160045260245ffd5b630b279b2f60e41b5f5260045ffd5b6319413ccd60e11b5f5260045ffd5b50601460ff831611612b79565b346106ac575f3660031901126106ac57602060405160b48152f35b346106ac575f3660031901126106ac5760206040515f516020616da25f395f51905f528152f35b60803660031901126106ac576004356024356001600160401b0381116106ac576130a590369060040161524a565b6044356001600160401b0381116106ac576130c490369060040161524a565b92906064356001600160a01b0381168082036106ac576130e2615979565b6130ea615ad9565b865f526004602052600260405f200195865460ff81166007811015610668576106595760ff808260081c169160101c161015613277575f88815260066020908152604080832033845290915290205460ff166132695760808611612f6f576104008111612f60575f516020616d025f395f51905f5296886131b48861322a94612e746117c199855f52600560205260ff60405f205416955f52600560205260405f20926131a88d6040519661319e886150b1565b3388523691615431565b60208601523691615431565b5f8a815260066020908152604080832033808552908352818420805460ff199081166001179091558e8552600784528285209185529252909120805490911660ff92831617905581546132149161320e9160101c166152d0565b826156b0565b61322460ff825460181c166152d0565b906156c8565b8061323e575b506040519384933385615727565b6132498783336162b8565b3415613230575f8080806132639434905af1612f556153a8565b86613230565b621d934160e11b5f5260045ffd5b63bc42480360e01b5f5260045ffd5b346106ac5760203660031901126106ac576004355f526016602052602060018060a01b0360405f205416604051908152f35b346106ac5760203660031901126106ac575f6101e06040516132d9816150cc565b828152826020820152606060408201528260608201528260808201528260a08201528260c08201528260e08201528261010082015282610120820152826101408201528261016082015282610180820152826101a0820152826101c082015201526004355f52600460205260405f20600260405191613357836150cc565b80546001600160401b038116845260401c6001600160a01b0316602084015261338260018201615126565b6040840152015460ff81169060078210156106685760ff916060840152818160081c166080840152818160101c1660a0840152818160181c1660c084015261ffff8160201c1660e0840152818160301c1661010084015263ffffffff8160381c1661012084015263ffffffff8160581c16610140840152818160781c16610160840152818160801c16610180840152818160881c166101a0840152818160901c166101c084015260981c166101e082015260405180916020825260018060401b03815116602083015260018060a01b03602082015116604083015260ff6101e061347d604084015161020060608701526102208601906151c6565b9261349060608201516080870190615224565b8260808201511660a08601528260a08201511660c08601528260c08201511660e086015261ffff60e082015116610100860152826101008201511661012086015263ffffffff6101208201511661014086015263ffffffff61014082015116610160860152826101608201511661018086015282610180820151166101a0860152826101a0820151166101c0860152826101c082015116828601520151166102008301520390f35b346106ac5760203660031901126106ac576004355f526015602052602060ff60405f205416604051908152f35b346106ac5760403660031901126106ac5761357e61501e565b6004355f52600e60205260405f209060018060a01b03165f52602052602060ff60405f205416610f206040518092615277565b346106ac5760403660031901126106ac576135ca61501e565b6004355f52600660205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b346106ac5760803660031901126106ac5760043560243560048110156106ac57604435906001600160a01b0382168083036106ac576064356001600160401b0381116106ac5761364e90369060040161524a565b613659929192615979565b61366286615997565b865f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576136939087615a1d565b1561061d57855f52600460205263ffffffff600260405f20015460581c16151580613943575b61067c576136c5615ad9565b6136ce86615997565b92865f526004602052600260405f20019560ff87541660078110156106685760050361065957875f52600760205260405f2060018060a01b0386165f526020526010600361372e60ff60405f2054168b5f52600560205260405f20615060565b500154166119af5760018614613935576137488589615a9d565b15613926578515158061391d575b6138e9575b5061378e6104c2916040519283916020830195613778878b615277565b87604085015260608085015260808401916153f4565b519020855f52600d60205260405f2060018060a01b0384165f5260205260405f205403610dbb575f858152600d602090815260408083206001600160a01b0386168085529083528184206001908101805460ff199081169092179055898552600e84528285208286528452828520805490911660ff8916179055888452600f8352818420908452909152902080546001600160a01b031916821790557fefeac4ab688c036b72571c6adaf81feb0d4e0a7099c1cfd8d09e54370198c53c936060936138849161386190610ba2868a615bf9565b60038114613890575b6040516001600160a01b0390941684526020840190615277565b6040820152a260015f55005b865f52600760205260405f2060018060a01b0385165f5260205260036138c860ff60405f205416895f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff919091161761010017905561386a565b875f52600660205260405f20845f5260205260ff60405f2054161561062c576139129088615a1d565b1561061d578761375b565b50831515613756565b63205e472d60e21b5f5260045ffd5b6282b42960e81b5f5260045ffd5b50855f52600460205263ffffffff600260405f20015460581c1642116136b9565b346106ac5760403660031901126106ac5761397d61501e565b6004355f52600c60205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b346106ac575f3660031901126106ac57602060405160788152f35b346106ac5760403660031901126106ac5760e06003613a1c6004356139e961501e565b815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b50015460806040519160028116151583526001811615156020840152600481161515604084015260088116151560608401526010811615158284015260208116151560a084015216151560c0820152f35b346106ac575f3660031901126106ac57602060ff600154166040519015158152f35b346106ac5760403660031901126106ac57613aa861501e565b6004355f52600860205260405f209060018060a01b03165f526020526040805f2060ff6002825492015416825191825215156020820152f35b346106ac5760203660031901126106ac57600435613afd615979565b613b0681615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57613b379082615a1d565b1561061d57805f52600460205263ffffffff600260405f20015460581c16151580613bc1575b61067c57613b69615ad9565b613b7281615997565b815f526004602052600260405f20019060ff82541660078110156106685760020361065957613ba18184615a62565b6119af575f516020616dc25f395f51905f52602082611939869485615ba2565b50805f52600460205263ffffffff600260405f20015460581c164211613b5d565b346106ac5760203660031901126106ac576001600160a01b03613c03615034565b165f526018602052602060018060a01b0360405f205416604051908152f35b346106ac575f3660031901126106ac57335f52601760205260405f20600181019060ff825416613c4e57005b80546001600160a01b031680337f744157ccffbd293a2e8644928cd7d23d650f869b88f72d7bfea8041b76ca6bec5f80a35f90815260186020908152604080832080546001600160a01b031916905592546001600160a01b031682526019905220805460ff199081169091558154169055005b346106ac575f3660031901126106ac57613cd961601e565b5f80808047335af1613ce96153a8565b5015613cf157005b60405162461bcd60e51b81526020600482015260126024820152714661696c656420746f20776974686472617760701b6044820152606490fd5b346106ac5760203660031901126106ac576004355f52600560205260405f20805490613d568261532a565b91613d646040519384615103565b8083526020830180925f5260205f205f915b838310613e2257848660405191829160208301906020845251809152604083019060408160051b85010192915f905b828210613db457505050500390f35b919360019193955060208091603f19898203018552875190848060a01b038251168152606063ffffffff81613e0b613df98787015160808988015260808701906151c6565b604087015186820360408801526151c6565b940151169101529601920192018594939192613da5565b60046020600192604051613e35816150b1565b848060a01b038654168152613e4b858701615126565b83820152613e5b60028701615126565b604082015263ffffffff6003870154166060820152815201920192019190613d76565b346106ac57613e8c3661504a565b613e94615979565b613e9d82615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57613ece9083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c1615158061405b575b61067c57613f00615ad9565b613f0982615997565b90825f526004602052600260405f20015460ff811660078110156106685760010361065957613f4b90845f52600560205260ff60405f209160301c1690615060565b50546001600160a01b039081169083160361404c57825f52600760205260405f2060018060a01b0383165f5260205260406003613f9860ff835f205416865f526005602052835f20615060565b500154166117ca575f8381526008602090815260408083206001600160a01b038616808552908352818420858155600201805460ff191690558684526007835281842090845282528083205486845260059092529091207ffbabe9c4a6257c269f37e649a08003e579b119fcff47ac57e59d1502fccea41c93916003916140229160ff1690615060565b500163ffffffff604081835416171663ffffffff198254161790556117c16040519283928361536a565b631cc191eb60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211613ef4565b346106ac5761408a3661504a565b614092615979565b61409b82615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576140cc9083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c1615158061420a575b61067c576140fe615ad9565b61410782615997565b90825f52600460205260ff600260405f2001541660078110156106685760050361065957825f52601160205260405f2060018060a01b0383165f5260205260405f20541561064a57825f52601360205260405f2060018060a01b0383165f5260205260405f20546141fb578161419e7ff5adb2642a216ea3114d73daac494b2341695b10db2b0e6be988acb22fbc15649385615af4565b6141a88185615b4b565b835f52601360205260405f2060018060a01b0382165f526020528160405f2055835f52601460205260405f2060ff6141e2818354166152d0565b1660ff198254161790556117c16040519283928361536a565b6317ac735560e11b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c1642116140f2565b346106ac575f3660031901126106ac5761424361601e565b60015460ff8116156142a75760ff19166001557f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa6020604051338152a1337f306ca22c455fe433ebbf0542bbf947ea6a725495f9e1043db2a47e3c579403855f80a2005b638dfc202b60e01b5f5260045ffd5b346106ac5760203660031901126106ac576001600160a01b036142d7615034565b165f526019602052602060ff60405f2054166040519015158152f35b346106ac575f3660031901126106ac5760206040516138408152f35b346106ac5760203660031901126106ac5760043561432b615979565b61433481615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576143659082615a1d565b1561061d57614372615ad9565b805f526004602052600260405f200160ff81541660078110156106685760030361065957805460ff60ff60801b01191660041781556143b99063ffffffff610ff442615341565b805f52600560205260405f205f5b815460ff8216101561448e57806143e161445a9284615060565b50546001600160a01b031660036143f88386615060565b5001805463fffffffb811663ffffffff199091161790555f858152600b602090815260408083206001600160a01b0385168452909152902080546001600160a01b03191690556002600361444c8487615060565b5001541661445f57506152d0565b6143c7565b5f858152600c602090815260408083206001600160a01b03909416835292905220805460ff19169055846127e5565b825f516020616d225f395f51905f525f80a260015f55005b346106ac576144b43661504a565b6144bc615979565b6144c582615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576144f69083615a1d565b1561061d57614503615ad9565b61450c82615997565b90825f52600460205260ff600260405f2001541660078110156106685760020361065957825f52601160205260405f2060018060a01b0383165f5260205260405f20546119be575f516020616ce25f395f51905f5291835f52601160205260405f2060018060a01b0382165f526020528160405f20556117c16040519283928361536a565b346106ac5760403660031901126106ac576145aa61501e565b336001600160a01b038216036145c6576114b9906004356161a5565b63334bd91960e11b5f5260045ffd5b346106ac576145e33661504a565b905f52601260205260405f2080548210156106ac576146289161460591615231565b50600161461182615126565b9101546040519283926060845260608401906151c6565b9063ffffffff8116602084015260018060a01b039060201c1660408301520390f35b346106ac576101c03660031901126106ac57600435366064116106ac573660e4116106ac5736610124116106ac57366101c4116106ac57614689615979565b614691615ad9565b805f52600460205260ff600260405f200154166007811015610668578015908115614972575b50610659576003546001600160a01b0316801561493a57604080516334baeab960e01b81529190602460048401378160645f604483015b60028210614920575050506101a481602093604060e460c484013760a06101246101048401375afa908115614915575f916148da575b50156148a257610184356101a43582610164350361486b578015614834578101809111612ff65715614802576101243560010361478e576105cb906040519061476e604083615103565b600e82526d546f776e2077696e7320285a4b2960901b6020830152616140565b610144356001036147cd5761085690604051906147ac604083615103565b600f82526e4d616669612077696e7320285a4b2960881b6020830152616140565b60405162461bcd60e51b815260206004820152600d60248201526c2d259d103737903bb4b73732b960991b6044820152606490fd5b60405162461bcd60e51b815260206004820152600a602482015269456d7074792067616d6560b01b6044820152606490fd5b60405162461bcd60e51b815260206004820152600f60248201526e4e6f20746f776e20706c617965727360881b6044820152606490fd5b60405162461bcd60e51b815260206004820152600f60248201526e0a4dededa92c840dad2e6dac2e8c6d608b1b6044820152606490fd5b60405162461bcd60e51b815260206004820152601060248201526f24b73b30b634b2102d2590383937b7b360811b6044820152606490fd5b90506020813d60201161490d575b816148f560209383615103565b810103126106ac575180151581036106ac5782614724565b3d91506148e8565b6040513d5f823e3d90fd5b8293506040818160019495819437019301910184926146ee565b60405162461bcd60e51b815260206004820152601060248201526f15995c9a599a595c881b9bdd081cd95d60821b6044820152606490fd5b6006915014826146b7565b346106ac5760403660031901126106ac576114b960043561499c61501e565b906149a96114af82615318565b6160b4565b346106ac5760203660031901126106ac576004355f52600960205260405f208054906149d98261532a565b916149e76040519384615103565b8083526020830180925f5260205f205f915b838310614a6657848660405191829160208301906020845251809152604083019060408160051b85010192915f905b828210614a3757505050500390f35b91936001919395506020614a568192603f198a820301865288516151c6565b9601920192018594939192614a28565b600160208192614a7585615126565b8152019201920191906149f9565b346106ac5760203660031901126106ac576020614aa1600435615318565b604051908152f35b346106ac5760203660031901126106ac576004355f52600460205260405f2080546002614ad860018401615126565b920154604080516001600160401b038416815292811c6001600160a01b031660208401526102009083018190529192839260ff91614b18918501906151c6565b91614b2860608501838316615224565b818160081c166080850152818160101c1660a0850152818160181c1660c085015261ffff8160201c1660e0850152818160301c1661010085015263ffffffff8160381c1661012085015263ffffffff8160581c16610140850152818160781c16610160850152818160801c16610180850152818160881c166101a0850152818160901c166101c085015260981c166101e08301520390f35b346106ac5760203660031901126106ac576004355f526004602052602063ffffffff600260405f20015460581c16604051908152f35b346106ac57614c043661504a565b905f52600560205260405f209081548110156106ac57614c2391615060565b5080546001600160a01b0316614c3b60018301615126565b91614c8163ffffffff6003614c5260028501615126565b9301541691614c7360405195869586526080602087015260808601906151c6565b9084820360408601526151c6565b9060608301520390f35b346106ac575f3660031901126106ac576020601a54604051908152f35b346106ac5760403660031901126106ac57600435614cc461501e565b614ccc615979565b614cd582615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57614d069083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c16151580614faa575b61067c57614d38615ad9565b614d4182615997565b90825f526004602052600260405f20019160ff83541660078110156106685760040361065957835f52600660205260405f2060018060a01b0383165f5260205260ff60405f2054161561062c57614d988285615a1d565b1561061d5783917fcfff1651bcea794952a516ce970ab17518a85210bd939aaeaac670a8d3e65ec791835f52600760205260405f2060018060a01b0382165f5260205260046003614dfb60ff60405f205416875f52600560205260405f20615060565b5001545f868152600b602090815260408083206001600160a01b0387811685529252909120549290911615911680151580614f80575b614f44575b505f858152600b602090815260408083206001600160a01b03868116855290835281842080546001600160a01b0319169188169182179055888452600c83528184209084529091529020805460ff90614e909082166152d0565b1660ff19825416179055614ed3575b614eae604051928392836152fe565b0390a25460ff808260181c169160801c1614614eca5760015f55005b610c0290615c50565b835f52600760205260405f2060018060a01b0382165f526020526003614f0b60ff60405f205416865f52600560205260405f20615060565b500163ffffffff600481835416171663ffffffff19825416179055614f3f614f3960ff875460801c166152d0565b866152e1565b614e9f565b855f52600c60205260405f209060018060a01b03165f5260205260405f2060ff614f70818354166152c1565b1660ff1982541617905587614e36565b50855f52600c60205260405f2060018060a01b0382165f5260205260ff60405f2054161515614e31565b50815f52600460205263ffffffff600260405f20015460581c164211614d2c565b346106ac5760203660031901126106ac576004359063ffffffff60e01b82168092036106ac57602091637965db0b60e01b811490811561500d575b5015158152f35b6301ffc9a760e01b14905083615006565b602435906001600160a01b03821682036106ac57565b600435906001600160a01b03821682036106ac57565b60409060031901126106ac576004359060243590565b8054821015611c81575f5260205f209060021b01905f90565b90600182811c921680156150a7575b602083101461509357565b634e487b7160e01b5f52602260045260245ffd5b91607f1691615088565b608081019081106001600160401b03821117610cec57604052565b61020081019081106001600160401b03821117610cec57604052565b606081019081106001600160401b03821117610cec57604052565b601f909101601f19168101906001600160401b03821190821017610cec57604052565b9060405191825f82549261513984615079565b80845293600181169081156151a45750600114615160575b5061515e92500383615103565b565b90505f9291925260205f20905f915b81831061518857505090602061515e928201015f615151565b602091935080600191548385890101520191019091849261516f565b90506020925061515e94915060ff191682840152151560051b8201015f615151565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b60609060031901126106ac57600435906024356001600160a01b03811681036106ac57906044356001600160a01b03811681036106ac5790565b9060078210156106685752565b8054821015611c81575f5260205f209060011b01905f90565b9181601f840112156106ac578235916001600160401b0383116106ac57602083818601950101116106ac57565b9060048210156106685752565b9181601f840112156106ac578235916001600160401b0383116106ac576020808501948460051b0101116106ac57565b9060058210156106685752565b60ff168015612ff6575f190190565b60ff1660ff8114612ff65760010190565b805460ff60801b191660809290921b60ff60801b16919091179055565b6001600160a01b0391821681529116602082015260400190565b5f526002602052600160405f20015490565b6001600160401b038111610cec5760051b60200190565b9060b48201809211612ff657565b6001600160401b038111610cec57601f01601f191660200190565b6001600160a01b039091168152602081019190915260400190565b805463ffffffff60581b191660589290921b63ffffffff60581b16919091179055565b3d156153d2573d906153b98261534f565b916153c76040519384615103565b82523d5f602084013e565b606090565b805460ff60781b191660789290921b60ff60781b16919091179055565b908060209392818452848401375f828201840152601f01601f1916010190565b805460ff60901b191660909290921b60ff60901b16919091179055565b92919261543d8261534f565b9161544b6040519384615103565b8294818452818301116106ac578281602093845f960137010152565b818110615472575050565b5f8155600101615467565b9190601f811161548c57505050565b61515e925f5260205f20906020601f840160051c830193106154b6575b601f0160051c0190615467565b90915081906154a9565b8160011b915f199060031b1c19161790565b8054600160401b811015610cec576154ef91600182018155615060565b9190916120bc57805182546001600160a01b0319166001600160a01b03919091161782556020810151805160018401916001600160401b038211610cec576155418261553b8554615079565b8561547d565b602090601f831160011461564d5761556292915f91836155d45750506154c0565b90555b6040810151805160028401916001600160401b038211610cec5761558d8261553b8554615079565b602090601f83116001146155df57936003936155bc8463ffffffff979560609589975f926155d45750506154c0565b90555b0151169201911663ffffffff19825416179055565b015190505f80610c5e565b90601f19831691845f52815f20925f5b81811061563557508460609463ffffffff9894600398948a986001951061561e575b505050811b0190556155bf565b01515f19838a1b60f8161c191690555f8080615611565b929360206001819287860151815501950193016155ef565b90601f19831691845f52815f20925f5b8181106156985750908460019594939210615680575b505050811b019055615565565b01515f1960f88460031b161c191690555f8080615673565b9293602060018192878601518155019501930161565d565b9062ff000082549160101b169062ff00001916179055565b9063ff00000082549160181b169063ff0000001916179055565b156156e957565b60405162461bcd60e51b81526020600482015260166024820152752330b4b632b2103a3790333ab7321039b2b9b9b4b7b760511b6044820152606490fd5b929160409261574e9296959660018060a01b031685526060602086015260608501916153f4565b6001600160a01b03909416910152565b805461ffff60201b191660209290921b61ffff60201b16919091179055565b805460ff60301b191660309290921b60ff60301b16919091179055565b805463ffffffff60381b191660389290921b63ffffffff60381b16919091179055565b805460ff60881b191660889290921b60ff60881b16919091179055565b805460ff60981b191660989290921b60ff60981b16919091179055565b8051821015611c815760209160051b010190565b6001600160a01b03909116815260408101929161515e91602001906152b4565b903590601e19813603018212156106ac57018035906001600160401b0382116106ac576020019181360383136106ac57565b6040519061586c604083615103565b6019825278546f6f2066657720706c61796572732072656d61696e696e6760381b6020830152565b90602083828152019060208160051b85010193835f915b8383106158bb5750505050505090565b909192939495601f198282030186528635601e19843603018112156106ac578301602081019190356001600160401b0381116106ac5780360383136106ac5761590a60209283926001956153f4565b9801960194930191906158ab565b60ff60019116019060ff8211612ff657565b60405190615939604083615103565b6009825268546f776e2077696e7360b81b6020830152565b60405190615960604083615103565b600a8252694d616669612077696e7360b01b6020830152565b60025f54146159885760025f55565b633ee5aeb560e01b5f5260045ffd5b335f908152601860205260409020546001600160a01b031690816159bb5750503390565b815f52601760205260405f2060ff60018201541615615a0e575463ffffffff8160a01c1642116159ff5760c01c036159f05790565b637ce3c8fd60e11b5f5260045ffd5b630fe82d2560e11b5f5260045ffd5b635f8874dd60e11b5f5260045ffd5b615a59600391600293815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b50015416151590565b615a59600391600193815f52600760205260405f2090858060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b615a59600391600893815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b60ff60015416615ae557565b63d93c066560e01b5f5260045ffd5b615b2e90600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176080179055565b615b8590600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176008179055565b615bdc90600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176001179055565b615c3390600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176010179055565b90815f5260046020528160405f205f905f90835f52600560205260405f205f908054915b8260ff821610615f9657505050607f600260ff92015460191c16911690811180615f84575b15615f615781604091615cba5f516020616d625f395f51905f529486616475565b845f516020616d425f395f51905f52608085519460018060a01b03169485815286602082015260098782015268159bdd1959081bdd5d60ba1b6060820152a282519182526020820152a25b815f52600560205260405f20915f5b835460ff82161015615da85780615d2e615da39286615060565b50545f848152600b602090815260408083206001600160a01b0390941680845293825280832080546001600160a01b0319169055868352600c825280832093835292905220805460ff191690556003615d878287615060565b5001805463fffffffb811663ffffffff199091161790556152d0565b615d14565b505f818152600460205260409020600201805460ff60801b19169055909150615dd081616bf6565b15615dd85750565b5f818152600460205260409020600201805460ff61ffff60881b011916600517815542603c810191908210612ff65763ffffffff615e17921690615385565b805f52600560205260405f205f5b815460ff82161015615efb5780615e3f615ef69284615060565b50546001600160a01b03166003615e568386615060565b5001805463ffffffe7811663ffffffff199091161790555f858152600d602090815260408083206001600160a01b03949094168084529382528083208381556001908101849055888452600e83528184208585528352818420805460ff19169055888452600f8352818420858552835281842080546001600160a01b031916905588845260138352818420948452939091528120818155909101556152d0565b615e25565b50505f818152601460209081526040808320805460ff1990811690915560158352818420805490911690556016909152812080546001600160a01b03191690557f34b0c4c95aa7776d35dbd8b24afd53388828c61c26fd5a6b11a21809662440879080a2565b50505f516020616d625f395f51905f52604080515f81525f6020820152a2615d05565b506001600160a01b0382161515615c99565b9091929394955060026003615fab8385615060565b50015416615fc9575b615fbd906152d0565b90879594939291615c74565b615fd38183615060565b50545f898152600c602090815260408083206001600160a01b039094168084529390915290205460ff9081169087168111616010575b5050615fb4565b9096509450615fbd5f616009565b335f9081527fe5ebfa64fca8d502a8e50c1edffd2c31ef4dad5b396e65d9f397fb028f74abc5602052604090205460ff161561605657565b63e2517d3f60e01b5f52336004525f516020616da25f395f51905f5260245260445ffd5b5f81815260026020908152604080832033845290915290205460ff161561609e5750565b63e2517d3f60e01b5f523360045260245260445ffd5b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff1661613a575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19166001179055339291907f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d9080a4600190565b50505f90565b5f81815260046020908152604091829020600201805460ff63ffffffff60581b0119166006179055905181815291927fd778487128ba4386ebcfb2703af01f8a2a2b8663f880622d26a77a29397e68f3929182916161a0918301906151c6565b0390a2565b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff161561613a575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19169055339291907ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9080a4600190565b805f526004602052600260405f2001600360ff1982541617815561ffff815460201c169061ffff8214612ff65761ffff60209161628a60017fa9b4e96158ed085745975f198fa026959997245ae7e7aed9cd0252ce02b2107195018261575e565b61629a63ffffffff42168261579a565b6162ab63ffffffff610b9b42615341565b54821c16604051908152a2565b6001600160a01b0390911691908215611c9557825f52601960205260ff60405f205416616466575f838152601860205260409020546001600160a01b0316616466576001600160a01b03165f8181526017602052604090206001015490919060ff16616421575b6138404201804211612ff6577f290e52799b1ac63207e28c21f7f1f387cf8ea9257dde8e363a02e157d8e4c6589163ffffffff604092166163e58351616364816150b1565b8781526020808201848152600180881b5f19018716888501908152606085018281525f8c81526017909552938990209451925190516001600160c01b031960c09190911b166001600160a01b0390931663ffffffff60a01b60a09290921b919091161791909117835590519101805460ff191691151560ff16919091179055565b5f8681526018602090815284822080546001600160a01b031916881790556019815290849020805460ff191660011790558351928352820152a3565b5f828152601760209081526040808320546001600160a01b031683526018825280832080546001600160a01b031916905560199091529020805460ff1916905561631f565b631fef749360e21b5f5260045ffd5b906164808183615a1d565b156164fa57815f52600760205260405f209060018060a01b03165f5260205260036164bd60ff60405f205416835f52600560205260405f20615060565b500163ffffffff63fffffffd8254161663ffffffff198254161790555f52600460205261515e600260405f200161322460ff825460181c166152c1565b5050565b90815f5260166020528160018060a01b0360405f2054165f825f52600560205260405f205f908054905b8160ff8416106166d5575b505050827fb874a4c95be602274c8e6944d4d375ca4189eda377b69ee751f3b92dd4dcf2d8604051806165678587836152fe565b0390a281151590816166c1575b50616672575b505f52600560205260405f20915f5b835460ff8216101561663857806165a36166339286615060565b50545f848152600d602090815260408083206001600160a01b03909416808452938252808320838155600101839055868352600e82528083208484528252808320805460ff19169055868352600f82528083209383529290522080546001600160a01b031916905560036166178287615060565b5001805463ffffffe7811663ffffffff199091161790556152d0565b616589565b505f818152600460205260409020600201805461ffff60881b1916905590915061666181616bf6565b156166695750565b61515e90616229565b60808161668d5f516020616d425f395f51905f529385616475565b60405190815260406020820152600f60408201526e12da5b1b195908185d081b9a59da1d608a1b6060820152a2815f61657a565b6001600160a01b031682141590505f616574565b909194506166e38582615060565b50545f888152600e602090815260408083206001600160a01b039094168084529390915290205460ff1695906004871015610668576002899714616732575061672b906152d0565b9190616528565b5f878152600f602090815260408083206001600160a01b03948516845290915281205490911694509250829150819050616533565b5f52600560205260405f205f8154905b8160ff82161061678a575060ff91501690565b600260036167988386615060565b500154166167ae576167a9906152d0565b616777565b91505090565b5f52600560205260405f20908154905b8160ff8216106167d7575060ff91501690565b600260036167e58386615060565b500154166167ae576167f6906152d0565b6167c4565b5f8181526004602052604090206002908101805460ff64ff000000ff60781b01191690911781556168349063ffffffff610ff442615341565b5f52600560205260405f20905f5b825460ff8216101561689a57806002600361686061686d9487615060565b50015416616872576152d0565b616842565b600361687e8286615060565b5001805463ffffff9e811663ffffffff199091161790556152d0565b509050565b5f818152600560205260408120805492915b8360ff8216106168c45750505050600190565b600260036168d28385615060565b500154161515806168f8575b6168f0576168eb906152d0565b6168b1565b505050505f90565b50825f52601060205260405f2061690f8284615060565b50546001600160a01b03165f908152602091909152604090205460ff16600581101561066857156168de565b905f5f92805f52600560205260405f205f918154925b8360ff821610616992575050505060ff1680159283159182616984575b508361697957509190565b60ff91935016151590565b60ff8216111591505f61696e565b600260036169a08386615060565b500154166169b7575b6169b2906152d0565b616951565b93815f52601060205260405f206169ce8685615060565b50546001600160a01b03165f908152602091909152604090205460ff1660058110156106685760018103616a125750616a096169b2916152d0565b945b90506169a9565b909490616a23575b6169b290616a0b565b95616a306169b2916152d0565b969050616a1a565b805f52601460205260ff60405f20541615616bf3575f81815260056020526040812080546001918390815b8360ff821610616b04575b505050505f516020616de25f395f51905f5291818060409390616af2575b15616aeb57815b5f868152601660205284902080546001600160a01b0319166001600160a01b03851617905581616ad8575b5082516001600160a01b03909216825215156020820152a2565b6001600160a01b0316151590505f616abe565b5f91616a93565b506001600160a01b0382161515616a8c565b616b0e8183615060565b50545f8881526013602090815260408083206001600160a01b03949094168084529390915290206001015460a01c60ff1680616bd9575b616b59575b50616b54906152d0565b616a63565b5f8881526013602090815260408083206001600160a01b0394851684529091529020600101549296919392169180616b9b57505093616b546001925b90616b4a565b9095909290916001600160a01b03871603616bb957616b5490616b95565b505050505060405f516020616de25f395f51905f52915f9181935f616a6e565b5060026003616be88486615060565b500154161515616b45565b50565b805f52600460205260ff600260405f20015460181c166001811115616c5e5750616c1f8161689f565b616c2857505f90565b616c318161693b565b9015616c495750616c449061083f615951565b600190565b616c5257505f90565b616c449061083f61592a565b616c449190616c8c57604051616c75604082615103565b60048152634472617760e01b602082015290616140565b604051616c9a604082615103565b60148152734c61737420706c61796572207374616e64696e6760601b60208201529061614056fea4a46989ff60ad96ec74df0f289e1e16b51c97fecb224f2e8e927103d5b54eaef33c1bd762b898b33040e70f49cf90ff496cf7366f6fafa9d961b0de89b7244b3b7d84e02e9f6642b42e0ca3e77297f9c7c807832a60c0fc1926ade76abc7badcf33babc496bb6dc2942b39cb7b75766bbbadf7da50d176ff8c513e991140239b1ed64d561b0179e61c72bf46d0809a99dac99baeb98fc9f5d13be1f6c2e3f826b571d1c11516ea63adff1048766bdfa510e9c5bf4e32ca29d4ba11e16edf2f18ef7613b6eacaa71c74d950e2c093c23a0d3ecb066d1387d80e95159d07ed08ba49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177582b52ddf0195aa8ac16480985f5042052aa742563721520fa34764d253824d43020f20553b51a906b0cb24d2431eb46bd2dc31b5c75d4ba8165ff1bb284ad2a1a2646970667358221220e22b3b20786586e4e9a4a292d4eb671bbaf0ad03af432deab3f74da465ba281e64736f6c634300081c00332f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0dac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077be5ebfa64fca8d502a8e50c1edffd2c31ef4dad5b396e65d9f397fb028f74abc5",
  "deployedBytecode": "0x6080806040526004361015610012575f80fd5b5f3560e01c90816301ffc9a714614fcb5750806302d947ef14614ca857806307a52cab14614c8b57806309ed3e2214614bf657806312c57f55146113fa57806314a09d6014614bc05780631bae0ac814614aa9578063248a9ca314614a835780632a51fb3a146149ae5780632f2ff15d1461497d57806330a05e7314612a9a57806334ad36f61461464a57806335b97299146145d557806336568abe1461459157806337048f21146144a65780633d2f5bda1461430f5780633deaa341146142f35780633ec09d2c146142b65780633f4ba83a1461422b5780633fb5d9f51461407c57806343cd690314613e7e578063460e204914613d2b578063476343ee14613cc157806348e69d1f14613c225780634f324d1414613be25780635099fae214613ae1578063567e8dd514613a8f5780635c975abb14613a6d5780635d99dc3e146139c65780635e82ff65146139ab57806361ea2027146139645780636594bb0c146135fa578063660e907c146135b1578063669ead17146135655780636920e3ee146135385780636d8a74cb146132b85780636e2083f4146132865780637120465b1461307757806375b238fc146130505780637fa9c28914613035578063800122d614612ac757806382fab9d814612a9a57806384411c0a14612a535780638456cb59146129d65780638a8dd7f4146129925780638d29f52f1461293357806391d14854146128ea57806394225e9d146125b55780639691352814612572578063a05bcf021461253b578063a217fddf14612521578063aa55acbf146124bc578063ac204410146124a1578063af384791146120ea578063af7efa7c146120cf578063b6bf359a14611e1b578063b7b8d60414611db3578063bb9ae875146119ee578063bcb72159146117fa578063c96f097914611632578063d065539414611505578063d23254b4146114bb578063d547741f14611483578063d6df096d1461145b578063d94a51cb146113fa578063dae2928a14611034578063e5ed1d5914610f22578063e851122d14610ed4578063ea99c3fe14610deb578063eb02410114610931578063eb0fa6f8146108e7578063f14caed714610884578063f30818ff14610787578063f3db5133146106b05763ff99233a14610355575f80fd5b346106ac5760603660031901126106ac5760043561037161501e565b6044356001600160401b0381116106ac5761039090369060040161524a565b91610399615979565b6103a284615997565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576103d39085615a1d565b1561061d57835f52600460205263ffffffff600260405f20015460581c1615158061068b575b61067c57610405615ad9565b61040e84615997565b92845f52600460205260ff600260405f2001541660078110156106685760050361065957845f52601160205260405f2060018060a01b0385165f5260205260405f20541561064a57845f52601360205260405f2060018060a01b0385165f5260205260ff600160405f20015460a01c1661063b5761048c8486615af4565b6001600160a01b03821692836105ef575b6104d06104c291604051928391602083019588875260408085015260608401916153f4565b03601f198101835282615103565b519020845f52601360205260405f2060018060a01b0385165f5260205260405f2054036105e0575f8481526013602090815260408083206001600160a01b03871684529091529020600101805460ff60a01b19939093166001600160a81b031990931692909217600160a01b1790915582917f307ed77ec1f8fe53e10faa7fa486ba5e5b66eab3a9d19902c20b0da3c3b0b26a919061056f8185615bf9565b835f52601560205260405f2060ff610589818354166152d0565b1660ff198254161790556105a2604051928392836152fe565b0390a2805f52601560205260ff60405f205416815f52601460205260ff60405f205416146105d1575b60015f55005b6105da90616a38565b5f6105cb565b6336c5b53760e11b5f5260045ffd5b855f52600660205260405f20845f5260205260ff60405f2054161561062c576106188387615a1d565b61049d575b630575d90f60e11b5f5260045ffd5b63721c7c6760e11b5f5260045ffd5b633a456ae760e11b5f5260045ffd5b631ea3b68b60e21b5f5260045ffd5b6338961af360e21b5f5260045ffd5b634e487b7160e01b5f52602160045260245ffd5b6301a6f70d60e01b5f5260045ffd5b50835f52600460205263ffffffff600260405f20015460581c1642116103f9565b5f80fd5b346106ac5760203660031901126106ac576004355f5f5b825f52600560205260405f205460ff8216101561077957825f5260056020526106f38160405f20615060565b50545f8481526010602090815260408083206001600160a01b039094168352929052205460ff1660058110156106685760011480610754575b61073f575b61073a906152d0565b6106c7565b9061074c61073a916152d0565b919050610731565b50825f5260056020526002600361076e8360405f20615060565b50015416151561072c565b60208260ff60405191168152f35b346106ac5760203660031901126106ac576004356107a3615979565b6107ac81615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576107dd9082615a1d565b1561061d576107ea615ad9565b805f52600460205260ff600260405f200154166007811015610668578015908115610879575b506106595761081e8161689f565b1561086a5761082c8161693b565b901561084557506105cb9061083f615951565b90616140565b1561085b576108569061083f61592a565b6105cb565b63308ce0f960e11b5f5260045ffd5b63837cd79f60e01b5f5260045ffd5b600691501482610810565b346106ac5760403660031901126106ac5761089d61501e565b6004355f52600d60205260405f209060018060a01b03165f52602052606060405f2063ffffffff6001825492015460405192835260ff81161515602084015260081c166040820152f35b346106ac5760403660031901126106ac5761090061501e565b6004355f908152600f602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b346106ac5760603660031901126106ac576004356024356001600160401b0381116106ac57610964903690600401615284565b6044356001600160401b0381116106ac5761098390369060040161524a565b9261098c615979565b61099585615997565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576109c69086615a1d565b1561061d57845f52600460205263ffffffff600260405f20015460581c16151580610dca575b61067c576109f8615ad9565b610a0185615997565b91855f526004602052600260405f20019485549160ff831660078110156106685760010361065957610a5f6104c291604051928391602083019560408752610a4d606085018c8b615894565b848103601f19016040860152916153f4565b519020865f52600860205260405f2060018060a01b0385165f5260205260405f205403610dbb5760328411610dac57855f52600960205260405f2054159081610d9c575b50610d7757845f52600960205260405f2054151580610d86575b610d77575f858152600960205260409020600160401b8411610cec578054848255808510610d00575b505f908152602081208694939291825b858210610c085750505090610bd97f1522116f5d4e7ac5527e161307d73b93c621a9a7627553f584afb6b6f62a74e79392855f52600860205260405f2060018060a01b0384165f52602052600260405f2001600160ff19825416179055610bb8610b6f610b6960ff8a5460301c16615918565b886167b4565b97610b7a898261577d565b610b8a63ffffffff42168261579a565b610ba263ffffffff610b9b42615341565b1682615385565b610bb260ff825460901c166152d0565b90615414565b60405193849360018060a01b03168452604060208501526040840191615894565b0390a2815f52600560205260ff60405f205491161015610bf95760015f55005b610c02906167fb565b806105cb565b90919293949550610c19818561582b565b906001600160401b038211610cec57610c3c82610c368754615079565b8761547d565b5f90601f8311600114610c825792610c65836001959460209487965f92610c77575b50506154c0565b86555b01930191018795949392610af6565b013590508e80610c5e565b601f19831691865f5260205f20925f5b818110610cd45750936020936001969387969383889510610cbb575b505050811b018655610c68565b01355f19600384901b60f8161c191690558d8080610cae565b91936020600181928787013581550195019201610c92565b634e487b7160e01b5f52604160045260245ffd5b815f528460205f2091820191015b818110610d1b5750610ae6565b80610d2860019254615079565b80610d35575b5001610d0e565b601f81118314610d4a57505f81555b89610d2e565b610d6690825f5283601f60205f20920160051c82019101615467565b805f525f6020812081835555610d44565b63d1d2a30960e01b5f5260045ffd5b50845f52600960205260405f2054831415610abd565b60ff915060101c16831086610aa3565b63376ab11160e01b5f5260045ffd5b639ea6d12760e01b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c1642116109ec565b346106ac5760203660031901126106ac57600435610e07615979565b610e1081615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57610e419082615a1d565b1561061d57610e4e615ad9565b805f526004602052600260405f20015460ff811660078110156106685760050361065957815f52601460205260ff60405f2054168015159081610ebb575b50610eac5760ff808260881c169160901c1610610dbb576105cb906164fe565b6303488f9960e61b5f5260045ffd5b9050825f52601560205260ff60405f2054161083610e8c565b346106ac5760403660031901126106ac57610eed61501e565b6004355f52601060205260405f209060018060a01b03165f52602052602060ff60405f205416610f2060405180926152b4565bf35b346106ac5760203660031901126106ac57600435610f3e615979565b610f4781615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57610f789082615a1d565b1561061d57610f85615ad9565b805f526004602052600260405f2001805460ff81166007811015610668576106595760ff60049160101c161061102557805460ff19166001178155610ffb90610fd6610fd084616767565b8261577d565b610fe663ffffffff42168261579a565b63ffffffff610ff442615341565b1690615385565b7f50ad08f58a27f2851d7e3a1b3a6a46b290f2ce677e99642d30ff639721e777905f80a260015f55005b63f770074360e01b5f5260045ffd5b346106ac5760203660031901126106ac57600435611050615979565b61105981615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c5761108a9082615a1d565b1561061d57611097615ad9565b805f526004602052600260405f2001805463ffffffff8160581c1680159081156113ef575b506113e05760ff16827f77ff69c1f99cadd93a6da75080e20a3fed43f1d42375051a5d162adcafc5fbb760206040516110f58186615224565ba260078110156106685760018103611249575050805f526004602052600260405f20018160ff825460301c16815f52600560205260405f205481106111d4575b505061115061114a60ff835460301c16615918565b836167b4565b61115a818361577d565b61116a63ffffffff42168361579a565b61118263ffffffff61117b42615341565b1683615385565b825f52600560205260ff60405f2054911610156111a2575b505060015f55005b54600260189190911c60ff16106111c3576111bc906167fb565b808061119a565b6111cf9061083f61585d565b6111bc565b60806111f95f516020616d825f395f51905f5292845f52600560205260405f20615060565b50546001600160a01b031661120e8185616475565b60405190815260406020820152601660408201527554696d656f757420647572696e672073687566666c6560501b6060820152a28183611135565b600281036113705750815f52600560205260405f205f5b815460ff8216101561134857806002600361127e61128b9486615060565b50015416611290576152d0565b611260565b6020600361129e8386615060565b5001541615600160036112b18487615060565b50015416158115611340575b50156152d0576112e16112d08285615060565b50546001600160a01b031686616475565b845f516020616d825f395f51905f5260806112fc8487615060565b5054604080516001600160a01b0390921682526020820181905260159082015274151a5b595bdd5d08191d5c9a5b99c81c995d99585b605a1b6060820152a26152d0565b9050866112bd565b505054600260189190911c60ff16106113645761085690616229565b6108569061083f61585d565b6004810361138357505061085690615c50565b60058103611396575050610856906164fe565b6003146113a5575b50506105cb565b805460ff60ff60801b01191660041781556113c89063ffffffff610ff442615341565b5f516020616d225f395f51905f525f80a2808061139e565b63489e8c8960e01b5f5260045ffd5b9050421115846110bc565b346106ac57611408366151ea565b915f52600a60205260405f209060018060a01b03165f5260205260405f209060018060a01b03165f5260205261145761144360405f20615126565b6040519182916020835260208301906151c6565b0390f35b346106ac575f3660031901126106ac576003546040516001600160a01b039091168152602090f35b346106ac5760403660031901126106ac576114b96004356114a261501e565b906114b46114af82615318565b61607a565b6161a5565b005b346106ac5760403660031901126106ac576114d461501e565b6004355f908152600b602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b346106ac5760203660031901126106ac576004355f52601260205260405f208054906115308261532a565b9161153e6040519384615103565b8083526020830180925f5260205f205f915b8383106115e857848660405191829160208301906020845251809152604083019060408160051b85010192915f905b82821061158e57505050500390f35b919360019193955060208091603f1989820301855287519060406115bb83516060845260608401906151c6565b9263ffffffff85820151168584015281878060a01b0391015116910152960192019201859493919261157f565b600260206001926040516115fb816150e8565b61160486615126565b81528486015463ffffffff811684830152858060a01b0390841c166040820152815201920192019190611550565b346106ac576116403661504a565b611648615979565b61165182615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576116829083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c161515806117d9575b61067c576116b4615ad9565b6116bd82615997565b90825f526004602052600260405f20019160ff835416600781101561066857600503610659576116ed8185615a9d565b6117ca576117b27f3cf64897479c2ba314a5a0e8cf3a0e097d9367de65da54961e4dc4148364990093604051611722816150e8565b84815260208101905f82526117786001604083019263ffffffff421684528a5f52600d60205260405f20828060a01b0389165f5260205260405f20905181550192511515839060ff801983541691151516179055565b5164ffffffff0082549160081b169064ffffffff00191617905561179c8387615b4b565b6117ac60ff825460881c166152d0565b906157bd565b6117c16040519283928361536a565b0390a260015f55005b6317fd8aab60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c1642116116a8565b346106ac576118083661504a565b611810615979565b61181982615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c5761184a9083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c161515806119cd575b61067c5761187c615ad9565b61188582615997565b90825f526004602052600260405f20019160ff83541660078110156106685760020361065957835f52601160205260405f2060018060a01b0382165f5260205260405f20546119be576118d88185615a62565b6119af5760205f516020616dc25f395f51905f5291855f516020616ce25f395f51905f5261192c8296835f526011865260405f2060018060a01b0386165f5286528060405f2055604051918291868361536a565b0390a26119398185615ba2565b61195261194c60ff875460781c166152d0565b866153d7565b6040516001600160a01b039091168152a25460ff808260181c169160781c161461197c5760015f55005b61198581616229565b7f54ccd98022ba3fd547cb241a4f3dfc13e7f9bb54550b7babf4080021c6c2f1265f80a2806105cb565b63a89ac15160e01b5f5260045ffd5b630890382360e21b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211611870565b346106ac5760603660031901126106ac576004356024356001600160401b0381116106ac57611a21903690600401615284565b6044356001600160401b0381116106ac57611a40903690600401615284565b9092611a4a615979565b611a5385615997565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57611a849086615a1d565b1561061d57845f52600460205263ffffffff600260405f20015460581c16151580611d92575b61067c57611ab6615ad9565b611abf85615997565b93855f526004602052600260405f200160ff81541660078110156106685760020361065957838503611d835760328511610dac57865f52600760205260405f2060018060a01b0387165f5260205260206003611b2c60ff60405f2054168a5f526005845260405f20615060565b50015416611d745793946001600160a01b0316935f5b8787821015611ca457506001600160a01b03600582901b8581013591821692918390036106ac57895f52600660205260405f20835f5260205260ff60405f2054161561062c57878314611c955786821015611c8157611ba39085018561582b565b9190928a5f52600a60205260405f20895f5260205260405f20905f5260205260405f2060018060401b038311610cec5782611be98c94611be38454615079565b8461547d565b5f601f8211600114611c17579080611c0c92600196975f92610c775750506154c0565b90555b019050611b42565b94601f19821695835f5260205f20965f5b818110611c6657509160019697918488959410611c4d575b505050811b019055611c0f565b01355f19600384901b60f8161c191690558d8080611c40565b8284013589556001909801978f975060209283019201611c28565b634e487b7160e01b5f52603260045260245ffd5b637f043f9b60e01b5f5260045ffd5b82817f9204f1001d8059e799b3a233fa5114eab3b5d30762de3ff4e07fcd7e6266aad160208a835f526007825260405f20815f5282526003611cf760ff60405f205416865f526005855260405f20615060565b500163ffffffff8381835416171663ffffffff19825416179055611d2a611d2460ff875460981c166152d0565b866157da565b604051908152a25460ff808260181c169160981c1614611d4a5760015f55005b7ff6b9b3035e320bcce495d00c2d31a7bd341754f7b9919a4a736388e16ef674a55f80a2806105cb565b6387db46a560e01b5f5260045ffd5b634ec4810560e11b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c164211611aaa565b346106ac5760203660031901126106ac576001600160a01b03611dd4615034565b165f526017602052608060405f2060ff60018254920154166040519160018060a01b038116835263ffffffff8160a01c16602084015260c01c604083015215156060820152f35b346106ac5760403660031901126106ac576004356024356001600160401b0381116106ac57611e4e90369060040161524a565b611e59929192615979565b611e6282615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57611e939083615a1d565b1561061d57611ea0615ad9565b611ea982615997565b92825f52600460205260ff600260405f2001541660078110156106685760050361065957825f52601160205260405f2060018060a01b0385165f5260205260405f20541561064a576104008211610dac57611f048484615af4565b825f52601260205260405f209060405194611f1e866150e8565b611f29368584615431565b86524263ffffffff16602087019081526001600160a01b0390911660408701818152845491949091600160401b811015610cec57611f6c91600182018155615231565b9790976120bc575180519097906001600160401b038111610cec57611f9581611be38454615079565b6020601f821160011461203c5760016117c196959493611fd48463ffffffff9586955f516020616cc25f395f51905f529e9f5f926120315750506154c0565b81555b9451940180549351600160201b600160c01b03199290951692909216166001600160c01b031990921691909117602092831b600160201b600160c01b031617905560408051948552908401819052929384938401916153f4565b015190508f80610c5e565b601f19821699835f52815f209a5f5b8181106120a45750936001845f516020616cc25f395f51905f529c9d63ffffffff9695839588976117c19d9c9b9a1061208c575b505050811b018155611fd7565b01515f1960f88460031b161c191690558e808061207f565b838301518d556001909c019b6020938401930161204b565b634e487b7160e01b5f525f60045260245ffd5b346106ac575f3660031901126106ac57602060405160328152f35b346106ac5760603660031901126106ac5760043560243560058110156106ac576044356001600160401b0381116106ac5761212990369060040161524a565b612134929192615979565b61213d84615997565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c5761216e9085615a1d565b1561061d5761217b615ad9565b61218484615997565b92845f52601060205260405f2060018060a01b0385165f5260205260ff60405f20541660058110156106685761249257845f52601160205260405f2060018060a01b0385165f5260205260405f20541561064a57604082116124835761220c6104c29160405192839160208301956121fc87896152b4565b60408085015260608401916153f4565b519020835f52601160205260405f2060018060a01b0384165f5260205260405f20540361247457825f52601060205260405f2060018060a01b0383165f5260205260405f20905f9160ff1981541660ff8316179055837f9b013793e3fbc06d6ff5e9b6ce06be7c635e957579a85ae6b262b85b13ecd8746040518061229285888361580b565b0390a2835f52600760205260405f2060018060a01b0384165f52602052608060036122cf60ff60405f205416875f52600560205260405f20615060565b50015416151580612466575b6123bf575b835f52600760205260405f2060018060a01b0384165f52602052610100600361231b60ff60405f205416875f52600560205260405f20615060565b50015416151591826123ad575b50506123345760015f55005b60a08161234f5f516020616d425f395f51905f529385616475565b60405190600180841b0316815260406020820152602c60408201527f557365642064657465637469766520636865636b2077697468206e6f6e2d646560608201526b7465637469766520726f6c6560a01b6080820152a280806105cb565b90915061066857600314158380612328565b6123c98385616475565b837f7f1edd8653eda945bad547f4f89adfa659b5f748dc9d88a447ff44550d7210be604051806123fa85888361580b565b0390a2835f516020616d425f395f51905f5260a0604051600180831b038716815260406020820152602860408201527f55736564206d616669612066756e6374696f6e732077697468206e6f6e2d6d6160608201526766696120726f6c6560c01b6080820152a26122e0565b505f915060018114156122db565b63134fed2d60e01b5f5260045ffd5b63bf1ad44360e01b5f5260045ffd5b63fd8fd76760e01b5f5260045ffd5b346106ac575f3660031901126106ac576020604051603c8152f35b346106ac5760403660031901126106ac576124d561501e565b6004355f52601360205260405f209060018060a01b03165f52602052606060405f2060ff6001825492015460405192835260018060a01b038116602084015260a01c1615156040820152f35b346106ac575f3660031901126106ac5760206040515f8152f35b346106ac576125493661504a565b905f52600960205260405f2080548210156106ac5761145791611443915f5260205f2001615126565b346106ac5760203660031901126106ac5761258b615034565b61259361601e565b600380546001600160a01b0319166001600160a01b0392909216919091179055005b346106ac5760203660031901126106ac57335f90815260186020526040902054600435906001600160a01b0316156128e457335f908152601860205260409020546001600160a01b03165b815f52600560205260405f20905f5f908354915b8260ff821610612847575060ff169161262c8361532a565b9361263a6040519586615103565b8385526126468461532a565b602086019690601f190136883761265c8561532a565b9461266a6040519687615103565b808652612679601f199161532a565b015f5b8181106128345750505f915f5b8560ff82161061273d57888888604051928392604084019060408552518091526060840191905f5b81811061271b575050508281036020840152815180825260208201916020808360051b8301019401925f915b8383106126ea5786860387f35b919395509193602080612709600193601f1986820301875289516151c6565b970193019301909286959492936126dd565b82516001600160a01b03168452869550602093840193909201916001016126b1565b8761274c82849b999a9b615060565b50546001600160a01b03908116908716811415806127f5575b61277e575b5050612775906152d0565b97969597612689565b946127e56127eb9287612775959861279a60ff861680946157f7565b52875f52600a60205260405f209060018060a01b03165f5260205260405f2060018060a01b038a165f526020528b6127de826127d860405f20615126565b926157f7565b528b6157f7565b506152d0565b939050888a61276a565b505f858152600a602090815260408083206001600160a01b038581168552908352818420908b16845290915290205461282d90615079565b1515612765565b606060208289018101919091520161267c565b6128548186979597615060565b50546001600160a01b038781169116141580612896575b612881575b612879906152d0565b949294612614565b9061288e612879916152d0565b919050612870565b50835f52600a60205260405f206128ad8287615060565b50546001600160a01b039081165f90815260209283526040808220928a168252919092529020546128dd90615079565b151561286b565b33612600565b346106ac5760403660031901126106ac5761290361501e565b6004355f52600260205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b346106ac5760203660031901126106ac576060600435805f52601460205260ff60405f20541690805f52601560205260ff60405f205416905f52601660205260018060a01b0360405f2054169060405192835260208301526040820152f35b346106ac5760403660031901126106ac576129ab61501e565b6004355f52601160205260405f209060018060a01b03165f52602052602060405f2054604051908152f35b346106ac575f3660031901126106ac576129ee61601e565b6129f6615ad9565b600160ff19815416176001557f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a2586020604051338152a1337f7c83004a7e59a8ea03b200186c4dda29a4e144d9844d63dbc1a09acf7dfcd4855f80a2005b346106ac5760403660031901126106ac57612a6c61501e565b6004355f52600760205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b346106ac5760203660031901126106ac576004355f526014602052602060ff60405f205416604051908152f35b60a03660031901126106ac576004356001600160401b0381116106ac57612af290369060040161524a565b906024359160ff831683036106ac576044356001600160401b0381116106ac57612b2090369060040161524a565b9093906064356001600160401b0381116106ac57612b4290369060040161524a565b9560843594919390916001600160a01b03861686036106ac57612b63615979565b612b6b615ad9565b600460ff8316108015613028575b613019576020811161300a57601a54965f198814612ff65760018801601a5560405191612ba5836150cc565b6001600160401b0389168352336020840190815293612bc5368385615431565b604085019081525f606086015260ff821660808601525f60a08601525f60c08601525f60e08601525f61010086015263ffffffff42166101208601525f6101408601525f6101608601525f6101808601525f6101a08601525f6101c08601525f6101e08601528a5f52600460205260405f209560018060401b03865116875491600160401b600160e01b03905160401b169163ffffffff60e01b16171786555180519060018060401b038211610cec57612c8f82612c8660018a0154615079565b60018a0161547d565b602090601f8311600114612f8957612cb092915f9183612f7e5750506154c0565b60018601555b60608401519360078510156106685760028087018054608084015161ffff1990911660ff9889161760089190911b61ff001617815560a08301518d987fd9abe6195309293e802058345712163744c28bde8471531f9990f08419585bcf98612deb9591949390926101e09291612d2e918516906156b0565b612d408360c0830151168587016156c8565b612d5461ffff60e08301511685870161575e565b612d67836101008301511685870161577d565b612d7e63ffffffff6101208301511685870161579a565b612d9563ffffffff61014083015116858701615385565b612da883610160830151168587016153d7565b612dbb83610180830151168587016152e1565b612dce836101a0830151168587016157bd565b612de1836101c083015116858701615414565b01511691016157da565b60ff612e0a6040519485943386526060602087015260608601916153f4565b911660408301520390a260808211612f6f576104008611612f6057612f198594612e856020985f516020616d025f395f51905f5296885f5260058b52612e7460405f209160405193612e5b856150b1565b338552612e69368b8b615431565b8e8601523691615431565b6040830152600260608301526154d2565b5f86815260068952604080822033808452908b52818320805460ff1990811660011790915589845260078c52828420918452908b52818320805490911690558782526004808b528183206002908101805462ff0000191662010000179055898452908b52912001805463ff000000191663010000001790556001600160a01b038116612f28575b6040519384933385615727565b0390a260015f55604051908152f35b612f338682336162b8565b3415612f0c57612f5b5f808080346001600160a01b0387165af1612f556153a8565b506156e2565b612f0c565b63450bc0a760e01b5f5260045ffd5b636f6003c360e01b5f5260045ffd5b015190508e80610c5e565b9190600188015f52805f20905f935b601f1984168510612fdb576001945083601f19811610612fc3575b505050811b016001860155612cb6565b01515f1960f88460031b161c191690558d8080612fb3565b81810151835560209485019460019093019290910190612f98565b634e487b7160e01b5f52601160045260245ffd5b630b279b2f60e41b5f5260045ffd5b6319413ccd60e11b5f5260045ffd5b50601460ff831611612b79565b346106ac575f3660031901126106ac57602060405160b48152f35b346106ac575f3660031901126106ac5760206040515f516020616da25f395f51905f528152f35b60803660031901126106ac576004356024356001600160401b0381116106ac576130a590369060040161524a565b6044356001600160401b0381116106ac576130c490369060040161524a565b92906064356001600160a01b0381168082036106ac576130e2615979565b6130ea615ad9565b865f526004602052600260405f200195865460ff81166007811015610668576106595760ff808260081c169160101c161015613277575f88815260066020908152604080832033845290915290205460ff166132695760808611612f6f576104008111612f60575f516020616d025f395f51905f5296886131b48861322a94612e746117c199855f52600560205260ff60405f205416955f52600560205260405f20926131a88d6040519661319e886150b1565b3388523691615431565b60208601523691615431565b5f8a815260066020908152604080832033808552908352818420805460ff199081166001179091558e8552600784528285209185529252909120805490911660ff92831617905581546132149161320e9160101c166152d0565b826156b0565b61322460ff825460181c166152d0565b906156c8565b8061323e575b506040519384933385615727565b6132498783336162b8565b3415613230575f8080806132639434905af1612f556153a8565b86613230565b621d934160e11b5f5260045ffd5b63bc42480360e01b5f5260045ffd5b346106ac5760203660031901126106ac576004355f526016602052602060018060a01b0360405f205416604051908152f35b346106ac5760203660031901126106ac575f6101e06040516132d9816150cc565b828152826020820152606060408201528260608201528260808201528260a08201528260c08201528260e08201528261010082015282610120820152826101408201528261016082015282610180820152826101a0820152826101c082015201526004355f52600460205260405f20600260405191613357836150cc565b80546001600160401b038116845260401c6001600160a01b0316602084015261338260018201615126565b6040840152015460ff81169060078210156106685760ff916060840152818160081c166080840152818160101c1660a0840152818160181c1660c084015261ffff8160201c1660e0840152818160301c1661010084015263ffffffff8160381c1661012084015263ffffffff8160581c16610140840152818160781c16610160840152818160801c16610180840152818160881c166101a0840152818160901c166101c084015260981c166101e082015260405180916020825260018060401b03815116602083015260018060a01b03602082015116604083015260ff6101e061347d604084015161020060608701526102208601906151c6565b9261349060608201516080870190615224565b8260808201511660a08601528260a08201511660c08601528260c08201511660e086015261ffff60e082015116610100860152826101008201511661012086015263ffffffff6101208201511661014086015263ffffffff61014082015116610160860152826101608201511661018086015282610180820151166101a0860152826101a0820151166101c0860152826101c082015116828601520151166102008301520390f35b346106ac5760203660031901126106ac576004355f526015602052602060ff60405f205416604051908152f35b346106ac5760403660031901126106ac5761357e61501e565b6004355f52600e60205260405f209060018060a01b03165f52602052602060ff60405f205416610f206040518092615277565b346106ac5760403660031901126106ac576135ca61501e565b6004355f52600660205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b346106ac5760803660031901126106ac5760043560243560048110156106ac57604435906001600160a01b0382168083036106ac576064356001600160401b0381116106ac5761364e90369060040161524a565b613659929192615979565b61366286615997565b865f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576136939087615a1d565b1561061d57855f52600460205263ffffffff600260405f20015460581c16151580613943575b61067c576136c5615ad9565b6136ce86615997565b92865f526004602052600260405f20019560ff87541660078110156106685760050361065957875f52600760205260405f2060018060a01b0386165f526020526010600361372e60ff60405f2054168b5f52600560205260405f20615060565b500154166119af5760018614613935576137488589615a9d565b15613926578515158061391d575b6138e9575b5061378e6104c2916040519283916020830195613778878b615277565b87604085015260608085015260808401916153f4565b519020855f52600d60205260405f2060018060a01b0384165f5260205260405f205403610dbb575f858152600d602090815260408083206001600160a01b0386168085529083528184206001908101805460ff199081169092179055898552600e84528285208286528452828520805490911660ff8916179055888452600f8352818420908452909152902080546001600160a01b031916821790557fefeac4ab688c036b72571c6adaf81feb0d4e0a7099c1cfd8d09e54370198c53c936060936138849161386190610ba2868a615bf9565b60038114613890575b6040516001600160a01b0390941684526020840190615277565b6040820152a260015f55005b865f52600760205260405f2060018060a01b0385165f5260205260036138c860ff60405f205416895f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff919091161761010017905561386a565b875f52600660205260405f20845f5260205260ff60405f2054161561062c576139129088615a1d565b1561061d578761375b565b50831515613756565b63205e472d60e21b5f5260045ffd5b6282b42960e81b5f5260045ffd5b50855f52600460205263ffffffff600260405f20015460581c1642116136b9565b346106ac5760403660031901126106ac5761397d61501e565b6004355f52600c60205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b346106ac575f3660031901126106ac57602060405160788152f35b346106ac5760403660031901126106ac5760e06003613a1c6004356139e961501e565b815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b50015460806040519160028116151583526001811615156020840152600481161515604084015260088116151560608401526010811615158284015260208116151560a084015216151560c0820152f35b346106ac575f3660031901126106ac57602060ff600154166040519015158152f35b346106ac5760403660031901126106ac57613aa861501e565b6004355f52600860205260405f209060018060a01b03165f526020526040805f2060ff6002825492015416825191825215156020820152f35b346106ac5760203660031901126106ac57600435613afd615979565b613b0681615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57613b379082615a1d565b1561061d57805f52600460205263ffffffff600260405f20015460581c16151580613bc1575b61067c57613b69615ad9565b613b7281615997565b815f526004602052600260405f20019060ff82541660078110156106685760020361065957613ba18184615a62565b6119af575f516020616dc25f395f51905f52602082611939869485615ba2565b50805f52600460205263ffffffff600260405f20015460581c164211613b5d565b346106ac5760203660031901126106ac576001600160a01b03613c03615034565b165f526018602052602060018060a01b0360405f205416604051908152f35b346106ac575f3660031901126106ac57335f52601760205260405f20600181019060ff825416613c4e57005b80546001600160a01b031680337f744157ccffbd293a2e8644928cd7d23d650f869b88f72d7bfea8041b76ca6bec5f80a35f90815260186020908152604080832080546001600160a01b031916905592546001600160a01b031682526019905220805460ff199081169091558154169055005b346106ac575f3660031901126106ac57613cd961601e565b5f80808047335af1613ce96153a8565b5015613cf157005b60405162461bcd60e51b81526020600482015260126024820152714661696c656420746f20776974686472617760701b6044820152606490fd5b346106ac5760203660031901126106ac576004355f52600560205260405f20805490613d568261532a565b91613d646040519384615103565b8083526020830180925f5260205f205f915b838310613e2257848660405191829160208301906020845251809152604083019060408160051b85010192915f905b828210613db457505050500390f35b919360019193955060208091603f19898203018552875190848060a01b038251168152606063ffffffff81613e0b613df98787015160808988015260808701906151c6565b604087015186820360408801526151c6565b940151169101529601920192018594939192613da5565b60046020600192604051613e35816150b1565b848060a01b038654168152613e4b858701615126565b83820152613e5b60028701615126565b604082015263ffffffff6003870154166060820152815201920192019190613d76565b346106ac57613e8c3661504a565b613e94615979565b613e9d82615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57613ece9083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c1615158061405b575b61067c57613f00615ad9565b613f0982615997565b90825f526004602052600260405f20015460ff811660078110156106685760010361065957613f4b90845f52600560205260ff60405f209160301c1690615060565b50546001600160a01b039081169083160361404c57825f52600760205260405f2060018060a01b0383165f5260205260406003613f9860ff835f205416865f526005602052835f20615060565b500154166117ca575f8381526008602090815260408083206001600160a01b038616808552908352818420858155600201805460ff191690558684526007835281842090845282528083205486845260059092529091207ffbabe9c4a6257c269f37e649a08003e579b119fcff47ac57e59d1502fccea41c93916003916140229160ff1690615060565b500163ffffffff604081835416171663ffffffff198254161790556117c16040519283928361536a565b631cc191eb60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211613ef4565b346106ac5761408a3661504a565b614092615979565b61409b82615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576140cc9083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c1615158061420a575b61067c576140fe615ad9565b61410782615997565b90825f52600460205260ff600260405f2001541660078110156106685760050361065957825f52601160205260405f2060018060a01b0383165f5260205260405f20541561064a57825f52601360205260405f2060018060a01b0383165f5260205260405f20546141fb578161419e7ff5adb2642a216ea3114d73daac494b2341695b10db2b0e6be988acb22fbc15649385615af4565b6141a88185615b4b565b835f52601360205260405f2060018060a01b0382165f526020528160405f2055835f52601460205260405f2060ff6141e2818354166152d0565b1660ff198254161790556117c16040519283928361536a565b6317ac735560e11b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c1642116140f2565b346106ac575f3660031901126106ac5761424361601e565b60015460ff8116156142a75760ff19166001557f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa6020604051338152a1337f306ca22c455fe433ebbf0542bbf947ea6a725495f9e1043db2a47e3c579403855f80a2005b638dfc202b60e01b5f5260045ffd5b346106ac5760203660031901126106ac576001600160a01b036142d7615034565b165f526019602052602060ff60405f2054166040519015158152f35b346106ac575f3660031901126106ac5760206040516138408152f35b346106ac5760203660031901126106ac5760043561432b615979565b61433481615997565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576143659082615a1d565b1561061d57614372615ad9565b805f526004602052600260405f200160ff81541660078110156106685760030361065957805460ff60ff60801b01191660041781556143b99063ffffffff610ff442615341565b805f52600560205260405f205f5b815460ff8216101561448e57806143e161445a9284615060565b50546001600160a01b031660036143f88386615060565b5001805463fffffffb811663ffffffff199091161790555f858152600b602090815260408083206001600160a01b0385168452909152902080546001600160a01b03191690556002600361444c8487615060565b5001541661445f57506152d0565b6143c7565b5f858152600c602090815260408083206001600160a01b03909416835292905220805460ff19169055846127e5565b825f516020616d225f395f51905f525f80a260015f55005b346106ac576144b43661504a565b6144bc615979565b6144c582615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c576144f69083615a1d565b1561061d57614503615ad9565b61450c82615997565b90825f52600460205260ff600260405f2001541660078110156106685760020361065957825f52601160205260405f2060018060a01b0383165f5260205260405f20546119be575f516020616ce25f395f51905f5291835f52601160205260405f2060018060a01b0382165f526020528160405f20556117c16040519283928361536a565b346106ac5760403660031901126106ac576145aa61501e565b336001600160a01b038216036145c6576114b9906004356161a5565b63334bd91960e11b5f5260045ffd5b346106ac576145e33661504a565b905f52601260205260405f2080548210156106ac576146289161460591615231565b50600161461182615126565b9101546040519283926060845260608401906151c6565b9063ffffffff8116602084015260018060a01b039060201c1660408301520390f35b346106ac576101c03660031901126106ac57600435366064116106ac573660e4116106ac5736610124116106ac57366101c4116106ac57614689615979565b614691615ad9565b805f52600460205260ff600260405f200154166007811015610668578015908115614972575b50610659576003546001600160a01b0316801561493a57604080516334baeab960e01b81529190602460048401378160645f604483015b60028210614920575050506101a481602093604060e460c484013760a06101246101048401375afa908115614915575f916148da575b50156148a257610184356101a43582610164350361486b578015614834578101809111612ff65715614802576101243560010361478e576105cb906040519061476e604083615103565b600e82526d546f776e2077696e7320285a4b2960901b6020830152616140565b610144356001036147cd5761085690604051906147ac604083615103565b600f82526e4d616669612077696e7320285a4b2960881b6020830152616140565b60405162461bcd60e51b815260206004820152600d60248201526c2d259d103737903bb4b73732b960991b6044820152606490fd5b60405162461bcd60e51b815260206004820152600a602482015269456d7074792067616d6560b01b6044820152606490fd5b60405162461bcd60e51b815260206004820152600f60248201526e4e6f20746f776e20706c617965727360881b6044820152606490fd5b60405162461bcd60e51b815260206004820152600f60248201526e0a4dededa92c840dad2e6dac2e8c6d608b1b6044820152606490fd5b60405162461bcd60e51b815260206004820152601060248201526f24b73b30b634b2102d2590383937b7b360811b6044820152606490fd5b90506020813d60201161490d575b816148f560209383615103565b810103126106ac575180151581036106ac5782614724565b3d91506148e8565b6040513d5f823e3d90fd5b8293506040818160019495819437019301910184926146ee565b60405162461bcd60e51b815260206004820152601060248201526f15995c9a599a595c881b9bdd081cd95d60821b6044820152606490fd5b6006915014826146b7565b346106ac5760403660031901126106ac576114b960043561499c61501e565b906149a96114af82615318565b6160b4565b346106ac5760203660031901126106ac576004355f52600960205260405f208054906149d98261532a565b916149e76040519384615103565b8083526020830180925f5260205f205f915b838310614a6657848660405191829160208301906020845251809152604083019060408160051b85010192915f905b828210614a3757505050500390f35b91936001919395506020614a568192603f198a820301865288516151c6565b9601920192018594939192614a28565b600160208192614a7585615126565b8152019201920191906149f9565b346106ac5760203660031901126106ac576020614aa1600435615318565b604051908152f35b346106ac5760203660031901126106ac576004355f52600460205260405f2080546002614ad860018401615126565b920154604080516001600160401b038416815292811c6001600160a01b031660208401526102009083018190529192839260ff91614b18918501906151c6565b91614b2860608501838316615224565b818160081c166080850152818160101c1660a0850152818160181c1660c085015261ffff8160201c1660e0850152818160301c1661010085015263ffffffff8160381c1661012085015263ffffffff8160581c16610140850152818160781c16610160850152818160801c16610180850152818160881c166101a0850152818160901c166101c085015260981c166101e08301520390f35b346106ac5760203660031901126106ac576004355f526004602052602063ffffffff600260405f20015460581c16604051908152f35b346106ac57614c043661504a565b905f52600560205260405f209081548110156106ac57614c2391615060565b5080546001600160a01b0316614c3b60018301615126565b91614c8163ffffffff6003614c5260028501615126565b9301541691614c7360405195869586526080602087015260808601906151c6565b9084820360408601526151c6565b9060608301520390f35b346106ac575f3660031901126106ac576020601a54604051908152f35b346106ac5760403660031901126106ac57600435614cc461501e565b614ccc615979565b614cd582615997565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561062c57614d069083615a1d565b1561061d57815f52600460205263ffffffff600260405f20015460581c16151580614faa575b61067c57614d38615ad9565b614d4182615997565b90825f526004602052600260405f20019160ff83541660078110156106685760040361065957835f52600660205260405f2060018060a01b0383165f5260205260ff60405f2054161561062c57614d988285615a1d565b1561061d5783917fcfff1651bcea794952a516ce970ab17518a85210bd939aaeaac670a8d3e65ec791835f52600760205260405f2060018060a01b0382165f5260205260046003614dfb60ff60405f205416875f52600560205260405f20615060565b5001545f868152600b602090815260408083206001600160a01b0387811685529252909120549290911615911680151580614f80575b614f44575b505f858152600b602090815260408083206001600160a01b03868116855290835281842080546001600160a01b0319169188169182179055888452600c83528184209084529091529020805460ff90614e909082166152d0565b1660ff19825416179055614ed3575b614eae604051928392836152fe565b0390a25460ff808260181c169160801c1614614eca5760015f55005b610c0290615c50565b835f52600760205260405f2060018060a01b0382165f526020526003614f0b60ff60405f205416865f52600560205260405f20615060565b500163ffffffff600481835416171663ffffffff19825416179055614f3f614f3960ff875460801c166152d0565b866152e1565b614e9f565b855f52600c60205260405f209060018060a01b03165f5260205260405f2060ff614f70818354166152c1565b1660ff1982541617905587614e36565b50855f52600c60205260405f2060018060a01b0382165f5260205260ff60405f2054161515614e31565b50815f52600460205263ffffffff600260405f20015460581c164211614d2c565b346106ac5760203660031901126106ac576004359063ffffffff60e01b82168092036106ac57602091637965db0b60e01b811490811561500d575b5015158152f35b6301ffc9a760e01b14905083615006565b602435906001600160a01b03821682036106ac57565b600435906001600160a01b03821682036106ac57565b60409060031901126106ac576004359060243590565b8054821015611c81575f5260205f209060021b01905f90565b90600182811c921680156150a7575b602083101461509357565b634e487b7160e01b5f52602260045260245ffd5b91607f1691615088565b608081019081106001600160401b03821117610cec57604052565b61020081019081106001600160401b03821117610cec57604052565b606081019081106001600160401b03821117610cec57604052565b601f909101601f19168101906001600160401b03821190821017610cec57604052565b9060405191825f82549261513984615079565b80845293600181169081156151a45750600114615160575b5061515e92500383615103565b565b90505f9291925260205f20905f915b81831061518857505090602061515e928201015f615151565b602091935080600191548385890101520191019091849261516f565b90506020925061515e94915060ff191682840152151560051b8201015f615151565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b60609060031901126106ac57600435906024356001600160a01b03811681036106ac57906044356001600160a01b03811681036106ac5790565b9060078210156106685752565b8054821015611c81575f5260205f209060011b01905f90565b9181601f840112156106ac578235916001600160401b0383116106ac57602083818601950101116106ac57565b9060048210156106685752565b9181601f840112156106ac578235916001600160401b0383116106ac576020808501948460051b0101116106ac57565b9060058210156106685752565b60ff168015612ff6575f190190565b60ff1660ff8114612ff65760010190565b805460ff60801b191660809290921b60ff60801b16919091179055565b6001600160a01b0391821681529116602082015260400190565b5f526002602052600160405f20015490565b6001600160401b038111610cec5760051b60200190565b9060b48201809211612ff657565b6001600160401b038111610cec57601f01601f191660200190565b6001600160a01b039091168152602081019190915260400190565b805463ffffffff60581b191660589290921b63ffffffff60581b16919091179055565b3d156153d2573d906153b98261534f565b916153c76040519384615103565b82523d5f602084013e565b606090565b805460ff60781b191660789290921b60ff60781b16919091179055565b908060209392818452848401375f828201840152601f01601f1916010190565b805460ff60901b191660909290921b60ff60901b16919091179055565b92919261543d8261534f565b9161544b6040519384615103565b8294818452818301116106ac578281602093845f960137010152565b818110615472575050565b5f8155600101615467565b9190601f811161548c57505050565b61515e925f5260205f20906020601f840160051c830193106154b6575b601f0160051c0190615467565b90915081906154a9565b8160011b915f199060031b1c19161790565b8054600160401b811015610cec576154ef91600182018155615060565b9190916120bc57805182546001600160a01b0319166001600160a01b03919091161782556020810151805160018401916001600160401b038211610cec576155418261553b8554615079565b8561547d565b602090601f831160011461564d5761556292915f91836155d45750506154c0565b90555b6040810151805160028401916001600160401b038211610cec5761558d8261553b8554615079565b602090601f83116001146155df57936003936155bc8463ffffffff979560609589975f926155d45750506154c0565b90555b0151169201911663ffffffff19825416179055565b015190505f80610c5e565b90601f19831691845f52815f20925f5b81811061563557508460609463ffffffff9894600398948a986001951061561e575b505050811b0190556155bf565b01515f19838a1b60f8161c191690555f8080615611565b929360206001819287860151815501950193016155ef565b90601f19831691845f52815f20925f5b8181106156985750908460019594939210615680575b505050811b019055615565565b01515f1960f88460031b161c191690555f8080615673565b9293602060018192878601518155019501930161565d565b9062ff000082549160101b169062ff00001916179055565b9063ff00000082549160181b169063ff0000001916179055565b156156e957565b60405162461bcd60e51b81526020600482015260166024820152752330b4b632b2103a3790333ab7321039b2b9b9b4b7b760511b6044820152606490fd5b929160409261574e9296959660018060a01b031685526060602086015260608501916153f4565b6001600160a01b03909416910152565b805461ffff60201b191660209290921b61ffff60201b16919091179055565b805460ff60301b191660309290921b60ff60301b16919091179055565b805463ffffffff60381b191660389290921b63ffffffff60381b16919091179055565b805460ff60881b191660889290921b60ff60881b16919091179055565b805460ff60981b191660989290921b60ff60981b16919091179055565b8051821015611c815760209160051b010190565b6001600160a01b03909116815260408101929161515e91602001906152b4565b903590601e19813603018212156106ac57018035906001600160401b0382116106ac576020019181360383136106ac57565b6040519061586c604083615103565b6019825278546f6f2066657720706c61796572732072656d61696e696e6760381b6020830152565b90602083828152019060208160051b85010193835f915b8383106158bb5750505050505090565b909192939495601f198282030186528635601e19843603018112156106ac578301602081019190356001600160401b0381116106ac5780360383136106ac5761590a60209283926001956153f4565b9801960194930191906158ab565b60ff60019116019060ff8211612ff657565b60405190615939604083615103565b6009825268546f776e2077696e7360b81b6020830152565b60405190615960604083615103565b600a8252694d616669612077696e7360b01b6020830152565b60025f54146159885760025f55565b633ee5aeb560e01b5f5260045ffd5b335f908152601860205260409020546001600160a01b031690816159bb5750503390565b815f52601760205260405f2060ff60018201541615615a0e575463ffffffff8160a01c1642116159ff5760c01c036159f05790565b637ce3c8fd60e11b5f5260045ffd5b630fe82d2560e11b5f5260045ffd5b635f8874dd60e11b5f5260045ffd5b615a59600391600293815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b50015416151590565b615a59600391600193815f52600760205260405f2090858060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b615a59600391600893815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b60ff60015416615ae557565b63d93c066560e01b5f5260045ffd5b615b2e90600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176080179055565b615b8590600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176008179055565b615bdc90600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176001179055565b615c3390600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20615060565b5001805463ffffffff19811663ffffffff91909116176010179055565b90815f5260046020528160405f205f905f90835f52600560205260405f205f908054915b8260ff821610615f9657505050607f600260ff92015460191c16911690811180615f84575b15615f615781604091615cba5f516020616d625f395f51905f529486616475565b845f516020616d425f395f51905f52608085519460018060a01b03169485815286602082015260098782015268159bdd1959081bdd5d60ba1b6060820152a282519182526020820152a25b815f52600560205260405f20915f5b835460ff82161015615da85780615d2e615da39286615060565b50545f848152600b602090815260408083206001600160a01b0390941680845293825280832080546001600160a01b0319169055868352600c825280832093835292905220805460ff191690556003615d878287615060565b5001805463fffffffb811663ffffffff199091161790556152d0565b615d14565b505f818152600460205260409020600201805460ff60801b19169055909150615dd081616bf6565b15615dd85750565b5f818152600460205260409020600201805460ff61ffff60881b011916600517815542603c810191908210612ff65763ffffffff615e17921690615385565b805f52600560205260405f205f5b815460ff82161015615efb5780615e3f615ef69284615060565b50546001600160a01b03166003615e568386615060565b5001805463ffffffe7811663ffffffff199091161790555f858152600d602090815260408083206001600160a01b03949094168084529382528083208381556001908101849055888452600e83528184208585528352818420805460ff19169055888452600f8352818420858552835281842080546001600160a01b031916905588845260138352818420948452939091528120818155909101556152d0565b615e25565b50505f818152601460209081526040808320805460ff1990811690915560158352818420805490911690556016909152812080546001600160a01b03191690557f34b0c4c95aa7776d35dbd8b24afd53388828c61c26fd5a6b11a21809662440879080a2565b50505f516020616d625f395f51905f52604080515f81525f6020820152a2615d05565b506001600160a01b0382161515615c99565b9091929394955060026003615fab8385615060565b50015416615fc9575b615fbd906152d0565b90879594939291615c74565b615fd38183615060565b50545f898152600c602090815260408083206001600160a01b039094168084529390915290205460ff9081169087168111616010575b5050615fb4565b9096509450615fbd5f616009565b335f9081527fe5ebfa64fca8d502a8e50c1edffd2c31ef4dad5b396e65d9f397fb028f74abc5602052604090205460ff161561605657565b63e2517d3f60e01b5f52336004525f516020616da25f395f51905f5260245260445ffd5b5f81815260026020908152604080832033845290915290205460ff161561609e5750565b63e2517d3f60e01b5f523360045260245260445ffd5b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff1661613a575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19166001179055339291907f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d9080a4600190565b50505f90565b5f81815260046020908152604091829020600201805460ff63ffffffff60581b0119166006179055905181815291927fd778487128ba4386ebcfb2703af01f8a2a2b8663f880622d26a77a29397e68f3929182916161a0918301906151c6565b0390a2565b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff161561613a575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19169055339291907ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9080a4600190565b805f526004602052600260405f2001600360ff1982541617815561ffff815460201c169061ffff8214612ff65761ffff60209161628a60017fa9b4e96158ed085745975f198fa026959997245ae7e7aed9cd0252ce02b2107195018261575e565b61629a63ffffffff42168261579a565b6162ab63ffffffff610b9b42615341565b54821c16604051908152a2565b6001600160a01b0390911691908215611c9557825f52601960205260ff60405f205416616466575f838152601860205260409020546001600160a01b0316616466576001600160a01b03165f8181526017602052604090206001015490919060ff16616421575b6138404201804211612ff6577f290e52799b1ac63207e28c21f7f1f387cf8ea9257dde8e363a02e157d8e4c6589163ffffffff604092166163e58351616364816150b1565b8781526020808201848152600180881b5f19018716888501908152606085018281525f8c81526017909552938990209451925190516001600160c01b031960c09190911b166001600160a01b0390931663ffffffff60a01b60a09290921b919091161791909117835590519101805460ff191691151560ff16919091179055565b5f8681526018602090815284822080546001600160a01b031916881790556019815290849020805460ff191660011790558351928352820152a3565b5f828152601760209081526040808320546001600160a01b031683526018825280832080546001600160a01b031916905560199091529020805460ff1916905561631f565b631fef749360e21b5f5260045ffd5b906164808183615a1d565b156164fa57815f52600760205260405f209060018060a01b03165f5260205260036164bd60ff60405f205416835f52600560205260405f20615060565b500163ffffffff63fffffffd8254161663ffffffff198254161790555f52600460205261515e600260405f200161322460ff825460181c166152c1565b5050565b90815f5260166020528160018060a01b0360405f2054165f825f52600560205260405f205f908054905b8160ff8416106166d5575b505050827fb874a4c95be602274c8e6944d4d375ca4189eda377b69ee751f3b92dd4dcf2d8604051806165678587836152fe565b0390a281151590816166c1575b50616672575b505f52600560205260405f20915f5b835460ff8216101561663857806165a36166339286615060565b50545f848152600d602090815260408083206001600160a01b03909416808452938252808320838155600101839055868352600e82528083208484528252808320805460ff19169055868352600f82528083209383529290522080546001600160a01b031916905560036166178287615060565b5001805463ffffffe7811663ffffffff199091161790556152d0565b616589565b505f818152600460205260409020600201805461ffff60881b1916905590915061666181616bf6565b156166695750565b61515e90616229565b60808161668d5f516020616d425f395f51905f529385616475565b60405190815260406020820152600f60408201526e12da5b1b195908185d081b9a59da1d608a1b6060820152a2815f61657a565b6001600160a01b031682141590505f616574565b909194506166e38582615060565b50545f888152600e602090815260408083206001600160a01b039094168084529390915290205460ff1695906004871015610668576002899714616732575061672b906152d0565b9190616528565b5f878152600f602090815260408083206001600160a01b03948516845290915281205490911694509250829150819050616533565b5f52600560205260405f205f8154905b8160ff82161061678a575060ff91501690565b600260036167988386615060565b500154166167ae576167a9906152d0565b616777565b91505090565b5f52600560205260405f20908154905b8160ff8216106167d7575060ff91501690565b600260036167e58386615060565b500154166167ae576167f6906152d0565b6167c4565b5f8181526004602052604090206002908101805460ff64ff000000ff60781b01191690911781556168349063ffffffff610ff442615341565b5f52600560205260405f20905f5b825460ff8216101561689a57806002600361686061686d9487615060565b50015416616872576152d0565b616842565b600361687e8286615060565b5001805463ffffff9e811663ffffffff199091161790556152d0565b509050565b5f818152600560205260408120805492915b8360ff8216106168c45750505050600190565b600260036168d28385615060565b500154161515806168f8575b6168f0576168eb906152d0565b6168b1565b505050505f90565b50825f52601060205260405f2061690f8284615060565b50546001600160a01b03165f908152602091909152604090205460ff16600581101561066857156168de565b905f5f92805f52600560205260405f205f918154925b8360ff821610616992575050505060ff1680159283159182616984575b508361697957509190565b60ff91935016151590565b60ff8216111591505f61696e565b600260036169a08386615060565b500154166169b7575b6169b2906152d0565b616951565b93815f52601060205260405f206169ce8685615060565b50546001600160a01b03165f908152602091909152604090205460ff1660058110156106685760018103616a125750616a096169b2916152d0565b945b90506169a9565b909490616a23575b6169b290616a0b565b95616a306169b2916152d0565b969050616a1a565b805f52601460205260ff60405f20541615616bf3575f81815260056020526040812080546001918390815b8360ff821610616b04575b505050505f516020616de25f395f51905f5291818060409390616af2575b15616aeb57815b5f868152601660205284902080546001600160a01b0319166001600160a01b03851617905581616ad8575b5082516001600160a01b03909216825215156020820152a2565b6001600160a01b0316151590505f616abe565b5f91616a93565b506001600160a01b0382161515616a8c565b616b0e8183615060565b50545f8881526013602090815260408083206001600160a01b03949094168084529390915290206001015460a01c60ff1680616bd9575b616b59575b50616b54906152d0565b616a63565b5f8881526013602090815260408083206001600160a01b0394851684529091529020600101549296919392169180616b9b57505093616b546001925b90616b4a565b9095909290916001600160a01b03871603616bb957616b5490616b95565b505050505060405f516020616de25f395f51905f52915f9181935f616a6e565b5060026003616be88486615060565b500154161515616b45565b50565b805f52600460205260ff600260405f20015460181c166001811115616c5e5750616c1f8161689f565b616c2857505f90565b616c318161693b565b9015616c495750616c449061083f615951565b600190565b616c5257505f90565b616c449061083f61592a565b616c449190616c8c57604051616c75604082615103565b60048152634472617760e01b602082015290616140565b604051616c9a604082615103565b60148152734c61737420706c61796572207374616e64696e6760601b60208201529061614056fea4a46989ff60ad96ec74df0f289e1e16b51c97fecb224f2e8e927103d5b54eaef33c1bd762b898b33040e70f49cf90ff496cf7366f6fafa9d961b0de89b7244b3b7d84e02e9f6642b42e0ca3e77297f9c7c807832a60c0fc1926ade76abc7badcf33babc496bb6dc2942b39cb7b75766bbbadf7da50d176ff8c513e991140239b1ed64d561b0179e61c72bf46d0809a99dac99baeb98fc9f5d13be1f6c2e3f826b571d1c11516ea63adff1048766bdfa510e9c5bf4e32ca29d4ba11e16edf2f18ef7613b6eacaa71c74d950e2c093c23a0d3ecb066d1387d80e95159d07ed08ba49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177582b52ddf0195aa8ac16480985f5042052aa742563721520fa34764d253824d43020f20553b51a906b0cb24d2431eb46bd2dc31b5c75d4ba8165ff1bb284ad2a1a2646970667358221220e22b3b20786586e4e9a4a292d4eb671bbaf0ad03af432deab3f74da465ba281e64736f6c634300081c0033",
  "linkReferences": {},
  "deployedLinkReferences": {},
  "immutableReferences": {},
  "inputSourceName": "project/contracts/MafiaPortal.sol",
  "buildInfoId": "solc-0_8_28-23070a7fb2e783ec7c40f3e09db31c1f0d655047"

} as const;
