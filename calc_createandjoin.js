
const { keccak256, toHex, encodePacked } = require('viem');

const sig1 = "createAndJoin(string,uint8,string,bytes,address)";
const sig2 = "createAndJoin(string,uint8,string,bytes,address,bool,uint256)";

console.log(`${sig1}: ${keccak256(Buffer.from(sig1)).substring(0, 10)}`);
console.log(`${sig2}: ${keccak256(Buffer.from(sig2)).substring(0, 10)}`);
