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
          "internalType": "uint256[4]",
          "name": "input",
          "type": "uint256[4]"
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
  "bytecode": "0x6080604052346100355760015f556001601a5561001b33610039565b50610025336100af565b50604051616c7a90816101438239f35b5f80fd5b6001600160a01b0381165f9081525f516020616ddd5f395f51905f52602052604090205460ff166100aa576001600160a01b03165f8181525f516020616ddd5f395f51905f5260205260408120805460ff191660011790553391905f516020616dbd5f395f51905f528180a4600190565b505f90565b6001600160a01b0381165f9081525f516020616dfd5f395f51905f52602052604090205460ff166100aa576001600160a01b03165f8181525f516020616dfd5f395f51905f5260205260408120805460ff191660011790553391907fa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775905f516020616dbd5f395f51905f529080a460019056fe6080806040526004361015610012575f80fd5b5f3560e01c90816301ffc9a714614ec65750806302d947ef14614ba357806307a52cab14614b8657806309ed3e2214614af157806312c57f55146113e757806314a09d6014614abb5780631bae0ac8146149a457806323f906d5146146af578063248a9ca3146146895780632a51fb3a146145b45780632f2ff15d1461458357806330a05e73146129da57806335b972991461450e57806336568abe146144ca57806337048f21146143df5780633d2f5bda146142485780633deaa3411461422c5780633ec09d2c146141ef5780633f4ba83a146141645780633fb5d9f514613fbf57806343cd690314613dc1578063460e204914613c6e578063476343ee14613c2b57806348e69d1f14613b8c5780634f324d1414613b4c5780635099fae214613a4b578063567e8dd5146139f95780635c975abb146139d75780635d99dc3e146139305780635e82ff651461391557806361ea2027146138ce5780636594bb0c1461353b578063660e907c146134f2578063669ead17146134a65780636920e3ee146134795780636d8a74cb146131f95780636e2083f4146131c75780637120465b14612fb857806375b238fc14612f915780637fa9c28914612f75578063800122d614612a0757806382fab9d8146129da57806384411c0a146129935780638456cb59146129165780638a8dd7f4146128d25780638d29f52f1461287357806391d148541461282a57806394225e9d146124f557806396913528146124b2578063a05bcf021461247b578063a217fddf14612461578063aa55acbf146123fc578063af38479114612120578063af7efa7c14612105578063b6bf359a14611e51578063b7b8d60414611de9578063bb9ae87514611a24578063bcb7215914611830578063c96f09791461161f578063d0655394146114f2578063d23254b4146114a8578063d547741f14611470578063d6df096d14611448578063d94a51cb146113e7578063dae2928a14611021578063e5ed1d5914610f0f578063e851122d14610ec1578063ea99c3fe14610dd8578063eb0241011461091e578063eb0fa6f8146108d4578063f14caed714610871578063f30818ff14610774578063f3db51331461069d5763ff99233a1461034a575f80fd5b3461069957606036600319011261069957600435610366614f19565b6044356001600160401b03811161069957610385903690600401615145565b9161038e615875565b61039784615893565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576103c89085615919565b1561060a57835f52600460205263ffffffff600260405f20015460581c16151580610678575b610669576103fa6159d5565b61040384615893565b92845f52600460205260ff600260405f2001541660078110156106555760050361064657845f52601160205260405f2060018060a01b0385165f5260205260405f20541561063757845f52601360205260405f2060018060a01b0385165f5260205260ff600160405f20015460a01c166106285761048184866159f0565b6001600160a01b03821692836105dc575b6104c56104b791604051928391602083019588875260408085015260608401916152c1565b03601f198101835282614ffe565b519020845f52601360205260405f2060018060a01b0385165f5260205260405f2054036105cd575f8481526013602090815260408083206001600160a01b03871684528252808320600101805460ff60a01b199096166001600160a81b031990961695909517600160a01b179094558582526015905291909120805484937f307ed77ec1f8fe53e10faa7fa486ba5e5b66eab3a9d19902c20b0da3c3b0b26a9392909160ff906105769082166151cb565b1660ff1982541617905561058f604051928392836151f9565b0390a2805f52601560205260ff60405f205416815f52601460205260ff60405f205416146105be575b60015f55005b6105c79061687b565b5f6105b8565b6336c5b53760e11b5f5260045ffd5b855f52600660205260405f20845f5260205260ff60405f20541615610619576106058387615919565b610492575b630575d90f60e11b5f5260045ffd5b63721c7c6760e11b5f5260045ffd5b633a456ae760e11b5f5260045ffd5b631ea3b68b60e21b5f5260045ffd5b6338961af360e21b5f5260045ffd5b634e487b7160e01b5f52602160045260245ffd5b6301a6f70d60e01b5f5260045ffd5b50835f52600460205263ffffffff600260405f20015460581c1642116103ee565b5f80fd5b34610699576020366003190112610699576004355f5f5b825f52600560205260405f205460ff8216101561076657825f5260056020526106e08160405f20614f5b565b50545f8481526010602090815260408083206001600160a01b039094168352929052205460ff1660058110156106555760011480610741575b61072c575b610727906151cb565b6106b4565b90610739610727916151cb565b91905061071e565b50825f5260056020526002600361075b8360405f20614f5b565b500154161515610719565b60208260ff60405191168152f35b3461069957602036600319011261069957600435610790615875565b61079981615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576107ca9082615919565b1561060a576107d76159d5565b805f52600460205260ff600260405f200154166007811015610655578015908115610866575b506106465761080b816166e2565b15610857576108198161677e565b901561083257506105b89061082c61584d565b90615e61565b15610848576108439061082c615826565b6105b8565b63308ce0f960e11b5f5260045ffd5b63837cd79f60e01b5f5260045ffd5b6006915014826107fd565b346106995760403660031901126106995761088a614f19565b6004355f52600d60205260405f209060018060a01b03165f52602052606060405f2063ffffffff6001825492015460405192835260ff81161515602084015260081c166040820152f35b34610699576040366003190112610699576108ed614f19565b6004355f908152600f602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b34610699576060366003190112610699576004356024356001600160401b0381116106995761095190369060040161517f565b6044356001600160401b03811161069957610970903690600401615145565b92610979615875565b61098285615893565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576109b39086615919565b1561060a57845f52600460205263ffffffff600260405f20015460581c16151580610db7575b610669576109e56159d5565b6109ee85615893565b91855f526004602052600260405f20019485549160ff831660078110156106555760010361064657610a4c6104b791604051928391602083019560408752610a3a606085018c8b615790565b848103601f19016040860152916152c1565b519020865f52600860205260405f2060018060a01b0385165f5260205260405f205403610da85760328411610d9957855f52600960205260405f2054159081610d89575b50610d6457845f52600960205260405f2054151580610d73575b610d64575f858152600960205260409020600160401b8411610cd9578054848255808510610ced575b505f908152602081208694939291825b858210610bf55750505090610bc67f1522116f5d4e7ac5527e161307d73b93c621a9a7627553f584afb6b6f62a74e79392855f52600860205260405f2060018060a01b0384165f52602052600260405f2001600160ff19825416179055610ba5610b5c610b5660ff8a5460301c16615814565b886165f7565b97610b678982615679565b610b7763ffffffff421682615696565b610b8f63ffffffff610b8842615272565b1682615281565b610b9f60ff825460901c166151cb565b906152e1565b60405193849360018060a01b03168452604060208501526040840191615790565b0390a2815f52600560205260ff60405f205491161015610be65760015f55005b610bef9061663e565b806105b8565b90919293949550610c068185615727565b906001600160401b038211610cd957610c2982610c238754614f74565b8761534a565b5f90601f8311600114610c6f5792610c52836001959460209487965f92610c64575b505061538d565b86555b01930191018795949392610ae3565b013590508e80610c4b565b601f19831691865f5260205f20925f5b818110610cc15750936020936001969387969383889510610ca8575b505050811b018655610c55565b01355f19600384901b60f8161c191690558d8080610c9b565b91936020600181928787013581550195019201610c7f565b634e487b7160e01b5f52604160045260245ffd5b815f528460205f2091820191015b818110610d085750610ad3565b80610d1560019254614f74565b80610d22575b5001610cfb565b601f81118314610d3757505f81555b89610d1b565b610d5390825f5283601f60205f20920160051c82019101615334565b805f525f6020812081835555610d31565b63d1d2a30960e01b5f5260045ffd5b50845f52600960205260405f2054831415610aaa565b60ff915060101c16831086610a90565b63376ab11160e01b5f5260045ffd5b639ea6d12760e01b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c1642116109d9565b3461069957602036600319011261069957600435610df4615875565b610dfd81615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957610e2e9082615919565b1561060a57610e3b6159d5565b805f526004602052600260405f20015460ff811660078110156106555760050361064657815f52601460205260ff60405f2054168015159081610ea8575b50610e995760ff808260881c169160901c1610610da8576105b8906160fb565b6303488f9960e61b5f5260045ffd5b9050825f52601560205260ff60405f2054161083610e79565b3461069957604036600319011261069957610eda614f19565b6004355f52601060205260405f209060018060a01b03165f52602052602060ff60405f205416610f0d60405180926151af565bf35b3461069957602036600319011261069957600435610f2b615875565b610f3481615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957610f659082615919565b1561060a57610f726159d5565b805f526004602052600260405f2001805460ff81166007811015610655576106465760ff60049160101c161061101257805460ff19166001178155610fe890610fc3610fbd846165aa565b82615679565b610fd363ffffffff421682615696565b63ffffffff610fe142615272565b1690615281565b7f50ad08f58a27f2851d7e3a1b3a6a46b290f2ce677e99642d30ff639721e777905f80a260015f55005b63f770074360e01b5f5260045ffd5b346106995760203660031901126106995760043561103d615875565b61104681615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576110779082615919565b1561060a576110846159d5565b805f526004602052600260405f2001805463ffffffff8160581c1680159081156113dc575b506113cd5760ff16827f77ff69c1f99cadd93a6da75080e20a3fed43f1d42375051a5d162adcafc5fbb760206040516110e2818661511f565ba260078110156106555760018103611236575050805f526004602052600260405f20018160ff825460301c16815f52600560205260405f205481106111c1575b505061113d61113760ff835460301c16615814565b836165f7565b6111478183615679565b61115763ffffffff421683615696565b61116f63ffffffff61116842615272565b1683615281565b825f52600560205260ff60405f20549116101561118f575b505060015f55005b54600260189190911c60ff16106111b0576111a99061663e565b8080611187565b6111bc9061082c615759565b6111a9565b60806111e65f516020616bc55f395f51905f5292845f52600560205260405f20614f5b565b50546001600160a01b03166111fb8185616521565b60405190815260406020820152601660408201527554696d656f757420647572696e672073687566666c6560501b6060820152a28183611122565b6002810361135d5750815f52600560205260405f205f5b815460ff8216101561133557806002600361126b6112789486614f5b565b5001541661127d576151cb565b61124d565b6020600361128b8386614f5b565b50015416156001600361129e8487614f5b565b5001541615811561132d575b50156151cb576112ce6112bd8285614f5b565b50546001600160a01b031686616521565b845f516020616bc55f395f51905f5260806112e98487614f5b565b5054604080516001600160a01b0390921682526020820181905260159082015274151a5b595bdd5d08191d5c9a5b99c81c995d99585b605a1b6060820152a26151cb565b9050866112aa565b505054600260189190911c60ff1610611351576108439061606c565b6108439061082c615759565b6004810361137057505061084390615a9e565b60058103611383575050610843906160fb565b600314611392575b50506105b8565b805460ff60ff60801b01191660041781556113b59063ffffffff610fe142615272565b5f516020616b655f395f51905f525f80a2808061138b565b63489e8c8960e01b5f5260045ffd5b9050421115846110a9565b34610699576113f5366150e5565b915f52600a60205260405f209060018060a01b03165f5260205260405f209060018060a01b03165f5260205261144461143060405f20615021565b6040519182916020835260208301906150c1565b0390f35b34610699575f366003190112610699576003546040516001600160a01b039091168152602090f35b34610699576040366003190112610699576114a660043561148f614f19565b906114a161149c8261522e565b615f22565b615fe8565b005b34610699576040366003190112610699576114c1614f19565b6004355f908152600b602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b34610699576020366003190112610699576004355f52601260205260405f2080549061151d82615240565b9161152b6040519384614ffe565b8083526020830180925f5260205f205f915b8383106115d557848660405191829160208301906020845251809152604083019060408160051b85010192915f905b82821061157b57505050500390f35b919360019193955060208091603f1989820301855287519060406115a883516060845260608401906150c1565b9263ffffffff85820151168584015281878060a01b0391015116910152960192019201859493919261156c565b600260206001926040516115e881614fe3565b6115f186615021565b81528486015463ffffffff811684830152858060a01b0390841c16604082015281520192019201919061153d565b346106995761162d36614f45565b611635615875565b61163e82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761166f9083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c1615158061180f575b610669576116a16159d5565b6116aa82615893565b90825f526004602052600260405f20019160ff835416600781101561065557600503610646576116da8185615999565b611800576117e87f3cf64897479c2ba314a5a0e8cf3a0e097d9367de65da54961e4dc414836499009360405161170f81614fe3565b84815260208101905f82526117656001604083019263ffffffff421684528a5f52600d60205260405f20828060a01b0389165f5260205260405f20905181550192511515839060ff801983541691151516179055565b5164ffffffff0082549160081b169064ffffffff001916179055855f52600760205260405f2060018060a01b0384165f5260205260036117b760ff60405f205416885f52600560205260405f20614f5b565b500163ffffffff600881835416171663ffffffff198254161790556117e260ff825460881c166151cb565b906156b9565b6117f760405192839283615257565b0390a260015f55005b6317fd8aab60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211611695565b346106995761183e36614f45565b611846615875565b61184f82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576118809083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580611a03575b610669576118b26159d5565b6118bb82615893565b90825f526004602052600260405f20019160ff83541660078110156106555760020361064657835f52601160205260405f2060018060a01b0382165f5260205260405f20546119f45761190e818561595e565b6119e55760205f516020616c055f395f51905f5291855f516020616b255f395f51905f526119628296835f526011865260405f2060018060a01b0386165f5286528060405f20556040519182918683615257565b0390a261196f8185615a47565b61198861198260ff875460781c166151cb565b866152a4565b6040516001600160a01b039091168152a25460ff808260181c169160781c16146119b25760015f55005b6119bb8161606c565b7f54ccd98022ba3fd547cb241a4f3dfc13e7f9bb54550b7babf4080021c6c2f1265f80a2806105b8565b63a89ac15160e01b5f5260045ffd5b630890382360e21b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c1642116118a6565b34610699576060366003190112610699576004356024356001600160401b03811161069957611a5790369060040161517f565b6044356001600160401b03811161069957611a7690369060040161517f565b9092611a80615875565b611a8985615893565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957611aba9086615919565b1561060a57845f52600460205263ffffffff600260405f20015460581c16151580611dc8575b61066957611aec6159d5565b611af585615893565b93855f526004602052600260405f200160ff81541660078110156106555760020361064657838503611db95760328511610d9957865f52600760205260405f2060018060a01b0387165f5260205260206003611b6260ff60405f2054168a5f526005845260405f20614f5b565b50015416611daa5793946001600160a01b0316935f5b8787821015611cda57506001600160a01b03600582901b85810135918216929183900361069957895f52600660205260405f20835f5260205260ff60405f2054161561061957878314611ccb5786821015611cb757611bd990850185615727565b9190928a5f52600a60205260405f20895f5260205260405f20905f5260205260405f2060018060401b038311610cd95782611c1f8c94611c198454614f74565b8461534a565b5f601f8211600114611c4d579080611c4292600196975f92610c6457505061538d565b90555b019050611b78565b94601f19821695835f5260205f20965f5b818110611c9c57509160019697918488959410611c83575b505050811b019055611c45565b01355f19600384901b60f8161c191690558d8080611c76565b8284013589556001909801978f975060209283019201611c5e565b634e487b7160e01b5f52603260045260245ffd5b637f043f9b60e01b5f5260045ffd5b82817f9204f1001d8059e799b3a233fa5114eab3b5d30762de3ff4e07fcd7e6266aad160208a835f526007825260405f20815f5282526003611d2d60ff60405f205416865f526005855260405f20614f5b565b500163ffffffff8381835416171663ffffffff19825416179055611d60611d5a60ff875460981c166151cb565b866156d6565b604051908152a25460ff808260181c169160981c1614611d805760015f55005b7ff6b9b3035e320bcce495d00c2d31a7bd341754f7b9919a4a736388e16ef674a55f80a2806105b8565b6387db46a560e01b5f5260045ffd5b634ec4810560e11b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c164211611ae0565b34610699576020366003190112610699576001600160a01b03611e0a614f2f565b165f526017602052608060405f2060ff60018254920154166040519160018060a01b038116835263ffffffff8160a01c16602084015260c01c604083015215156060820152f35b34610699576040366003190112610699576004356024356001600160401b03811161069957611e84903690600401615145565b611e8f929192615875565b611e9882615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957611ec99083615919565b1561060a57611ed66159d5565b611edf82615893565b92825f52600460205260ff600260405f2001541660078110156106555760050361064657825f52601160205260405f2060018060a01b0385165f5260205260405f205415610637576104008211610d9957611f3a84846159f0565b825f52601260205260405f209060405194611f5486614fe3565b611f5f3685846152fe565b86524263ffffffff16602087019081526001600160a01b0390911660408701818152845491949091600160401b811015610cd957611fa29160018201815561512c565b9790976120f2575180519097906001600160401b038111610cd957611fcb81611c198454614f74565b6020601f82116001146120725760016117f79695949361200a8463ffffffff9586955f516020616b055f395f51905f529e9f5f9261206757505061538d565b81555b9451940180549351600160201b600160c01b03199290951692909216166001600160c01b031990921691909117602092831b600160201b600160c01b031617905560408051948552908401819052929384938401916152c1565b015190508f80610c4b565b601f19821699835f52815f209a5f5b8181106120da5750936001845f516020616b055f395f51905f529c9d63ffffffff9695839588976117f79d9c9b9a106120c2575b505050811b01815561200d565b01515f1960f88460031b161c191690558e80806120b5565b838301518d556001909c019b60209384019301612081565b634e487b7160e01b5f525f60045260245ffd5b34610699575f36600319011261069957602060405160328152f35b34610699576060366003190112610699576004356024356005811015610699576044356001600160401b0381116106995761215f903690600401615145565b61216a929192615875565b61217384615893565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576121a49085615919565b1561060a576121b16159d5565b6121ba84615893565b92845f52601060205260405f2060018060a01b0385165f5260205260ff60405f2054166005811015610655576123ed57845f52601160205260405f2060018060a01b0385165f5260205260405f20541561063757604082116123de576122426104b791604051928391602083019561223287896151af565b60408085015260608401916152c1565b519020835f52601160205260405f2060018060a01b0384165f5260205260405f2054036123cf57825f52601060205260405f2060018060a01b0383165f5260205260405f2060ff1981541660ff8316179055827f9b013793e3fbc06d6ff5e9b6ce06be7c635e957579a85ae6b262b85b13ecd874604051806122c5858783615707565b0390a2825f52600760205260405f2060018060a01b0383165f526020526080600361230260ff60405f205416865f52600560205260405f20614f5b565b500154161515806123c4575b6123185760015f55005b81837f7f1edd8653eda945bad547f4f89adfa659b5f748dc9d88a447ff44550d7210be61236660a0946123595f516020616b855f395f51905f529785616521565b6040519182918683615707565b0390a260405190600180841b0316815260406020820152602860408201527f55736564206d616669612066756e6374696f6e732077697468206e6f6e2d6d6160608201526766696120726f6c6560c01b6080820152a28080806105b8565b50600181141561230e565b63134fed2d60e01b5f5260045ffd5b63bf1ad44360e01b5f5260045ffd5b63fd8fd76760e01b5f5260045ffd5b3461069957604036600319011261069957612415614f19565b6004355f52601360205260405f209060018060a01b03165f52602052606060405f2060ff6001825492015460405192835260018060a01b038116602084015260a01c1615156040820152f35b34610699575f3660031901126106995760206040515f8152f35b346106995761248936614f45565b905f52600960205260405f2080548210156106995761144491611430915f5260205f2001615021565b34610699576020366003190112610699576124cb614f2f565b6124d3615ec6565b600380546001600160a01b0319166001600160a01b0392909216919091179055005b3461069957602036600319011261069957335f90815260186020526040902054600435906001600160a01b03161561282457335f908152601860205260409020546001600160a01b03165b815f52600560205260405f20905f5f908354915b8260ff821610612787575060ff169161256c83615240565b9361257a6040519586614ffe565b83855261258684615240565b602086019690601f190136883761259c85615240565b946125aa6040519687614ffe565b8086526125b9601f1991615240565b015f5b8181106127745750505f915f5b8560ff82161061267d57888888604051928392604084019060408552518091526060840191905f5b81811061265b575050508281036020840152815180825260208201916020808360051b8301019401925f915b83831061262a5786860387f35b919395509193602080612649600193601f1986820301875289516150c1565b9701930193019092869594929361261d565b82516001600160a01b03168452869550602093840193909201916001016125f1565b8761268c82849b999a9b614f5b565b50546001600160a01b0390811690871681141580612735575b6126be575b50506126b5906151cb565b979695976125c9565b9461272561272b92876126b595986126da60ff861680946156f3565b52875f52600a60205260405f209060018060a01b03165f5260205260405f2060018060a01b038a165f526020528b61271e8261271860405f20615021565b926156f3565b528b6156f3565b506151cb565b939050888a6126aa565b505f858152600a602090815260408083206001600160a01b038581168552908352818420908b16845290915290205461276d90614f74565b15156126a5565b60606020828901810191909152016125bc565b6127948186979597614f5b565b50546001600160a01b0387811691161415806127d6575b6127c1575b6127b9906151cb565b949294612554565b906127ce6127b9916151cb565b9190506127b0565b50835f52600a60205260405f206127ed8287614f5b565b50546001600160a01b039081165f90815260209283526040808220928a1682529190925290205461281d90614f74565b15156127ab565b33612540565b3461069957604036600319011261069957612843614f19565b6004355f52600260205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b34610699576020366003190112610699576060600435805f52601460205260ff60405f20541690805f52601560205260ff60405f205416905f52601660205260018060a01b0360405f2054169060405192835260208301526040820152f35b34610699576040366003190112610699576128eb614f19565b6004355f52601160205260405f209060018060a01b03165f52602052602060405f2054604051908152f35b34610699575f3660031901126106995761292e615ec6565b6129366159d5565b600160ff19815416176001557f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a2586020604051338152a1337f7c83004a7e59a8ea03b200186c4dda29a4e144d9844d63dbc1a09acf7dfcd4855f80a2005b34610699576040366003190112610699576129ac614f19565b6004355f52600760205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b34610699576020366003190112610699576004355f526014602052602060ff60405f205416604051908152f35b60a0366003190112610699576004356001600160401b03811161069957612a32903690600401615145565b906024359160ff83168303610699576044356001600160401b03811161069957612a60903690600401615145565b9093906064356001600160401b03811161069957612a82903690600401615145565b9560843594919390916001600160a01b038616860361069957612aa3615875565b612aab6159d5565b600460ff8316108015612f68575b612f595760208111612f4a57601a54965f198814612f365760018801601a5560405191612ae583614fc7565b6001600160401b0389168352336020840190815293612b053683856152fe565b604085019081525f606086015260ff821660808601525f60a08601525f60c08601525f60e08601525f61010086015263ffffffff42166101208601525f6101408601525f6101608601525f6101808601525f6101a08601525f6101c08601525f6101e08601528a5f52600460205260405f209560018060401b03865116875491600160401b600160e01b03905160401b169163ffffffff60e01b16171786555180519060018060401b038211610cd957612bcf82612bc660018a0154614f74565b60018a0161534a565b602090601f8311600114612ec957612bf092915f9183612ebe57505061538d565b60018601555b60608401519360078510156106555760028087018054608084015161ffff1990911660ff9889161760089190911b61ff001617815560a08301518d987fd9abe6195309293e802058345712163744c28bde8471531f9990f08419585bcf98612d2b9591949390926101e09291612c6e9185169061557d565b612c808360c083015116858701615595565b612c9461ffff60e08301511685870161565a565b612ca78361010083015116858701615679565b612cbe63ffffffff61012083015116858701615696565b612cd563ffffffff61014083015116858701615281565b612ce883610160830151168587016152a4565b612cfb83610180830151168587016151dc565b612d0e836101a0830151168587016156b9565b612d21836101c0830151168587016152e1565b01511691016156d6565b60ff612d4a6040519485943386526060602087015260608601916152c1565b911660408301520390a260808211612eaf576104008611612ea057612e598594612dc56020985f516020616b455f395f51905f5296885f5260058b52612db460405f209160405193612d9b85614fac565b338552612da9368b8b6152fe565b8e86015236916152fe565b60408301526002606083015261539f565b5f86815260068952604080822033808452908b52818320805460ff1990811660011790915589845260078c52828420918452908b52818320805490911690558782526004808b528183206002908101805462ff0000191662010000179055898452908b52912001805463ff000000191663010000001790556001600160a01b038116612e68575b6040519384933385615623565b0390a260015f55604051908152f35b612e73868233616364565b3415612e4c57612e9b5f808080346001600160a01b0387165af1612e956155af565b506155de565b612e4c565b63450bc0a760e01b5f5260045ffd5b636f6003c360e01b5f5260045ffd5b015190508e80610c4b565b9190600188015f52805f20905f935b601f1984168510612f1b576001945083601f19811610612f03575b505050811b016001860155612bf6565b01515f1960f88460031b161c191690558d8080612ef3565b81810151835560209485019460019093019290910190612ed8565b634e487b7160e01b5f52601160045260245ffd5b630b279b2f60e41b5f5260045ffd5b6319413ccd60e11b5f5260045ffd5b50601460ff831611612ab9565b34610699575f36600319011261069957602060405161012c8152f35b34610699575f3660031901126106995760206040515f516020616be55f395f51905f528152f35b6080366003190112610699576004356024356001600160401b03811161069957612fe6903690600401615145565b6044356001600160401b03811161069957613005903690600401615145565b92906064356001600160a01b03811680820361069957613023615875565b61302b6159d5565b865f526004602052600260405f200195865460ff81166007811015610655576106465760ff808260081c169160101c1610156131b8575f88815260066020908152604080832033845290915290205460ff166131aa5760808611612eaf576104008111612ea0575f516020616b455f395f51905f5296886130f58861316b94612db46117f799855f52600560205260ff60405f205416955f52600560205260405f20926130e98d604051966130df88614fac565b33885236916152fe565b602086015236916152fe565b5f8a815260066020908152604080832033808552908352818420805460ff199081166001179091558e8552600784528285209185529252909120805490911660ff92831617905581546131559161314f9160101c166151cb565b8261557d565b61316560ff825460181c166151cb565b90615595565b8061317f575b506040519384933385615623565b61318a878333616364565b3415613171575f8080806131a49434905af1612e956155af565b86613171565b621d934160e11b5f5260045ffd5b63bc42480360e01b5f5260045ffd5b34610699576020366003190112610699576004355f526016602052602060018060a01b0360405f205416604051908152f35b34610699576020366003190112610699575f6101e060405161321a81614fc7565b828152826020820152606060408201528260608201528260808201528260a08201528260c08201528260e08201528261010082015282610120820152826101408201528261016082015282610180820152826101a0820152826101c082015201526004355f52600460205260405f2060026040519161329883614fc7565b80546001600160401b038116845260401c6001600160a01b031660208401526132c360018201615021565b6040840152015460ff81169060078210156106555760ff916060840152818160081c166080840152818160101c1660a0840152818160181c1660c084015261ffff8160201c1660e0840152818160301c1661010084015263ffffffff8160381c1661012084015263ffffffff8160581c16610140840152818160781c16610160840152818160801c16610180840152818160881c166101a0840152818160901c166101c084015260981c166101e082015260405180916020825260018060401b03815116602083015260018060a01b03602082015116604083015260ff6101e06133be604084015161020060608701526102208601906150c1565b926133d16060820151608087019061511f565b8260808201511660a08601528260a08201511660c08601528260c08201511660e086015261ffff60e082015116610100860152826101008201511661012086015263ffffffff6101208201511661014086015263ffffffff61014082015116610160860152826101608201511661018086015282610180820151166101a0860152826101a0820151166101c0860152826101c082015116828601520151166102008301520390f35b34610699576020366003190112610699576004355f526015602052602060ff60405f205416604051908152f35b34610699576040366003190112610699576134bf614f19565b6004355f52600e60205260405f209060018060a01b03165f52602052602060ff60405f205416610f0d6040518092615172565b346106995760403660031901126106995761350b614f19565b6004355f52600660205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b34610699576080366003190112610699576004356024356004811015610699576044356001600160a01b038116808203610699576064356001600160401b0381116106995761358e903690600401615145565b613599929192615875565b6135a286615893565b865f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576135d39087615919565b1561060a57855f52600460205263ffffffff600260405f20015460581c161515806138ad575b610669576136056159d5565b61360e86615893565b92865f526004602052600260405f20019460ff86541660078110156106555760050361064657875f52600760205260405f2060018060a01b0386165f526020526010600361366e60ff60405f2054168b5f52600560205260405f20614f5b565b500154166119e5576001871461389f576136888589615999565b156138905786151580613887575b613853575b506136ce6104b79160405192839160208301956136b8878c615172565b87604085015260608085015260808401916152c1565b519020855f52600d60205260405f2060018060a01b0384165f5260205260405f205403610da8575f858152600d602090815260408083206001600160a01b0386168085529083528184206001908101805460ff199081169092179055898552600e84528285208286528452828520805460ff8b811691909316179055898552600f8452828520828652845282852080546001600160a01b03191687179055898552600784528285209185529083528184205489855260059093529220919587947fefeac4ab688c036b72571c6adaf81feb0d4e0a7099c1cfd8d09e54370198c53c94606094919390926138199290916003916137cc918c1690614f5b565b500163ffffffff601081835416171663ffffffff198254161790556137ff6137f98a8a5460901c166151cb565b896152e1565b6040516001600160a01b0390941684526020840190615172565b6040820152a254818160881c1691829160901c16149081613849575b506138405760015f55005b610bef906160fb565b9050151582613835565b875f52600660205260405f20845f5260205260ff60405f205416156106195761387c9088615919565b1561060a578761369b565b50831515613696565b63205e472d60e21b5f5260045ffd5b6282b42960e81b5f5260045ffd5b50855f52600460205263ffffffff600260405f20015460581c1642116135f9565b34610699576040366003190112610699576138e7614f19565b6004355f52600c60205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b34610699575f36600319011261069957602060405160788152f35b346106995760403660031901126106995760e06003613986600435613953614f19565b815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b50015460806040519160028116151583526001811615156020840152600481161515604084015260088116151560608401526010811615158284015260208116151560a084015216151560c0820152f35b34610699575f36600319011261069957602060ff600154166040519015158152f35b3461069957604036600319011261069957613a12614f19565b6004355f52600860205260405f209060018060a01b03165f526020526040805f2060ff6002825492015416825191825215156020820152f35b3461069957602036600319011261069957600435613a67615875565b613a7081615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957613aa19082615919565b1561060a57805f52600460205263ffffffff600260405f20015460581c16151580613b2b575b61066957613ad36159d5565b613adc81615893565b815f526004602052600260405f20019060ff82541660078110156106555760020361064657613b0b818461595e565b6119e5575f516020616c055f395f51905f5260208261196f869485615a47565b50805f52600460205263ffffffff600260405f20015460581c164211613ac7565b34610699576020366003190112610699576001600160a01b03613b6d614f2f565b165f526018602052602060018060a01b0360405f205416604051908152f35b34610699575f36600319011261069957335f52601760205260405f20600181019060ff825416613bb857005b80546001600160a01b031680337f744157ccffbd293a2e8644928cd7d23d650f869b88f72d7bfea8041b76ca6bec5f80a35f90815260186020908152604080832080546001600160a01b031916905592546001600160a01b031682526019905220805460ff199081169091558154169055005b34610699575f36600319011261069957613c43615ec6565b5f80808047818115613c65575b3390f115613c5a57005b6040513d5f823e3d90fd5b506108fc613c50565b34610699576020366003190112610699576004355f52600560205260405f20805490613c9982615240565b91613ca76040519384614ffe565b8083526020830180925f5260205f205f915b838310613d6557848660405191829160208301906020845251809152604083019060408160051b85010192915f905b828210613cf757505050500390f35b919360019193955060208091603f19898203018552875190848060a01b038251168152606063ffffffff81613d4e613d3c8787015160808988015260808701906150c1565b604087015186820360408801526150c1565b940151169101529601920192018594939192613ce8565b60046020600192604051613d7881614fac565b848060a01b038654168152613d8e858701615021565b83820152613d9e60028701615021565b604082015263ffffffff6003870154166060820152815201920192019190613cb9565b3461069957613dcf36614f45565b613dd7615875565b613de082615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957613e119083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580613f9e575b61066957613e436159d5565b613e4c82615893565b90825f526004602052600260405f20015460ff811660078110156106555760010361064657613e8e90845f52600560205260ff60405f209160301c1690614f5b565b50546001600160a01b0390811690831603613f8f57825f52600760205260405f2060018060a01b0383165f5260205260406003613edb60ff835f205416865f526005602052835f20614f5b565b50015416611800575f8381526008602090815260408083206001600160a01b038616808552908352818420858155600201805460ff191690558684526007835281842090845282528083205486845260059092529091207ffbabe9c4a6257c269f37e649a08003e579b119fcff47ac57e59d1502fccea41c9391600391613f659160ff1690614f5b565b500163ffffffff604081835416171663ffffffff198254161790556117f760405192839283615257565b631cc191eb60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211613e37565b3461069957613fcd36614f45565b613fd5615875565b613fde82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761400f9083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580614143575b610669576140416159d5565b61404a82615893565b90825f52600460205260ff600260405f2001541660078110156106555760050361064657825f52601160205260405f2060018060a01b0383165f5260205260405f20541561063757825f52601360205260405f2060018060a01b0383165f5260205260405f205461413457816140e17ff5adb2642a216ea3114d73daac494b2341695b10db2b0e6be988acb22fbc156493856159f0565b835f52601360205260405f2060018060a01b0382165f526020528160405f2055835f52601460205260405f2060ff61411b818354166151cb565b1660ff198254161790556117f760405192839283615257565b6317ac735560e11b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211614035565b34610699575f3660031901126106995761417c615ec6565b60015460ff8116156141e05760ff19166001557f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa6020604051338152a1337f306ca22c455fe433ebbf0542bbf947ea6a725495f9e1043db2a47e3c579403855f80a2005b638dfc202b60e01b5f5260045ffd5b34610699576020366003190112610699576001600160a01b03614210614f2f565b165f526019602052602060ff60405f2054166040519015158152f35b34610699575f3660031901126106995760206040516138408152f35b3461069957602036600319011261069957600435614264615875565b61426d81615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761429e9082615919565b1561060a576142ab6159d5565b805f526004602052600260405f200160ff81541660078110156106555760030361064657805460ff60ff60801b01191660041781556142f29063ffffffff610fe142615272565b805f52600560205260405f205f5b815460ff821610156143c7578061431a6143939284614f5b565b50546001600160a01b031660036143318386614f5b565b5001805463fffffffb811663ffffffff199091161790555f858152600b602090815260408083206001600160a01b0385168452909152902080546001600160a01b0319169055600260036143858487614f5b565b5001541661439857506151cb565b614300565b5f858152600c602090815260408083206001600160a01b03909416835292905220805460ff1916905584612725565b825f516020616b655f395f51905f525f80a260015f55005b34610699576143ed36614f45565b6143f5615875565b6143fe82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761442f9083615919565b1561060a5761443c6159d5565b61444582615893565b90825f52600460205260ff600260405f2001541660078110156106555760020361064657825f52601160205260405f2060018060a01b0383165f5260205260405f20546119f4575f516020616b255f395f51905f5291835f52601160205260405f2060018060a01b0382165f526020528160405f20556117f760405192839283615257565b34610699576040366003190112610699576144e3614f19565b336001600160a01b038216036144ff576114a690600435615fe8565b63334bd91960e11b5f5260045ffd5b346106995761451c36614f45565b905f52601260205260405f208054821015610699576145619161453e9161512c565b50600161454a82615021565b9101546040519283926060845260608401906150c1565b9063ffffffff8116602084015260018060a01b039060201c1660408301520390f35b34610699576040366003190112610699576114a66004356145a2614f19565b906145af61149c8261522e565b615f5c565b34610699576020366003190112610699576004355f52600960205260405f208054906145df82615240565b916145ed6040519384614ffe565b8083526020830180925f5260205f205f915b83831061466c57848660405191829160208301906020845251809152604083019060408160051b85010192915f905b82821061463d57505050500390f35b9193600191939550602061465c8192603f198a820301865288516150c1565b960192019201859493919261462e565b60016020819261467b85615021565b8152019201920191906145ff565b346106995760203660031901126106995760206146a760043561522e565b604051908152f35b34610699576101a03660031901126106995760043536606411610699573660e41161069957366101241161069957366101a411610699576146ee615875565b6146f66159d5565b805f52600460205260ff600260405f200154166007811015610655578015908115614999575b50610646576003546001600160a01b031680156149615760408051635fe8c13b60e01b81529190602460048401378160645f604483015b600282106149475750505061018481602093604060e460c484013760806101246101048401375afa908115613c5a575f9161490c575b50156148d45780610144350361489d5760016101243503614862576101643561482957600261018435106147ea576105b890604051906147ca604083614ffe565b600e82526d546f776e2077696e7320285a4b2960901b6020830152615e61565b60405162461bcd60e51b81526020600482015260176024820152764e6f7420656e6f75676820746f776e20706c617965727360481b6044820152606490fd5b60405162461bcd60e51b81526020600482015260116024820152704d61666961207374696c6c20616c69766560781b6044820152606490fd5b60405162461bcd60e51b81526020600482015260136024820152721692c818dbdb991a5d1a5bdb8819985a5b1959606a1b6044820152606490fd5b60405162461bcd60e51b815260206004820152600f60248201526e0a4dededa92c840dad2e6dac2e8c6d608b1b6044820152606490fd5b60405162461bcd60e51b815260206004820152601060248201526f24b73b30b634b2102d2590383937b7b360811b6044820152606490fd5b90506020813d60201161493f575b8161492760209383614ffe565b81010312610699575180151581036106995782614789565b3d915061491a565b829350604081816001949581943701930191018492614753565b60405162461bcd60e51b815260206004820152601060248201526f15995c9a599a595c881b9bdd081cd95d60821b6044820152606490fd5b60069150148261471c565b34610699576020366003190112610699576004355f52600460205260405f20805460026149d360018401615021565b920154604080516001600160401b038416815292811c6001600160a01b031660208401526102009083018190529192839260ff91614a13918501906150c1565b91614a236060850183831661511f565b818160081c166080850152818160101c1660a0850152818160181c1660c085015261ffff8160201c1660e0850152818160301c1661010085015263ffffffff8160381c1661012085015263ffffffff8160581c16610140850152818160781c16610160850152818160801c16610180850152818160881c166101a0850152818160901c166101c085015260981c166101e08301520390f35b34610699576020366003190112610699576004355f526004602052602063ffffffff600260405f20015460581c16604051908152f35b3461069957614aff36614f45565b905f52600560205260405f2090815481101561069957614b1e91614f5b565b5080546001600160a01b0316614b3660018301615021565b91614b7c63ffffffff6003614b4d60028501615021565b9301541691614b6e60405195869586526080602087015260808601906150c1565b9084820360408601526150c1565b9060608301520390f35b34610699575f366003190112610699576020601a54604051908152f35b3461069957604036600319011261069957600435614bbf614f19565b614bc7615875565b614bd082615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957614c019083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580614ea5575b61066957614c336159d5565b614c3c82615893565b90825f526004602052600260405f20019160ff83541660078110156106555760040361064657835f52600660205260405f2060018060a01b0383165f5260205260ff60405f2054161561061957614c938285615919565b1561060a5783917fcfff1651bcea794952a516ce970ab17518a85210bd939aaeaac670a8d3e65ec791835f52600760205260405f2060018060a01b0382165f5260205260046003614cf660ff60405f205416875f52600560205260405f20614f5b565b5001545f868152600b602090815260408083206001600160a01b0387811685529252909120549290911615911680151580614e7b575b614e3f575b505f858152600b602090815260408083206001600160a01b03868116855290835281842080546001600160a01b0319169188169182179055888452600c83528184209084529091529020805460ff90614d8b9082166151cb565b1660ff19825416179055614dce575b614da9604051928392836151f9565b0390a25460ff808260181c169160801c1614614dc55760015f55005b610bef90615a9e565b835f52600760205260405f2060018060a01b0382165f526020526003614e0660ff60405f205416865f52600560205260405f20614f5b565b500163ffffffff600481835416171663ffffffff19825416179055614e3a614e3460ff875460801c166151cb565b866151dc565b614d9a565b855f52600c60205260405f209060018060a01b03165f5260205260405f2060ff614e6b818354166151bc565b1660ff1982541617905587614d31565b50855f52600c60205260405f2060018060a01b0382165f5260205260ff60405f2054161515614d2c565b50815f52600460205263ffffffff600260405f20015460581c164211614c27565b34610699576020366003190112610699576004359063ffffffff60e01b821680920361069957602091637965db0b60e01b8114908115614f08575b5015158152f35b6301ffc9a760e01b14905083614f01565b602435906001600160a01b038216820361069957565b600435906001600160a01b038216820361069957565b6040906003190112610699576004359060243590565b8054821015611cb7575f5260205f209060021b01905f90565b90600182811c92168015614fa2575b6020831014614f8e57565b634e487b7160e01b5f52602260045260245ffd5b91607f1691614f83565b608081019081106001600160401b03821117610cd957604052565b61020081019081106001600160401b03821117610cd957604052565b606081019081106001600160401b03821117610cd957604052565b601f909101601f19168101906001600160401b03821190821017610cd957604052565b9060405191825f82549261503484614f74565b808452936001811690811561509f575060011461505b575b5061505992500383614ffe565b565b90505f9291925260205f20905f915b818310615083575050906020615059928201015f61504c565b602091935080600191548385890101520191019091849261506a565b90506020925061505994915060ff191682840152151560051b8201015f61504c565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b606090600319011261069957600435906024356001600160a01b038116810361069957906044356001600160a01b03811681036106995790565b9060078210156106555752565b8054821015611cb7575f5260205f209060011b01905f90565b9181601f84011215610699578235916001600160401b038311610699576020838186019501011161069957565b9060048210156106555752565b9181601f84011215610699578235916001600160401b038311610699576020808501948460051b01011161069957565b9060058210156106555752565b60ff168015612f36575f190190565b60ff1660ff8114612f365760010190565b805460ff60801b191660809290921b60ff60801b16919091179055565b6001600160a01b0391821681529116602082015260400190565b6001600160401b038111610cd957601f01601f191660200190565b5f526002602052600160405f20015490565b6001600160401b038111610cd95760051b60200190565b6001600160a01b039091168152602081019190915260400190565b9061012c8201809211612f3657565b805463ffffffff60581b191660589290921b63ffffffff60581b16919091179055565b805460ff60781b191660789290921b60ff60781b16919091179055565b908060209392818452848401375f828201840152601f01601f1916010190565b805460ff60901b191660909290921b60ff60901b16919091179055565b92919261530a82615213565b916153186040519384614ffe565b829481845281830111610699578281602093845f960137010152565b81811061533f575050565b5f8155600101615334565b9190601f811161535957505050565b615059925f5260205f20906020601f840160051c83019310615383575b601f0160051c0190615334565b9091508190615376565b8160011b915f199060031b1c19161790565b8054600160401b811015610cd9576153bc91600182018155614f5b565b9190916120f257805182546001600160a01b0319166001600160a01b03919091161782556020810151805160018401916001600160401b038211610cd95761540e826154088554614f74565b8561534a565b602090601f831160011461551a5761542f92915f91836154a157505061538d565b90555b6040810151805160028401916001600160401b038211610cd95761545a826154088554614f74565b602090601f83116001146154ac57936003936154898463ffffffff979560609589975f926154a157505061538d565b90555b0151169201911663ffffffff19825416179055565b015190505f80610c4b565b90601f19831691845f52815f20925f5b81811061550257508460609463ffffffff9894600398948a98600195106154eb575b505050811b01905561548c565b01515f19838a1b60f8161c191690555f80806154de565b929360206001819287860151815501950193016154bc565b90601f19831691845f52815f20925f5b818110615565575090846001959493921061554d575b505050811b019055615432565b01515f1960f88460031b161c191690555f8080615540565b9293602060018192878601518155019501930161552a565b9062ff000082549160101b169062ff00001916179055565b9063ff00000082549160181b169063ff0000001916179055565b3d156155d9573d906155c082615213565b916155ce6040519384614ffe565b82523d5f602084013e565b606090565b156155e557565b60405162461bcd60e51b81526020600482015260166024820152752330b4b632b2103a3790333ab7321039b2b9b9b4b7b760511b6044820152606490fd5b929160409261564a9296959660018060a01b031685526060602086015260608501916152c1565b6001600160a01b03909416910152565b805461ffff60201b191660209290921b61ffff60201b16919091179055565b805460ff60301b191660309290921b60ff60301b16919091179055565b805463ffffffff60381b191660389290921b63ffffffff60381b16919091179055565b805460ff60881b191660889290921b60ff60881b16919091179055565b805460ff60981b191660989290921b60ff60981b16919091179055565b8051821015611cb75760209160051b010190565b6001600160a01b03909116815260408101929161505991602001906151af565b903590601e198136030182121561069957018035906001600160401b0382116106995760200191813603831361069957565b60405190615768604083614ffe565b6019825278546f6f2066657720706c61796572732072656d61696e696e6760381b6020830152565b90602083828152019060208160051b85010193835f915b8383106157b75750505050505090565b909192939495601f198282030186528635601e1984360301811215610699578301602081019190356001600160401b0381116106995780360383136106995761580660209283926001956152c1565b9801960194930191906157a7565b60ff60019116019060ff8211612f3657565b60405190615835604083614ffe565b6009825268546f776e2077696e7360b81b6020830152565b6040519061585c604083614ffe565b600a8252694d616669612077696e7360b01b6020830152565b60025f54146158845760025f55565b633ee5aeb560e01b5f5260045ffd5b335f908152601860205260409020546001600160a01b031690816158b75750503390565b815f52601760205260405f2060ff6001820154161561590a575463ffffffff8160a01c1642116158fb5760c01c036158ec5790565b637ce3c8fd60e11b5f5260045ffd5b630fe82d2560e11b5f5260045ffd5b635f8874dd60e11b5f5260045ffd5b615955600391600293815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b50015416151590565b615955600391600193815f52600760205260405f2090858060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b615955600391600893815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b60ff600154166159e157565b63d93c066560e01b5f5260045ffd5b615a2a90600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b5001805463ffffffff19811663ffffffff91909116176080179055565b615a8190600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b5001805463ffffffff19811663ffffffff91909116176001179055565b90815f5260046020528160405f205f905f90835f52600560205260405f205f908054915b8260ff821610615dd957505050607f600260ff92015460191c16911690811180615dc7575b15615da45781604091615b085f516020616ba55f395f51905f529486616521565b845f516020616b855f395f51905f52608085519460018060a01b03169485815286602082015260098782015268159bdd1959081bdd5d60ba1b6060820152a282519182526020820152a25b815f52600560205260405f20915f5b835460ff82161015615bf65780615b7c615bf19286614f5b565b50545f848152600b602090815260408083206001600160a01b0390941680845293825280832080546001600160a01b0319169055868352600c825280832093835292905220805460ff191690556003615bd58287614f5b565b5001805463fffffffb811663ffffffff199091161790556151cb565b615b62565b505f818152600460205260409020600201805460ff60801b19169055909150615c1e81616a39565b15615c265750565b5f818152600460205260409020600201805460ff61ffff60881b0119166005178155615c5a9063ffffffff610fe142615272565b805f52600560205260405f205f5b815460ff82161015615d3e5780615c82615d399284614f5b565b50546001600160a01b03166003615c998386614f5b565b5001805463ffffffe7811663ffffffff199091161790555f858152600d602090815260408083206001600160a01b03949094168084529382528083208381556001908101849055888452600e83528184208585528352818420805460ff19169055888452600f8352818420858552835281842080546001600160a01b031916905588845260138352818420948452939091528120818155909101556151cb565b615c68565b50505f818152601460209081526040808320805460ff1990811690915560158352818420805490911690556016909152812080546001600160a01b03191690557f34b0c4c95aa7776d35dbd8b24afd53388828c61c26fd5a6b11a21809662440879080a2565b50505f516020616ba55f395f51905f52604080515f81525f6020820152a2615b53565b506001600160a01b0382161515615ae7565b9091929394955060026003615dee8385614f5b565b50015416615e0c575b615e00906151cb565b90879594939291615ac2565b615e168183614f5b565b50545f898152600c602090815260408083206001600160a01b039094168084529390915290205460ff9081169087168111615e53575b5050615df7565b9096509450615e005f615e4c565b5f81815260046020908152604091829020600201805460ff63ffffffff60581b0119166006179055905181815291927fd778487128ba4386ebcfb2703af01f8a2a2b8663f880622d26a77a29397e68f392918291615ec1918301906150c1565b0390a2565b335f9081527fe5ebfa64fca8d502a8e50c1edffd2c31ef4dad5b396e65d9f397fb028f74abc5602052604090205460ff1615615efe57565b63e2517d3f60e01b5f52336004525f516020616be55f395f51905f5260245260445ffd5b5f81815260026020908152604080832033845290915290205460ff1615615f465750565b63e2517d3f60e01b5f523360045260245260445ffd5b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff16615fe2575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19166001179055339291907f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d9080a4600190565b50505f90565b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff1615615fe2575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19169055339291907ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9080a4600190565b805f526004602052600260405f2001600360ff1982541617815561ffff815460201c169061ffff8214612f365761ffff6020916160cd60017fa9b4e96158ed085745975f198fa026959997245ae7e7aed9cd0252ce02b2107195018261565a565b6160dd63ffffffff421682615696565b6160ee63ffffffff610b8842615272565b54821c16604051908152a2565b90815f5260166020528160018060a01b0360405f2054165f825f52600560205260405f205f908054905b8160ff8416106162d2575b505050827fb874a4c95be602274c8e6944d4d375ca4189eda377b69ee751f3b92dd4dcf2d8604051806161648587836151f9565b0390a281151590816162be575b5061626f575b505f52600560205260405f20915f5b835460ff8216101561623557806161a06162309286614f5b565b50545f848152600d602090815260408083206001600160a01b03909416808452938252808320838155600101839055868352600e82528083208484528252808320805460ff19169055868352600f82528083209383529290522080546001600160a01b031916905560036162148287614f5b565b5001805463ffffffe7811663ffffffff199091161790556151cb565b616186565b505f818152600460205260409020600201805461ffff60881b1916905590915061625e81616a39565b156162665750565b6150599061606c565b60808161628a5f516020616b855f395f51905f529385616521565b60405190815260406020820152600f60408201526e12da5b1b195908185d081b9a59da1d608a1b6060820152a2815f616177565b6001600160a01b031682141590505f616171565b909194506162e08582614f5b565b50545f888152600e602090815260408083206001600160a01b039094168084529390915290205460ff169590600487101561065557600289971461632f5750616328906151cb565b9190616125565b5f878152600f602090815260408083206001600160a01b03948516845290915281205490911694509250829150819050616130565b6001600160a01b0390911691908215611ccb57825f52601960205260ff60405f205416616512575f838152601860205260409020546001600160a01b0316616512576001600160a01b03165f8181526017602052604090206001015490919060ff166164cd575b6138404201804211612f36577f290e52799b1ac63207e28c21f7f1f387cf8ea9257dde8e363a02e157d8e4c6589163ffffffff60409216616491835161641081614fac565b8781526020808201848152600180881b5f19018716888501908152606085018281525f8c81526017909552938990209451925190516001600160c01b031960c09190911b166001600160a01b0390931663ffffffff60a01b60a09290921b919091161791909117835590519101805460ff191691151560ff16919091179055565b5f8681526018602090815284822080546001600160a01b031916881790556019815290849020805460ff191660011790558351928352820152a3565b5f828152601760209081526040808320546001600160a01b031683526018825280832080546001600160a01b031916905560199091529020805460ff191690556163cb565b631fef749360e21b5f5260045ffd5b9061652c8183615919565b156165a657815f52600760205260405f209060018060a01b03165f52602052600361656960ff60405f205416835f52600560205260405f20614f5b565b500163ffffffff63fffffffd8254161663ffffffff198254161790555f526004602052615059600260405f200161316560ff825460181c166151bc565b5050565b5f52600560205260405f205f8154905b8160ff8216106165cd575060ff91501690565b600260036165db8386614f5b565b500154166165f1576165ec906151cb565b6165ba565b91505090565b5f52600560205260405f20908154905b8160ff82161061661a575060ff91501690565b600260036166288386614f5b565b500154166165f157616639906151cb565b616607565b5f8181526004602052604090206002908101805460ff64ff000000ff60781b01191690911781556166779063ffffffff610fe142615272565b5f52600560205260405f20905f5b825460ff821610156166dd5780600260036166a36166b09487614f5b565b500154166166b5576151cb565b616685565b60036166c18286614f5b565b5001805463ffffff9e811663ffffffff199091161790556151cb565b509050565b5f818152600560205260408120805492915b8360ff8216106167075750505050600190565b600260036167158385614f5b565b5001541615158061673b575b6167335761672e906151cb565b6166f4565b505050505f90565b50825f52601060205260405f206167528284614f5b565b50546001600160a01b03165f908152602091909152604090205460ff1660058110156106555715616721565b905f5f92805f52600560205260405f205f918154925b8360ff8216106167d5575050505060ff16801592831591826167c7575b50836167bc57509190565b60ff91935016151590565b60ff8216111591505f6167b1565b600260036167e38386614f5b565b500154166167fa575b6167f5906151cb565b616794565b93815f52601060205260405f206168118685614f5b565b50546001600160a01b03165f908152602091909152604090205460ff1660058110156106555760018103616855575061684c6167f5916151cb565b945b90506167ec565b909490616866575b6167f59061684e565b956168736167f5916151cb565b96905061685d565b805f52601460205260ff60405f20541615616a36575f81815260056020526040812080546001918390815b8360ff821610616947575b505050505f516020616c255f395f51905f5291818060409390616935575b1561692e57815b5f868152601660205284902080546001600160a01b0319166001600160a01b0385161790558161691b575b5082516001600160a01b03909216825215156020820152a2565b6001600160a01b0316151590505f616901565b5f916168d6565b506001600160a01b03821615156168cf565b6169518183614f5b565b50545f8881526013602090815260408083206001600160a01b03949094168084529390915290206001015460a01c60ff1680616a1c575b61699c575b50616997906151cb565b6168a6565b5f8881526013602090815260408083206001600160a01b03948516845290915290206001015492969193921691806169de575050936169976001925b9061698d565b9095909290916001600160a01b038716036169fc57616997906169d8565b505050505060405f516020616c255f395f51905f52915f9181935f6168b1565b5060026003616a2b8486614f5b565b500154161515616988565b50565b805f52600460205260ff600260405f20015460181c166001811115616aa15750616a62816166e2565b616a6b57505f90565b616a748161677e565b9015616a8c5750616a879061082c61584d565b600190565b616a9557505f90565b616a879061082c615826565b616a879190616acf57604051616ab8604082614ffe565b60048152634472617760e01b602082015290615e61565b604051616add604082614ffe565b60148152734c61737420706c61796572207374616e64696e6760601b602082015290615e6156fea4a46989ff60ad96ec74df0f289e1e16b51c97fecb224f2e8e927103d5b54eaef33c1bd762b898b33040e70f49cf90ff496cf7366f6fafa9d961b0de89b7244b3b7d84e02e9f6642b42e0ca3e77297f9c7c807832a60c0fc1926ade76abc7badcf33babc496bb6dc2942b39cb7b75766bbbadf7da50d176ff8c513e991140239b1ed64d561b0179e61c72bf46d0809a99dac99baeb98fc9f5d13be1f6c2e3f826b571d1c11516ea63adff1048766bdfa510e9c5bf4e32ca29d4ba11e16edf2f18ef7613b6eacaa71c74d950e2c093c23a0d3ecb066d1387d80e95159d07ed08ba49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177582b52ddf0195aa8ac16480985f5042052aa742563721520fa34764d253824d43020f20553b51a906b0cb24d2431eb46bd2dc31b5c75d4ba8165ff1bb284ad2a1a2646970667358221220728f0db592457a0be5bb6b1787b786ac476bb510fbe81f39d36f3d1f0696163464736f6c634300081c00332f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0dac33ff75c19e70fe83507db0d683fd3465c996598dc972688b7ace676c89077be5ebfa64fca8d502a8e50c1edffd2c31ef4dad5b396e65d9f397fb028f74abc5",
  "deployedBytecode": "0x6080806040526004361015610012575f80fd5b5f3560e01c90816301ffc9a714614ec65750806302d947ef14614ba357806307a52cab14614b8657806309ed3e2214614af157806312c57f55146113e757806314a09d6014614abb5780631bae0ac8146149a457806323f906d5146146af578063248a9ca3146146895780632a51fb3a146145b45780632f2ff15d1461458357806330a05e73146129da57806335b972991461450e57806336568abe146144ca57806337048f21146143df5780633d2f5bda146142485780633deaa3411461422c5780633ec09d2c146141ef5780633f4ba83a146141645780633fb5d9f514613fbf57806343cd690314613dc1578063460e204914613c6e578063476343ee14613c2b57806348e69d1f14613b8c5780634f324d1414613b4c5780635099fae214613a4b578063567e8dd5146139f95780635c975abb146139d75780635d99dc3e146139305780635e82ff651461391557806361ea2027146138ce5780636594bb0c1461353b578063660e907c146134f2578063669ead17146134a65780636920e3ee146134795780636d8a74cb146131f95780636e2083f4146131c75780637120465b14612fb857806375b238fc14612f915780637fa9c28914612f75578063800122d614612a0757806382fab9d8146129da57806384411c0a146129935780638456cb59146129165780638a8dd7f4146128d25780638d29f52f1461287357806391d148541461282a57806394225e9d146124f557806396913528146124b2578063a05bcf021461247b578063a217fddf14612461578063aa55acbf146123fc578063af38479114612120578063af7efa7c14612105578063b6bf359a14611e51578063b7b8d60414611de9578063bb9ae87514611a24578063bcb7215914611830578063c96f09791461161f578063d0655394146114f2578063d23254b4146114a8578063d547741f14611470578063d6df096d14611448578063d94a51cb146113e7578063dae2928a14611021578063e5ed1d5914610f0f578063e851122d14610ec1578063ea99c3fe14610dd8578063eb0241011461091e578063eb0fa6f8146108d4578063f14caed714610871578063f30818ff14610774578063f3db51331461069d5763ff99233a1461034a575f80fd5b3461069957606036600319011261069957600435610366614f19565b6044356001600160401b03811161069957610385903690600401615145565b9161038e615875565b61039784615893565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576103c89085615919565b1561060a57835f52600460205263ffffffff600260405f20015460581c16151580610678575b610669576103fa6159d5565b61040384615893565b92845f52600460205260ff600260405f2001541660078110156106555760050361064657845f52601160205260405f2060018060a01b0385165f5260205260405f20541561063757845f52601360205260405f2060018060a01b0385165f5260205260ff600160405f20015460a01c166106285761048184866159f0565b6001600160a01b03821692836105dc575b6104c56104b791604051928391602083019588875260408085015260608401916152c1565b03601f198101835282614ffe565b519020845f52601360205260405f2060018060a01b0385165f5260205260405f2054036105cd575f8481526013602090815260408083206001600160a01b03871684528252808320600101805460ff60a01b199096166001600160a81b031990961695909517600160a01b179094558582526015905291909120805484937f307ed77ec1f8fe53e10faa7fa486ba5e5b66eab3a9d19902c20b0da3c3b0b26a9392909160ff906105769082166151cb565b1660ff1982541617905561058f604051928392836151f9565b0390a2805f52601560205260ff60405f205416815f52601460205260ff60405f205416146105be575b60015f55005b6105c79061687b565b5f6105b8565b6336c5b53760e11b5f5260045ffd5b855f52600660205260405f20845f5260205260ff60405f20541615610619576106058387615919565b610492575b630575d90f60e11b5f5260045ffd5b63721c7c6760e11b5f5260045ffd5b633a456ae760e11b5f5260045ffd5b631ea3b68b60e21b5f5260045ffd5b6338961af360e21b5f5260045ffd5b634e487b7160e01b5f52602160045260245ffd5b6301a6f70d60e01b5f5260045ffd5b50835f52600460205263ffffffff600260405f20015460581c1642116103ee565b5f80fd5b34610699576020366003190112610699576004355f5f5b825f52600560205260405f205460ff8216101561076657825f5260056020526106e08160405f20614f5b565b50545f8481526010602090815260408083206001600160a01b039094168352929052205460ff1660058110156106555760011480610741575b61072c575b610727906151cb565b6106b4565b90610739610727916151cb565b91905061071e565b50825f5260056020526002600361075b8360405f20614f5b565b500154161515610719565b60208260ff60405191168152f35b3461069957602036600319011261069957600435610790615875565b61079981615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576107ca9082615919565b1561060a576107d76159d5565b805f52600460205260ff600260405f200154166007811015610655578015908115610866575b506106465761080b816166e2565b15610857576108198161677e565b901561083257506105b89061082c61584d565b90615e61565b15610848576108439061082c615826565b6105b8565b63308ce0f960e11b5f5260045ffd5b63837cd79f60e01b5f5260045ffd5b6006915014826107fd565b346106995760403660031901126106995761088a614f19565b6004355f52600d60205260405f209060018060a01b03165f52602052606060405f2063ffffffff6001825492015460405192835260ff81161515602084015260081c166040820152f35b34610699576040366003190112610699576108ed614f19565b6004355f908152600f602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b34610699576060366003190112610699576004356024356001600160401b0381116106995761095190369060040161517f565b6044356001600160401b03811161069957610970903690600401615145565b92610979615875565b61098285615893565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576109b39086615919565b1561060a57845f52600460205263ffffffff600260405f20015460581c16151580610db7575b610669576109e56159d5565b6109ee85615893565b91855f526004602052600260405f20019485549160ff831660078110156106555760010361064657610a4c6104b791604051928391602083019560408752610a3a606085018c8b615790565b848103601f19016040860152916152c1565b519020865f52600860205260405f2060018060a01b0385165f5260205260405f205403610da85760328411610d9957855f52600960205260405f2054159081610d89575b50610d6457845f52600960205260405f2054151580610d73575b610d64575f858152600960205260409020600160401b8411610cd9578054848255808510610ced575b505f908152602081208694939291825b858210610bf55750505090610bc67f1522116f5d4e7ac5527e161307d73b93c621a9a7627553f584afb6b6f62a74e79392855f52600860205260405f2060018060a01b0384165f52602052600260405f2001600160ff19825416179055610ba5610b5c610b5660ff8a5460301c16615814565b886165f7565b97610b678982615679565b610b7763ffffffff421682615696565b610b8f63ffffffff610b8842615272565b1682615281565b610b9f60ff825460901c166151cb565b906152e1565b60405193849360018060a01b03168452604060208501526040840191615790565b0390a2815f52600560205260ff60405f205491161015610be65760015f55005b610bef9061663e565b806105b8565b90919293949550610c068185615727565b906001600160401b038211610cd957610c2982610c238754614f74565b8761534a565b5f90601f8311600114610c6f5792610c52836001959460209487965f92610c64575b505061538d565b86555b01930191018795949392610ae3565b013590508e80610c4b565b601f19831691865f5260205f20925f5b818110610cc15750936020936001969387969383889510610ca8575b505050811b018655610c55565b01355f19600384901b60f8161c191690558d8080610c9b565b91936020600181928787013581550195019201610c7f565b634e487b7160e01b5f52604160045260245ffd5b815f528460205f2091820191015b818110610d085750610ad3565b80610d1560019254614f74565b80610d22575b5001610cfb565b601f81118314610d3757505f81555b89610d1b565b610d5390825f5283601f60205f20920160051c82019101615334565b805f525f6020812081835555610d31565b63d1d2a30960e01b5f5260045ffd5b50845f52600960205260405f2054831415610aaa565b60ff915060101c16831086610a90565b63376ab11160e01b5f5260045ffd5b639ea6d12760e01b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c1642116109d9565b3461069957602036600319011261069957600435610df4615875565b610dfd81615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957610e2e9082615919565b1561060a57610e3b6159d5565b805f526004602052600260405f20015460ff811660078110156106555760050361064657815f52601460205260ff60405f2054168015159081610ea8575b50610e995760ff808260881c169160901c1610610da8576105b8906160fb565b6303488f9960e61b5f5260045ffd5b9050825f52601560205260ff60405f2054161083610e79565b3461069957604036600319011261069957610eda614f19565b6004355f52601060205260405f209060018060a01b03165f52602052602060ff60405f205416610f0d60405180926151af565bf35b3461069957602036600319011261069957600435610f2b615875565b610f3481615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957610f659082615919565b1561060a57610f726159d5565b805f526004602052600260405f2001805460ff81166007811015610655576106465760ff60049160101c161061101257805460ff19166001178155610fe890610fc3610fbd846165aa565b82615679565b610fd363ffffffff421682615696565b63ffffffff610fe142615272565b1690615281565b7f50ad08f58a27f2851d7e3a1b3a6a46b290f2ce677e99642d30ff639721e777905f80a260015f55005b63f770074360e01b5f5260045ffd5b346106995760203660031901126106995760043561103d615875565b61104681615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576110779082615919565b1561060a576110846159d5565b805f526004602052600260405f2001805463ffffffff8160581c1680159081156113dc575b506113cd5760ff16827f77ff69c1f99cadd93a6da75080e20a3fed43f1d42375051a5d162adcafc5fbb760206040516110e2818661511f565ba260078110156106555760018103611236575050805f526004602052600260405f20018160ff825460301c16815f52600560205260405f205481106111c1575b505061113d61113760ff835460301c16615814565b836165f7565b6111478183615679565b61115763ffffffff421683615696565b61116f63ffffffff61116842615272565b1683615281565b825f52600560205260ff60405f20549116101561118f575b505060015f55005b54600260189190911c60ff16106111b0576111a99061663e565b8080611187565b6111bc9061082c615759565b6111a9565b60806111e65f516020616bc55f395f51905f5292845f52600560205260405f20614f5b565b50546001600160a01b03166111fb8185616521565b60405190815260406020820152601660408201527554696d656f757420647572696e672073687566666c6560501b6060820152a28183611122565b6002810361135d5750815f52600560205260405f205f5b815460ff8216101561133557806002600361126b6112789486614f5b565b5001541661127d576151cb565b61124d565b6020600361128b8386614f5b565b50015416156001600361129e8487614f5b565b5001541615811561132d575b50156151cb576112ce6112bd8285614f5b565b50546001600160a01b031686616521565b845f516020616bc55f395f51905f5260806112e98487614f5b565b5054604080516001600160a01b0390921682526020820181905260159082015274151a5b595bdd5d08191d5c9a5b99c81c995d99585b605a1b6060820152a26151cb565b9050866112aa565b505054600260189190911c60ff1610611351576108439061606c565b6108439061082c615759565b6004810361137057505061084390615a9e565b60058103611383575050610843906160fb565b600314611392575b50506105b8565b805460ff60ff60801b01191660041781556113b59063ffffffff610fe142615272565b5f516020616b655f395f51905f525f80a2808061138b565b63489e8c8960e01b5f5260045ffd5b9050421115846110a9565b34610699576113f5366150e5565b915f52600a60205260405f209060018060a01b03165f5260205260405f209060018060a01b03165f5260205261144461143060405f20615021565b6040519182916020835260208301906150c1565b0390f35b34610699575f366003190112610699576003546040516001600160a01b039091168152602090f35b34610699576040366003190112610699576114a660043561148f614f19565b906114a161149c8261522e565b615f22565b615fe8565b005b34610699576040366003190112610699576114c1614f19565b6004355f908152600b602090815260408083206001600160a01b039485168452825291829020549151919092168152f35b34610699576020366003190112610699576004355f52601260205260405f2080549061151d82615240565b9161152b6040519384614ffe565b8083526020830180925f5260205f205f915b8383106115d557848660405191829160208301906020845251809152604083019060408160051b85010192915f905b82821061157b57505050500390f35b919360019193955060208091603f1989820301855287519060406115a883516060845260608401906150c1565b9263ffffffff85820151168584015281878060a01b0391015116910152960192019201859493919261156c565b600260206001926040516115e881614fe3565b6115f186615021565b81528486015463ffffffff811684830152858060a01b0390841c16604082015281520192019201919061153d565b346106995761162d36614f45565b611635615875565b61163e82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761166f9083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c1615158061180f575b610669576116a16159d5565b6116aa82615893565b90825f526004602052600260405f20019160ff835416600781101561065557600503610646576116da8185615999565b611800576117e87f3cf64897479c2ba314a5a0e8cf3a0e097d9367de65da54961e4dc414836499009360405161170f81614fe3565b84815260208101905f82526117656001604083019263ffffffff421684528a5f52600d60205260405f20828060a01b0389165f5260205260405f20905181550192511515839060ff801983541691151516179055565b5164ffffffff0082549160081b169064ffffffff001916179055855f52600760205260405f2060018060a01b0384165f5260205260036117b760ff60405f205416885f52600560205260405f20614f5b565b500163ffffffff600881835416171663ffffffff198254161790556117e260ff825460881c166151cb565b906156b9565b6117f760405192839283615257565b0390a260015f55005b6317fd8aab60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211611695565b346106995761183e36614f45565b611846615875565b61184f82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576118809083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580611a03575b610669576118b26159d5565b6118bb82615893565b90825f526004602052600260405f20019160ff83541660078110156106555760020361064657835f52601160205260405f2060018060a01b0382165f5260205260405f20546119f45761190e818561595e565b6119e55760205f516020616c055f395f51905f5291855f516020616b255f395f51905f526119628296835f526011865260405f2060018060a01b0386165f5286528060405f20556040519182918683615257565b0390a261196f8185615a47565b61198861198260ff875460781c166151cb565b866152a4565b6040516001600160a01b039091168152a25460ff808260181c169160781c16146119b25760015f55005b6119bb8161606c565b7f54ccd98022ba3fd547cb241a4f3dfc13e7f9bb54550b7babf4080021c6c2f1265f80a2806105b8565b63a89ac15160e01b5f5260045ffd5b630890382360e21b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c1642116118a6565b34610699576060366003190112610699576004356024356001600160401b03811161069957611a5790369060040161517f565b6044356001600160401b03811161069957611a7690369060040161517f565b9092611a80615875565b611a8985615893565b855f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957611aba9086615919565b1561060a57845f52600460205263ffffffff600260405f20015460581c16151580611dc8575b61066957611aec6159d5565b611af585615893565b93855f526004602052600260405f200160ff81541660078110156106555760020361064657838503611db95760328511610d9957865f52600760205260405f2060018060a01b0387165f5260205260206003611b6260ff60405f2054168a5f526005845260405f20614f5b565b50015416611daa5793946001600160a01b0316935f5b8787821015611cda57506001600160a01b03600582901b85810135918216929183900361069957895f52600660205260405f20835f5260205260ff60405f2054161561061957878314611ccb5786821015611cb757611bd990850185615727565b9190928a5f52600a60205260405f20895f5260205260405f20905f5260205260405f2060018060401b038311610cd95782611c1f8c94611c198454614f74565b8461534a565b5f601f8211600114611c4d579080611c4292600196975f92610c6457505061538d565b90555b019050611b78565b94601f19821695835f5260205f20965f5b818110611c9c57509160019697918488959410611c83575b505050811b019055611c45565b01355f19600384901b60f8161c191690558d8080611c76565b8284013589556001909801978f975060209283019201611c5e565b634e487b7160e01b5f52603260045260245ffd5b637f043f9b60e01b5f5260045ffd5b82817f9204f1001d8059e799b3a233fa5114eab3b5d30762de3ff4e07fcd7e6266aad160208a835f526007825260405f20815f5282526003611d2d60ff60405f205416865f526005855260405f20614f5b565b500163ffffffff8381835416171663ffffffff19825416179055611d60611d5a60ff875460981c166151cb565b866156d6565b604051908152a25460ff808260181c169160981c1614611d805760015f55005b7ff6b9b3035e320bcce495d00c2d31a7bd341754f7b9919a4a736388e16ef674a55f80a2806105b8565b6387db46a560e01b5f5260045ffd5b634ec4810560e11b5f5260045ffd5b50845f52600460205263ffffffff600260405f20015460581c164211611ae0565b34610699576020366003190112610699576001600160a01b03611e0a614f2f565b165f526017602052608060405f2060ff60018254920154166040519160018060a01b038116835263ffffffff8160a01c16602084015260c01c604083015215156060820152f35b34610699576040366003190112610699576004356024356001600160401b03811161069957611e84903690600401615145565b611e8f929192615875565b611e9882615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957611ec99083615919565b1561060a57611ed66159d5565b611edf82615893565b92825f52600460205260ff600260405f2001541660078110156106555760050361064657825f52601160205260405f2060018060a01b0385165f5260205260405f205415610637576104008211610d9957611f3a84846159f0565b825f52601260205260405f209060405194611f5486614fe3565b611f5f3685846152fe565b86524263ffffffff16602087019081526001600160a01b0390911660408701818152845491949091600160401b811015610cd957611fa29160018201815561512c565b9790976120f2575180519097906001600160401b038111610cd957611fcb81611c198454614f74565b6020601f82116001146120725760016117f79695949361200a8463ffffffff9586955f516020616b055f395f51905f529e9f5f9261206757505061538d565b81555b9451940180549351600160201b600160c01b03199290951692909216166001600160c01b031990921691909117602092831b600160201b600160c01b031617905560408051948552908401819052929384938401916152c1565b015190508f80610c4b565b601f19821699835f52815f209a5f5b8181106120da5750936001845f516020616b055f395f51905f529c9d63ffffffff9695839588976117f79d9c9b9a106120c2575b505050811b01815561200d565b01515f1960f88460031b161c191690558e80806120b5565b838301518d556001909c019b60209384019301612081565b634e487b7160e01b5f525f60045260245ffd5b34610699575f36600319011261069957602060405160328152f35b34610699576060366003190112610699576004356024356005811015610699576044356001600160401b0381116106995761215f903690600401615145565b61216a929192615875565b61217384615893565b845f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576121a49085615919565b1561060a576121b16159d5565b6121ba84615893565b92845f52601060205260405f2060018060a01b0385165f5260205260ff60405f2054166005811015610655576123ed57845f52601160205260405f2060018060a01b0385165f5260205260405f20541561063757604082116123de576122426104b791604051928391602083019561223287896151af565b60408085015260608401916152c1565b519020835f52601160205260405f2060018060a01b0384165f5260205260405f2054036123cf57825f52601060205260405f2060018060a01b0383165f5260205260405f2060ff1981541660ff8316179055827f9b013793e3fbc06d6ff5e9b6ce06be7c635e957579a85ae6b262b85b13ecd874604051806122c5858783615707565b0390a2825f52600760205260405f2060018060a01b0383165f526020526080600361230260ff60405f205416865f52600560205260405f20614f5b565b500154161515806123c4575b6123185760015f55005b81837f7f1edd8653eda945bad547f4f89adfa659b5f748dc9d88a447ff44550d7210be61236660a0946123595f516020616b855f395f51905f529785616521565b6040519182918683615707565b0390a260405190600180841b0316815260406020820152602860408201527f55736564206d616669612066756e6374696f6e732077697468206e6f6e2d6d6160608201526766696120726f6c6560c01b6080820152a28080806105b8565b50600181141561230e565b63134fed2d60e01b5f5260045ffd5b63bf1ad44360e01b5f5260045ffd5b63fd8fd76760e01b5f5260045ffd5b3461069957604036600319011261069957612415614f19565b6004355f52601360205260405f209060018060a01b03165f52602052606060405f2060ff6001825492015460405192835260018060a01b038116602084015260a01c1615156040820152f35b34610699575f3660031901126106995760206040515f8152f35b346106995761248936614f45565b905f52600960205260405f2080548210156106995761144491611430915f5260205f2001615021565b34610699576020366003190112610699576124cb614f2f565b6124d3615ec6565b600380546001600160a01b0319166001600160a01b0392909216919091179055005b3461069957602036600319011261069957335f90815260186020526040902054600435906001600160a01b03161561282457335f908152601860205260409020546001600160a01b03165b815f52600560205260405f20905f5f908354915b8260ff821610612787575060ff169161256c83615240565b9361257a6040519586614ffe565b83855261258684615240565b602086019690601f190136883761259c85615240565b946125aa6040519687614ffe565b8086526125b9601f1991615240565b015f5b8181106127745750505f915f5b8560ff82161061267d57888888604051928392604084019060408552518091526060840191905f5b81811061265b575050508281036020840152815180825260208201916020808360051b8301019401925f915b83831061262a5786860387f35b919395509193602080612649600193601f1986820301875289516150c1565b9701930193019092869594929361261d565b82516001600160a01b03168452869550602093840193909201916001016125f1565b8761268c82849b999a9b614f5b565b50546001600160a01b0390811690871681141580612735575b6126be575b50506126b5906151cb565b979695976125c9565b9461272561272b92876126b595986126da60ff861680946156f3565b52875f52600a60205260405f209060018060a01b03165f5260205260405f2060018060a01b038a165f526020528b61271e8261271860405f20615021565b926156f3565b528b6156f3565b506151cb565b939050888a6126aa565b505f858152600a602090815260408083206001600160a01b038581168552908352818420908b16845290915290205461276d90614f74565b15156126a5565b60606020828901810191909152016125bc565b6127948186979597614f5b565b50546001600160a01b0387811691161415806127d6575b6127c1575b6127b9906151cb565b949294612554565b906127ce6127b9916151cb565b9190506127b0565b50835f52600a60205260405f206127ed8287614f5b565b50546001600160a01b039081165f90815260209283526040808220928a1682529190925290205461281d90614f74565b15156127ab565b33612540565b3461069957604036600319011261069957612843614f19565b6004355f52600260205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b34610699576020366003190112610699576060600435805f52601460205260ff60405f20541690805f52601560205260ff60405f205416905f52601660205260018060a01b0360405f2054169060405192835260208301526040820152f35b34610699576040366003190112610699576128eb614f19565b6004355f52601160205260405f209060018060a01b03165f52602052602060405f2054604051908152f35b34610699575f3660031901126106995761292e615ec6565b6129366159d5565b600160ff19815416176001557f62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a2586020604051338152a1337f7c83004a7e59a8ea03b200186c4dda29a4e144d9844d63dbc1a09acf7dfcd4855f80a2005b34610699576040366003190112610699576129ac614f19565b6004355f52600760205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b34610699576020366003190112610699576004355f526014602052602060ff60405f205416604051908152f35b60a0366003190112610699576004356001600160401b03811161069957612a32903690600401615145565b906024359160ff83168303610699576044356001600160401b03811161069957612a60903690600401615145565b9093906064356001600160401b03811161069957612a82903690600401615145565b9560843594919390916001600160a01b038616860361069957612aa3615875565b612aab6159d5565b600460ff8316108015612f68575b612f595760208111612f4a57601a54965f198814612f365760018801601a5560405191612ae583614fc7565b6001600160401b0389168352336020840190815293612b053683856152fe565b604085019081525f606086015260ff821660808601525f60a08601525f60c08601525f60e08601525f61010086015263ffffffff42166101208601525f6101408601525f6101608601525f6101808601525f6101a08601525f6101c08601525f6101e08601528a5f52600460205260405f209560018060401b03865116875491600160401b600160e01b03905160401b169163ffffffff60e01b16171786555180519060018060401b038211610cd957612bcf82612bc660018a0154614f74565b60018a0161534a565b602090601f8311600114612ec957612bf092915f9183612ebe57505061538d565b60018601555b60608401519360078510156106555760028087018054608084015161ffff1990911660ff9889161760089190911b61ff001617815560a08301518d987fd9abe6195309293e802058345712163744c28bde8471531f9990f08419585bcf98612d2b9591949390926101e09291612c6e9185169061557d565b612c808360c083015116858701615595565b612c9461ffff60e08301511685870161565a565b612ca78361010083015116858701615679565b612cbe63ffffffff61012083015116858701615696565b612cd563ffffffff61014083015116858701615281565b612ce883610160830151168587016152a4565b612cfb83610180830151168587016151dc565b612d0e836101a0830151168587016156b9565b612d21836101c0830151168587016152e1565b01511691016156d6565b60ff612d4a6040519485943386526060602087015260608601916152c1565b911660408301520390a260808211612eaf576104008611612ea057612e598594612dc56020985f516020616b455f395f51905f5296885f5260058b52612db460405f209160405193612d9b85614fac565b338552612da9368b8b6152fe565b8e86015236916152fe565b60408301526002606083015261539f565b5f86815260068952604080822033808452908b52818320805460ff1990811660011790915589845260078c52828420918452908b52818320805490911690558782526004808b528183206002908101805462ff0000191662010000179055898452908b52912001805463ff000000191663010000001790556001600160a01b038116612e68575b6040519384933385615623565b0390a260015f55604051908152f35b612e73868233616364565b3415612e4c57612e9b5f808080346001600160a01b0387165af1612e956155af565b506155de565b612e4c565b63450bc0a760e01b5f5260045ffd5b636f6003c360e01b5f5260045ffd5b015190508e80610c4b565b9190600188015f52805f20905f935b601f1984168510612f1b576001945083601f19811610612f03575b505050811b016001860155612bf6565b01515f1960f88460031b161c191690558d8080612ef3565b81810151835560209485019460019093019290910190612ed8565b634e487b7160e01b5f52601160045260245ffd5b630b279b2f60e41b5f5260045ffd5b6319413ccd60e11b5f5260045ffd5b50601460ff831611612ab9565b34610699575f36600319011261069957602060405161012c8152f35b34610699575f3660031901126106995760206040515f516020616be55f395f51905f528152f35b6080366003190112610699576004356024356001600160401b03811161069957612fe6903690600401615145565b6044356001600160401b03811161069957613005903690600401615145565b92906064356001600160a01b03811680820361069957613023615875565b61302b6159d5565b865f526004602052600260405f200195865460ff81166007811015610655576106465760ff808260081c169160101c1610156131b8575f88815260066020908152604080832033845290915290205460ff166131aa5760808611612eaf576104008111612ea0575f516020616b455f395f51905f5296886130f58861316b94612db46117f799855f52600560205260ff60405f205416955f52600560205260405f20926130e98d604051966130df88614fac565b33885236916152fe565b602086015236916152fe565b5f8a815260066020908152604080832033808552908352818420805460ff199081166001179091558e8552600784528285209185529252909120805490911660ff92831617905581546131559161314f9160101c166151cb565b8261557d565b61316560ff825460181c166151cb565b90615595565b8061317f575b506040519384933385615623565b61318a878333616364565b3415613171575f8080806131a49434905af1612e956155af565b86613171565b621d934160e11b5f5260045ffd5b63bc42480360e01b5f5260045ffd5b34610699576020366003190112610699576004355f526016602052602060018060a01b0360405f205416604051908152f35b34610699576020366003190112610699575f6101e060405161321a81614fc7565b828152826020820152606060408201528260608201528260808201528260a08201528260c08201528260e08201528261010082015282610120820152826101408201528261016082015282610180820152826101a0820152826101c082015201526004355f52600460205260405f2060026040519161329883614fc7565b80546001600160401b038116845260401c6001600160a01b031660208401526132c360018201615021565b6040840152015460ff81169060078210156106555760ff916060840152818160081c166080840152818160101c1660a0840152818160181c1660c084015261ffff8160201c1660e0840152818160301c1661010084015263ffffffff8160381c1661012084015263ffffffff8160581c16610140840152818160781c16610160840152818160801c16610180840152818160881c166101a0840152818160901c166101c084015260981c166101e082015260405180916020825260018060401b03815116602083015260018060a01b03602082015116604083015260ff6101e06133be604084015161020060608701526102208601906150c1565b926133d16060820151608087019061511f565b8260808201511660a08601528260a08201511660c08601528260c08201511660e086015261ffff60e082015116610100860152826101008201511661012086015263ffffffff6101208201511661014086015263ffffffff61014082015116610160860152826101608201511661018086015282610180820151166101a0860152826101a0820151166101c0860152826101c082015116828601520151166102008301520390f35b34610699576020366003190112610699576004355f526015602052602060ff60405f205416604051908152f35b34610699576040366003190112610699576134bf614f19565b6004355f52600e60205260405f209060018060a01b03165f52602052602060ff60405f205416610f0d6040518092615172565b346106995760403660031901126106995761350b614f19565b6004355f52600660205260405f209060018060a01b03165f52602052602060ff60405f2054166040519015158152f35b34610699576080366003190112610699576004356024356004811015610699576044356001600160a01b038116808203610699576064356001600160401b0381116106995761358e903690600401615145565b613599929192615875565b6135a286615893565b865f52600660205260405f2060018060a01b0382165f5260205260ff60405f20541615610619576135d39087615919565b1561060a57855f52600460205263ffffffff600260405f20015460581c161515806138ad575b610669576136056159d5565b61360e86615893565b92865f526004602052600260405f20019460ff86541660078110156106555760050361064657875f52600760205260405f2060018060a01b0386165f526020526010600361366e60ff60405f2054168b5f52600560205260405f20614f5b565b500154166119e5576001871461389f576136888589615999565b156138905786151580613887575b613853575b506136ce6104b79160405192839160208301956136b8878c615172565b87604085015260608085015260808401916152c1565b519020855f52600d60205260405f2060018060a01b0384165f5260205260405f205403610da8575f858152600d602090815260408083206001600160a01b0386168085529083528184206001908101805460ff199081169092179055898552600e84528285208286528452828520805460ff8b811691909316179055898552600f8452828520828652845282852080546001600160a01b03191687179055898552600784528285209185529083528184205489855260059093529220919587947fefeac4ab688c036b72571c6adaf81feb0d4e0a7099c1cfd8d09e54370198c53c94606094919390926138199290916003916137cc918c1690614f5b565b500163ffffffff601081835416171663ffffffff198254161790556137ff6137f98a8a5460901c166151cb565b896152e1565b6040516001600160a01b0390941684526020840190615172565b6040820152a254818160881c1691829160901c16149081613849575b506138405760015f55005b610bef906160fb565b9050151582613835565b875f52600660205260405f20845f5260205260ff60405f205416156106195761387c9088615919565b1561060a578761369b565b50831515613696565b63205e472d60e21b5f5260045ffd5b6282b42960e81b5f5260045ffd5b50855f52600460205263ffffffff600260405f20015460581c1642116135f9565b34610699576040366003190112610699576138e7614f19565b6004355f52600c60205260405f209060018060a01b03165f52602052602060ff60405f205416604051908152f35b34610699575f36600319011261069957602060405160788152f35b346106995760403660031901126106995760e06003613986600435613953614f19565b815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b50015460806040519160028116151583526001811615156020840152600481161515604084015260088116151560608401526010811615158284015260208116151560a084015216151560c0820152f35b34610699575f36600319011261069957602060ff600154166040519015158152f35b3461069957604036600319011261069957613a12614f19565b6004355f52600860205260405f209060018060a01b03165f526020526040805f2060ff6002825492015416825191825215156020820152f35b3461069957602036600319011261069957600435613a67615875565b613a7081615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957613aa19082615919565b1561060a57805f52600460205263ffffffff600260405f20015460581c16151580613b2b575b61066957613ad36159d5565b613adc81615893565b815f526004602052600260405f20019060ff82541660078110156106555760020361064657613b0b818461595e565b6119e5575f516020616c055f395f51905f5260208261196f869485615a47565b50805f52600460205263ffffffff600260405f20015460581c164211613ac7565b34610699576020366003190112610699576001600160a01b03613b6d614f2f565b165f526018602052602060018060a01b0360405f205416604051908152f35b34610699575f36600319011261069957335f52601760205260405f20600181019060ff825416613bb857005b80546001600160a01b031680337f744157ccffbd293a2e8644928cd7d23d650f869b88f72d7bfea8041b76ca6bec5f80a35f90815260186020908152604080832080546001600160a01b031916905592546001600160a01b031682526019905220805460ff199081169091558154169055005b34610699575f36600319011261069957613c43615ec6565b5f80808047818115613c65575b3390f115613c5a57005b6040513d5f823e3d90fd5b506108fc613c50565b34610699576020366003190112610699576004355f52600560205260405f20805490613c9982615240565b91613ca76040519384614ffe565b8083526020830180925f5260205f205f915b838310613d6557848660405191829160208301906020845251809152604083019060408160051b85010192915f905b828210613cf757505050500390f35b919360019193955060208091603f19898203018552875190848060a01b038251168152606063ffffffff81613d4e613d3c8787015160808988015260808701906150c1565b604087015186820360408801526150c1565b940151169101529601920192018594939192613ce8565b60046020600192604051613d7881614fac565b848060a01b038654168152613d8e858701615021565b83820152613d9e60028701615021565b604082015263ffffffff6003870154166060820152815201920192019190613cb9565b3461069957613dcf36614f45565b613dd7615875565b613de082615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957613e119083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580613f9e575b61066957613e436159d5565b613e4c82615893565b90825f526004602052600260405f20015460ff811660078110156106555760010361064657613e8e90845f52600560205260ff60405f209160301c1690614f5b565b50546001600160a01b0390811690831603613f8f57825f52600760205260405f2060018060a01b0383165f5260205260406003613edb60ff835f205416865f526005602052835f20614f5b565b50015416611800575f8381526008602090815260408083206001600160a01b038616808552908352818420858155600201805460ff191690558684526007835281842090845282528083205486845260059092529091207ffbabe9c4a6257c269f37e649a08003e579b119fcff47ac57e59d1502fccea41c9391600391613f659160ff1690614f5b565b500163ffffffff604081835416171663ffffffff198254161790556117f760405192839283615257565b631cc191eb60e31b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211613e37565b3461069957613fcd36614f45565b613fd5615875565b613fde82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761400f9083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580614143575b610669576140416159d5565b61404a82615893565b90825f52600460205260ff600260405f2001541660078110156106555760050361064657825f52601160205260405f2060018060a01b0383165f5260205260405f20541561063757825f52601360205260405f2060018060a01b0383165f5260205260405f205461413457816140e17ff5adb2642a216ea3114d73daac494b2341695b10db2b0e6be988acb22fbc156493856159f0565b835f52601360205260405f2060018060a01b0382165f526020528160405f2055835f52601460205260405f2060ff61411b818354166151cb565b1660ff198254161790556117f760405192839283615257565b6317ac735560e11b5f5260045ffd5b50815f52600460205263ffffffff600260405f20015460581c164211614035565b34610699575f3660031901126106995761417c615ec6565b60015460ff8116156141e05760ff19166001557f5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa6020604051338152a1337f306ca22c455fe433ebbf0542bbf947ea6a725495f9e1043db2a47e3c579403855f80a2005b638dfc202b60e01b5f5260045ffd5b34610699576020366003190112610699576001600160a01b03614210614f2f565b165f526019602052602060ff60405f2054166040519015158152f35b34610699575f3660031901126106995760206040516138408152f35b3461069957602036600319011261069957600435614264615875565b61426d81615893565b815f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761429e9082615919565b1561060a576142ab6159d5565b805f526004602052600260405f200160ff81541660078110156106555760030361064657805460ff60ff60801b01191660041781556142f29063ffffffff610fe142615272565b805f52600560205260405f205f5b815460ff821610156143c7578061431a6143939284614f5b565b50546001600160a01b031660036143318386614f5b565b5001805463fffffffb811663ffffffff199091161790555f858152600b602090815260408083206001600160a01b0385168452909152902080546001600160a01b0319169055600260036143858487614f5b565b5001541661439857506151cb565b614300565b5f858152600c602090815260408083206001600160a01b03909416835292905220805460ff1916905584612725565b825f516020616b655f395f51905f525f80a260015f55005b34610699576143ed36614f45565b6143f5615875565b6143fe82615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f205416156106195761442f9083615919565b1561060a5761443c6159d5565b61444582615893565b90825f52600460205260ff600260405f2001541660078110156106555760020361064657825f52601160205260405f2060018060a01b0383165f5260205260405f20546119f4575f516020616b255f395f51905f5291835f52601160205260405f2060018060a01b0382165f526020528160405f20556117f760405192839283615257565b34610699576040366003190112610699576144e3614f19565b336001600160a01b038216036144ff576114a690600435615fe8565b63334bd91960e11b5f5260045ffd5b346106995761451c36614f45565b905f52601260205260405f208054821015610699576145619161453e9161512c565b50600161454a82615021565b9101546040519283926060845260608401906150c1565b9063ffffffff8116602084015260018060a01b039060201c1660408301520390f35b34610699576040366003190112610699576114a66004356145a2614f19565b906145af61149c8261522e565b615f5c565b34610699576020366003190112610699576004355f52600960205260405f208054906145df82615240565b916145ed6040519384614ffe565b8083526020830180925f5260205f205f915b83831061466c57848660405191829160208301906020845251809152604083019060408160051b85010192915f905b82821061463d57505050500390f35b9193600191939550602061465c8192603f198a820301865288516150c1565b960192019201859493919261462e565b60016020819261467b85615021565b8152019201920191906145ff565b346106995760203660031901126106995760206146a760043561522e565b604051908152f35b34610699576101a03660031901126106995760043536606411610699573660e41161069957366101241161069957366101a411610699576146ee615875565b6146f66159d5565b805f52600460205260ff600260405f200154166007811015610655578015908115614999575b50610646576003546001600160a01b031680156149615760408051635fe8c13b60e01b81529190602460048401378160645f604483015b600282106149475750505061018481602093604060e460c484013760806101246101048401375afa908115613c5a575f9161490c575b50156148d45780610144350361489d5760016101243503614862576101643561482957600261018435106147ea576105b890604051906147ca604083614ffe565b600e82526d546f776e2077696e7320285a4b2960901b6020830152615e61565b60405162461bcd60e51b81526020600482015260176024820152764e6f7420656e6f75676820746f776e20706c617965727360481b6044820152606490fd5b60405162461bcd60e51b81526020600482015260116024820152704d61666961207374696c6c20616c69766560781b6044820152606490fd5b60405162461bcd60e51b81526020600482015260136024820152721692c818dbdb991a5d1a5bdb8819985a5b1959606a1b6044820152606490fd5b60405162461bcd60e51b815260206004820152600f60248201526e0a4dededa92c840dad2e6dac2e8c6d608b1b6044820152606490fd5b60405162461bcd60e51b815260206004820152601060248201526f24b73b30b634b2102d2590383937b7b360811b6044820152606490fd5b90506020813d60201161493f575b8161492760209383614ffe565b81010312610699575180151581036106995782614789565b3d915061491a565b829350604081816001949581943701930191018492614753565b60405162461bcd60e51b815260206004820152601060248201526f15995c9a599a595c881b9bdd081cd95d60821b6044820152606490fd5b60069150148261471c565b34610699576020366003190112610699576004355f52600460205260405f20805460026149d360018401615021565b920154604080516001600160401b038416815292811c6001600160a01b031660208401526102009083018190529192839260ff91614a13918501906150c1565b91614a236060850183831661511f565b818160081c166080850152818160101c1660a0850152818160181c1660c085015261ffff8160201c1660e0850152818160301c1661010085015263ffffffff8160381c1661012085015263ffffffff8160581c16610140850152818160781c16610160850152818160801c16610180850152818160881c166101a0850152818160901c166101c085015260981c166101e08301520390f35b34610699576020366003190112610699576004355f526004602052602063ffffffff600260405f20015460581c16604051908152f35b3461069957614aff36614f45565b905f52600560205260405f2090815481101561069957614b1e91614f5b565b5080546001600160a01b0316614b3660018301615021565b91614b7c63ffffffff6003614b4d60028501615021565b9301541691614b6e60405195869586526080602087015260808601906150c1565b9084820360408601526150c1565b9060608301520390f35b34610699575f366003190112610699576020601a54604051908152f35b3461069957604036600319011261069957600435614bbf614f19565b614bc7615875565b614bd082615893565b825f52600660205260405f2060018060a01b0382165f5260205260ff60405f2054161561061957614c019083615919565b1561060a57815f52600460205263ffffffff600260405f20015460581c16151580614ea5575b61066957614c336159d5565b614c3c82615893565b90825f526004602052600260405f20019160ff83541660078110156106555760040361064657835f52600660205260405f2060018060a01b0383165f5260205260ff60405f2054161561061957614c938285615919565b1561060a5783917fcfff1651bcea794952a516ce970ab17518a85210bd939aaeaac670a8d3e65ec791835f52600760205260405f2060018060a01b0382165f5260205260046003614cf660ff60405f205416875f52600560205260405f20614f5b565b5001545f868152600b602090815260408083206001600160a01b0387811685529252909120549290911615911680151580614e7b575b614e3f575b505f858152600b602090815260408083206001600160a01b03868116855290835281842080546001600160a01b0319169188169182179055888452600c83528184209084529091529020805460ff90614d8b9082166151cb565b1660ff19825416179055614dce575b614da9604051928392836151f9565b0390a25460ff808260181c169160801c1614614dc55760015f55005b610bef90615a9e565b835f52600760205260405f2060018060a01b0382165f526020526003614e0660ff60405f205416865f52600560205260405f20614f5b565b500163ffffffff600481835416171663ffffffff19825416179055614e3a614e3460ff875460801c166151cb565b866151dc565b614d9a565b855f52600c60205260405f209060018060a01b03165f5260205260405f2060ff614e6b818354166151bc565b1660ff1982541617905587614d31565b50855f52600c60205260405f2060018060a01b0382165f5260205260ff60405f2054161515614d2c565b50815f52600460205263ffffffff600260405f20015460581c164211614c27565b34610699576020366003190112610699576004359063ffffffff60e01b821680920361069957602091637965db0b60e01b8114908115614f08575b5015158152f35b6301ffc9a760e01b14905083614f01565b602435906001600160a01b038216820361069957565b600435906001600160a01b038216820361069957565b6040906003190112610699576004359060243590565b8054821015611cb7575f5260205f209060021b01905f90565b90600182811c92168015614fa2575b6020831014614f8e57565b634e487b7160e01b5f52602260045260245ffd5b91607f1691614f83565b608081019081106001600160401b03821117610cd957604052565b61020081019081106001600160401b03821117610cd957604052565b606081019081106001600160401b03821117610cd957604052565b601f909101601f19168101906001600160401b03821190821017610cd957604052565b9060405191825f82549261503484614f74565b808452936001811690811561509f575060011461505b575b5061505992500383614ffe565b565b90505f9291925260205f20905f915b818310615083575050906020615059928201015f61504c565b602091935080600191548385890101520191019091849261506a565b90506020925061505994915060ff191682840152151560051b8201015f61504c565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b606090600319011261069957600435906024356001600160a01b038116810361069957906044356001600160a01b03811681036106995790565b9060078210156106555752565b8054821015611cb7575f5260205f209060011b01905f90565b9181601f84011215610699578235916001600160401b038311610699576020838186019501011161069957565b9060048210156106555752565b9181601f84011215610699578235916001600160401b038311610699576020808501948460051b01011161069957565b9060058210156106555752565b60ff168015612f36575f190190565b60ff1660ff8114612f365760010190565b805460ff60801b191660809290921b60ff60801b16919091179055565b6001600160a01b0391821681529116602082015260400190565b6001600160401b038111610cd957601f01601f191660200190565b5f526002602052600160405f20015490565b6001600160401b038111610cd95760051b60200190565b6001600160a01b039091168152602081019190915260400190565b9061012c8201809211612f3657565b805463ffffffff60581b191660589290921b63ffffffff60581b16919091179055565b805460ff60781b191660789290921b60ff60781b16919091179055565b908060209392818452848401375f828201840152601f01601f1916010190565b805460ff60901b191660909290921b60ff60901b16919091179055565b92919261530a82615213565b916153186040519384614ffe565b829481845281830111610699578281602093845f960137010152565b81811061533f575050565b5f8155600101615334565b9190601f811161535957505050565b615059925f5260205f20906020601f840160051c83019310615383575b601f0160051c0190615334565b9091508190615376565b8160011b915f199060031b1c19161790565b8054600160401b811015610cd9576153bc91600182018155614f5b565b9190916120f257805182546001600160a01b0319166001600160a01b03919091161782556020810151805160018401916001600160401b038211610cd95761540e826154088554614f74565b8561534a565b602090601f831160011461551a5761542f92915f91836154a157505061538d565b90555b6040810151805160028401916001600160401b038211610cd95761545a826154088554614f74565b602090601f83116001146154ac57936003936154898463ffffffff979560609589975f926154a157505061538d565b90555b0151169201911663ffffffff19825416179055565b015190505f80610c4b565b90601f19831691845f52815f20925f5b81811061550257508460609463ffffffff9894600398948a98600195106154eb575b505050811b01905561548c565b01515f19838a1b60f8161c191690555f80806154de565b929360206001819287860151815501950193016154bc565b90601f19831691845f52815f20925f5b818110615565575090846001959493921061554d575b505050811b019055615432565b01515f1960f88460031b161c191690555f8080615540565b9293602060018192878601518155019501930161552a565b9062ff000082549160101b169062ff00001916179055565b9063ff00000082549160181b169063ff0000001916179055565b3d156155d9573d906155c082615213565b916155ce6040519384614ffe565b82523d5f602084013e565b606090565b156155e557565b60405162461bcd60e51b81526020600482015260166024820152752330b4b632b2103a3790333ab7321039b2b9b9b4b7b760511b6044820152606490fd5b929160409261564a9296959660018060a01b031685526060602086015260608501916152c1565b6001600160a01b03909416910152565b805461ffff60201b191660209290921b61ffff60201b16919091179055565b805460ff60301b191660309290921b60ff60301b16919091179055565b805463ffffffff60381b191660389290921b63ffffffff60381b16919091179055565b805460ff60881b191660889290921b60ff60881b16919091179055565b805460ff60981b191660989290921b60ff60981b16919091179055565b8051821015611cb75760209160051b010190565b6001600160a01b03909116815260408101929161505991602001906151af565b903590601e198136030182121561069957018035906001600160401b0382116106995760200191813603831361069957565b60405190615768604083614ffe565b6019825278546f6f2066657720706c61796572732072656d61696e696e6760381b6020830152565b90602083828152019060208160051b85010193835f915b8383106157b75750505050505090565b909192939495601f198282030186528635601e1984360301811215610699578301602081019190356001600160401b0381116106995780360383136106995761580660209283926001956152c1565b9801960194930191906157a7565b60ff60019116019060ff8211612f3657565b60405190615835604083614ffe565b6009825268546f776e2077696e7360b81b6020830152565b6040519061585c604083614ffe565b600a8252694d616669612077696e7360b01b6020830152565b60025f54146158845760025f55565b633ee5aeb560e01b5f5260045ffd5b335f908152601860205260409020546001600160a01b031690816158b75750503390565b815f52601760205260405f2060ff6001820154161561590a575463ffffffff8160a01c1642116158fb5760c01c036158ec5790565b637ce3c8fd60e11b5f5260045ffd5b630fe82d2560e11b5f5260045ffd5b635f8874dd60e11b5f5260045ffd5b615955600391600293815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b50015416151590565b615955600391600193815f52600760205260405f2090858060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b615955600391600893815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b60ff600154166159e157565b63d93c066560e01b5f5260045ffd5b615a2a90600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b5001805463ffffffff19811663ffffffff91909116176080179055565b615a8190600392815f52600760205260405f209060018060a01b03165f5260205260ff60405f205416905f52600560205260405f20614f5b565b5001805463ffffffff19811663ffffffff91909116176001179055565b90815f5260046020528160405f205f905f90835f52600560205260405f205f908054915b8260ff821610615dd957505050607f600260ff92015460191c16911690811180615dc7575b15615da45781604091615b085f516020616ba55f395f51905f529486616521565b845f516020616b855f395f51905f52608085519460018060a01b03169485815286602082015260098782015268159bdd1959081bdd5d60ba1b6060820152a282519182526020820152a25b815f52600560205260405f20915f5b835460ff82161015615bf65780615b7c615bf19286614f5b565b50545f848152600b602090815260408083206001600160a01b0390941680845293825280832080546001600160a01b0319169055868352600c825280832093835292905220805460ff191690556003615bd58287614f5b565b5001805463fffffffb811663ffffffff199091161790556151cb565b615b62565b505f818152600460205260409020600201805460ff60801b19169055909150615c1e81616a39565b15615c265750565b5f818152600460205260409020600201805460ff61ffff60881b0119166005178155615c5a9063ffffffff610fe142615272565b805f52600560205260405f205f5b815460ff82161015615d3e5780615c82615d399284614f5b565b50546001600160a01b03166003615c998386614f5b565b5001805463ffffffe7811663ffffffff199091161790555f858152600d602090815260408083206001600160a01b03949094168084529382528083208381556001908101849055888452600e83528184208585528352818420805460ff19169055888452600f8352818420858552835281842080546001600160a01b031916905588845260138352818420948452939091528120818155909101556151cb565b615c68565b50505f818152601460209081526040808320805460ff1990811690915560158352818420805490911690556016909152812080546001600160a01b03191690557f34b0c4c95aa7776d35dbd8b24afd53388828c61c26fd5a6b11a21809662440879080a2565b50505f516020616ba55f395f51905f52604080515f81525f6020820152a2615b53565b506001600160a01b0382161515615ae7565b9091929394955060026003615dee8385614f5b565b50015416615e0c575b615e00906151cb565b90879594939291615ac2565b615e168183614f5b565b50545f898152600c602090815260408083206001600160a01b039094168084529390915290205460ff9081169087168111615e53575b5050615df7565b9096509450615e005f615e4c565b5f81815260046020908152604091829020600201805460ff63ffffffff60581b0119166006179055905181815291927fd778487128ba4386ebcfb2703af01f8a2a2b8663f880622d26a77a29397e68f392918291615ec1918301906150c1565b0390a2565b335f9081527fe5ebfa64fca8d502a8e50c1edffd2c31ef4dad5b396e65d9f397fb028f74abc5602052604090205460ff1615615efe57565b63e2517d3f60e01b5f52336004525f516020616be55f395f51905f5260245260445ffd5b5f81815260026020908152604080832033845290915290205460ff1615615f465750565b63e2517d3f60e01b5f523360045260245260445ffd5b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff16615fe2575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19166001179055339291907f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d9080a4600190565b50505f90565b5f8181526002602090815260408083206001600160a01b038616845290915290205460ff1615615fe2575f8181526002602090815260408083206001600160a01b0395909516808452949091528120805460ff19169055339291907ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9080a4600190565b805f526004602052600260405f2001600360ff1982541617815561ffff815460201c169061ffff8214612f365761ffff6020916160cd60017fa9b4e96158ed085745975f198fa026959997245ae7e7aed9cd0252ce02b2107195018261565a565b6160dd63ffffffff421682615696565b6160ee63ffffffff610b8842615272565b54821c16604051908152a2565b90815f5260166020528160018060a01b0360405f2054165f825f52600560205260405f205f908054905b8160ff8416106162d2575b505050827fb874a4c95be602274c8e6944d4d375ca4189eda377b69ee751f3b92dd4dcf2d8604051806161648587836151f9565b0390a281151590816162be575b5061626f575b505f52600560205260405f20915f5b835460ff8216101561623557806161a06162309286614f5b565b50545f848152600d602090815260408083206001600160a01b03909416808452938252808320838155600101839055868352600e82528083208484528252808320805460ff19169055868352600f82528083209383529290522080546001600160a01b031916905560036162148287614f5b565b5001805463ffffffe7811663ffffffff199091161790556151cb565b616186565b505f818152600460205260409020600201805461ffff60881b1916905590915061625e81616a39565b156162665750565b6150599061606c565b60808161628a5f516020616b855f395f51905f529385616521565b60405190815260406020820152600f60408201526e12da5b1b195908185d081b9a59da1d608a1b6060820152a2815f616177565b6001600160a01b031682141590505f616171565b909194506162e08582614f5b565b50545f888152600e602090815260408083206001600160a01b039094168084529390915290205460ff169590600487101561065557600289971461632f5750616328906151cb565b9190616125565b5f878152600f602090815260408083206001600160a01b03948516845290915281205490911694509250829150819050616130565b6001600160a01b0390911691908215611ccb57825f52601960205260ff60405f205416616512575f838152601860205260409020546001600160a01b0316616512576001600160a01b03165f8181526017602052604090206001015490919060ff166164cd575b6138404201804211612f36577f290e52799b1ac63207e28c21f7f1f387cf8ea9257dde8e363a02e157d8e4c6589163ffffffff60409216616491835161641081614fac565b8781526020808201848152600180881b5f19018716888501908152606085018281525f8c81526017909552938990209451925190516001600160c01b031960c09190911b166001600160a01b0390931663ffffffff60a01b60a09290921b919091161791909117835590519101805460ff191691151560ff16919091179055565b5f8681526018602090815284822080546001600160a01b031916881790556019815290849020805460ff191660011790558351928352820152a3565b5f828152601760209081526040808320546001600160a01b031683526018825280832080546001600160a01b031916905560199091529020805460ff191690556163cb565b631fef749360e21b5f5260045ffd5b9061652c8183615919565b156165a657815f52600760205260405f209060018060a01b03165f52602052600361656960ff60405f205416835f52600560205260405f20614f5b565b500163ffffffff63fffffffd8254161663ffffffff198254161790555f526004602052615059600260405f200161316560ff825460181c166151bc565b5050565b5f52600560205260405f205f8154905b8160ff8216106165cd575060ff91501690565b600260036165db8386614f5b565b500154166165f1576165ec906151cb565b6165ba565b91505090565b5f52600560205260405f20908154905b8160ff82161061661a575060ff91501690565b600260036166288386614f5b565b500154166165f157616639906151cb565b616607565b5f8181526004602052604090206002908101805460ff64ff000000ff60781b01191690911781556166779063ffffffff610fe142615272565b5f52600560205260405f20905f5b825460ff821610156166dd5780600260036166a36166b09487614f5b565b500154166166b5576151cb565b616685565b60036166c18286614f5b565b5001805463ffffff9e811663ffffffff199091161790556151cb565b509050565b5f818152600560205260408120805492915b8360ff8216106167075750505050600190565b600260036167158385614f5b565b5001541615158061673b575b6167335761672e906151cb565b6166f4565b505050505f90565b50825f52601060205260405f206167528284614f5b565b50546001600160a01b03165f908152602091909152604090205460ff1660058110156106555715616721565b905f5f92805f52600560205260405f205f918154925b8360ff8216106167d5575050505060ff16801592831591826167c7575b50836167bc57509190565b60ff91935016151590565b60ff8216111591505f6167b1565b600260036167e38386614f5b565b500154166167fa575b6167f5906151cb565b616794565b93815f52601060205260405f206168118685614f5b565b50546001600160a01b03165f908152602091909152604090205460ff1660058110156106555760018103616855575061684c6167f5916151cb565b945b90506167ec565b909490616866575b6167f59061684e565b956168736167f5916151cb565b96905061685d565b805f52601460205260ff60405f20541615616a36575f81815260056020526040812080546001918390815b8360ff821610616947575b505050505f516020616c255f395f51905f5291818060409390616935575b1561692e57815b5f868152601660205284902080546001600160a01b0319166001600160a01b0385161790558161691b575b5082516001600160a01b03909216825215156020820152a2565b6001600160a01b0316151590505f616901565b5f916168d6565b506001600160a01b03821615156168cf565b6169518183614f5b565b50545f8881526013602090815260408083206001600160a01b03949094168084529390915290206001015460a01c60ff1680616a1c575b61699c575b50616997906151cb565b6168a6565b5f8881526013602090815260408083206001600160a01b03948516845290915290206001015492969193921691806169de575050936169976001925b9061698d565b9095909290916001600160a01b038716036169fc57616997906169d8565b505050505060405f516020616c255f395f51905f52915f9181935f6168b1565b5060026003616a2b8486614f5b565b500154161515616988565b50565b805f52600460205260ff600260405f20015460181c166001811115616aa15750616a62816166e2565b616a6b57505f90565b616a748161677e565b9015616a8c5750616a879061082c61584d565b600190565b616a9557505f90565b616a879061082c615826565b616a879190616acf57604051616ab8604082614ffe565b60048152634472617760e01b602082015290615e61565b604051616add604082614ffe565b60148152734c61737420706c61796572207374616e64696e6760601b602082015290615e6156fea4a46989ff60ad96ec74df0f289e1e16b51c97fecb224f2e8e927103d5b54eaef33c1bd762b898b33040e70f49cf90ff496cf7366f6fafa9d961b0de89b7244b3b7d84e02e9f6642b42e0ca3e77297f9c7c807832a60c0fc1926ade76abc7badcf33babc496bb6dc2942b39cb7b75766bbbadf7da50d176ff8c513e991140239b1ed64d561b0179e61c72bf46d0809a99dac99baeb98fc9f5d13be1f6c2e3f826b571d1c11516ea63adff1048766bdfa510e9c5bf4e32ca29d4ba11e16edf2f18ef7613b6eacaa71c74d950e2c093c23a0d3ecb066d1387d80e95159d07ed08ba49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c2177582b52ddf0195aa8ac16480985f5042052aa742563721520fa34764d253824d43020f20553b51a906b0cb24d2431eb46bd2dc31b5c75d4ba8165ff1bb284ad2a1a2646970667358221220728f0db592457a0be5bb6b1787b786ac476bb510fbe81f39d36f3d1f0696163464736f6c634300081c0033",
  "linkReferences": {},
  "deployedLinkReferences": {},
  "immutableReferences": {},
  "inputSourceName": "project/contracts/MafiaPortal.sol",
  "buildInfoId": "solc-0_8_28-f49eeb12775bd390ed0059496ed138f50f1ad706"
} as const;
