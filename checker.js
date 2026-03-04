const { createPublicClient, http } = require('viem');
const { AVALANCHE_FUJI } = require('./contracts/config');
const MAFIA_ABI = [{ "inputs": [{ "internalType": "address", "name": "", "type": "address" }], "name": "sessionKeys", "outputs": [{ "internalType": "address", "name": "sessionAddress", "type": "address" }, { "internalType": "uint32", "name": "expiresAt", "type": "uint32" }, { "internalType": "uint64", "name": "roomId", "type": "uint64" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "stateMutability": "view", "type": "function" }];

const MAFIA_CONTRACT_ADDRESS = '0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1';

const client = createPublicClient({ chain: AVALANCHE_FUJI, transport: http() });

async function main() {
    const players = [
        '0xAC0E15218dC8B51B485C62C7c61fA8dFB273352e',
        '0x2A95D25690593bBBB73121BDE4980287622f24C0',
        '0x24FA23Afc8Fa353339Ee9E937eDF39B140fBaBc5'
    ];
    for (const address of players) {
        const session = await client.readContract({
            address: MAFIA_CONTRACT_ADDRESS,
            abi: MAFIA_ABI,
            functionName: 'sessionKeys',
            args: [address]
        });
        console.log("Session for", address, ":", session);
    }
}

main().catch(console.error);
