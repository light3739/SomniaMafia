
const { keccak256, stringToBytes, toHex } = require('viem');

const sigs = [
    'InsufficientDeposit()',
    'InvalidPlayerCount()',
    'NicknameTooLong()',
    'PublicKeyTooLong()',
    'RoomNameTooLong()',
    'InvalidSessionAddress()',
    'SessionAlreadyRegistered()',
    'FunctionNotFound(bytes4)'
];

sigs.forEach(sig => {
    const hash = keccak256(toHex(sig));
    console.log(`${sig}: ${hash.slice(0, 10)}`);
});
