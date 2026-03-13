
const { keccak256, toHex } = require('viem');
const sigs = [
    'createAndJoin(string,uint8,string,bytes,address,bool,uint256)',
    'createAndJoin(string,uint256,string,bytes,address,bool,uint256)',
    'createAndJoin(string,uint8,string,bytes,address,uint256,bool)'
];

sigs.forEach(sig => {
    const hash = keccak256(toHex(sig));
    console.log(`${sig}: ${hash.slice(0, 10)}`);
});
