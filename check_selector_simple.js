
const crypto = require('crypto');
const signature = 'createAndJoin(string,uint8,string,bytes,address)';
const hash = crypto.createHash('sha3-256').update(signature).digest('hex');
console.log(`SHA3-256: ${hash.slice(0, 8)}`);

// Keccak-256 is what Ethereum uses.
// I'll use a library if available, but let's try to finding it in node_modules
try {
    const { keccak256, toHex } = require('viem');
    console.log(`Keccak-256 (viem): ${keccak256(toHex(signature)).slice(0, 10)}`);
} catch (e) {
    console.log("Viem not found or failed");
}
