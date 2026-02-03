const { keccak256, toBytes } = require('viem');

const errorNames = [
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

const target = "0x0aebb21e";

console.log(`Searching for selector: ${target}`);
for (const name of errorNames) {
    const selector = keccak256(toBytes(name)).slice(0, 10);
    if (selector === target) {
        console.log(`MATCH FOUND: ${name} -> ${selector}`);
        break;
    }
}
