
const crypto = require('crypto');

const errors = [
    "NotParticipant()",
    "NotYourTurn()",
    "WrongPhase()",
    "Unauthorized()",
    "RoomFull()",
    "AlreadyJoined()",
    "InvalidDeckSize()",
    "TimeNotExpired()",
    "PlayerInactive()",
    "NoStalledPlayers()",
    "InvalidReveal()",
    "AlreadyRevealed()",
    "AlreadyVoted()",
    "AlreadyCommitted()",
    "AlreadySharedKeys()",
    "SessionExpired()",
    "SessionNotForThisRoom()",
    "InvalidSessionKey()",
    "InvalidArrayLength()",
    "PhaseDeadlinePassed()",
    "SessionAlreadyRegistered()",
    "InvalidSessionAddress()",
    "ArrayTooLarge()",
    "NicknameTooLong()",
    "PublicKeyTooLong()",
    "RoleAlreadyCommitted()",
    "RoleAlreadyRevealed()",
    "InvalidRoleReveal()",
    "NotMafiaMember()",
    "MafiaTargetAlreadyCommitted()",
    "MafiaTargetAlreadyRevealed()",
    "InvalidMafiaTargetReveal()",
    "MafiaNotReady()",
    "NotEnoughPlayers()",
    "NotAllRolesRevealed()",
    "WinConditionNotMet()",
    "RoleNotCommitted()",
    "NotCommitted()",
    "InvalidPlayerCount()",
    "SaltTooLong()",
    "RoomNameTooLong()"
];

function keccak256(str) {
    // In actual Ethereum this is Keccak-256 (SHA-3), but for just name() it's enough to use the right hash.
    // However standard crypto.createHash('sha3-256') IS Keccak-256 for Ethereum?
    // Actually NO, SHA3-256 is NOT the same as Keccak-256.
    // I should use a library if I can.
    // Let me try to find a way to run it with viem if it exists in node_modules.
}

// Just printing them to calculate manually if needed or use a online tool if I had browser access.
// Wait, I HAVE browser access. I'll just use the search again or a tool.
// Actually, I can use a small python script if python is available, it might have a keccak library.
// Or I can just try to guess. 0x5416eb98.
