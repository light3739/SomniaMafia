
const { keccak256, toHex } = require('viem');
const sigs = [
    'joinRoom(uint256,string,bytes,address)',
    'joinRoom(uint256,string,bytes,address,bytes)',
    'joinRoom(uint256,string,bytes,address,bytes,bool,uint256)'
];

sigs.forEach(sig => {
    const hash = keccak256(toHex(sig));
    console.log(`${sig}: ${hash.slice(0, 10)}`);
});
