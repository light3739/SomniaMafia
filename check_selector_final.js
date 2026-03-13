
const { keccak256, toHex, encodeFunctionSelector } = require('viem');

const signature = 'createAndJoin(string,uint8,string,bytes,address)';
const selector = encodeFunctionSelector(signature);
console.log(`Signature: ${signature}`);
console.log(`Selector: ${selector}`);

const signature7 = 'createAndJoin(string,uint8,string,bytes,address,bool,uint256)';
const selector7 = encodeFunctionSelector(signature7);
console.log(`Signature (7 args): ${signature7}`);
console.log(`Selector (7 args): ${selector7}`);
