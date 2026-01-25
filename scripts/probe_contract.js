
const { createPublicClient, http, parseAbi } = require('viem');

const MAFIA_CONTRACT_ADDRESS = "0x3C1Bd1923F8318247e2B60E41B0F280391c4e1E1";

const somniaChain = {
    id: 5031,
    name: 'Somnia Mainnet',
    nativeCurrency: { name: 'SOMI', symbol: 'SOMI', decimals: 18 },
    rpcUrls: {
        default: {
            http: ['https://api.infra.mainnet.somnia.network'],
        },
    },
};

const client = createPublicClient({
    chain: somniaChain,
    transport: http(),
});

async function probe() {
    console.log("Probing Mafia Contract at:", MAFIA_CONTRACT_ADDRESS);

    const functions = [
        'function paused() view returns (bool)',
        'function nextRoomId() view returns (uint256)',
        'function ADMIN_ROLE() view returns (bytes32)',
        'function MAX_ARRAY_SIZE() view returns (uint32)',
    ];

    for (const f of functions) {
        try {
            const abi = parseAbi([f]);
            const name = f.split(' ')[1].split('(')[0];
            const result = await client.readContract({
                address: MAFIA_CONTRACT_ADDRESS,
                abi,
                functionName: name,
            });
            console.log(`[OK] ${name}:`, result);
        } catch (e) {
            console.error(`[FAIL] ${f}:`, e.shortMessage || e.message);
        }
    }

    // Check bytecode
    const code = await client.getBytecode({ address: MAFIA_CONTRACT_ADDRESS });
    console.log("Bytecode length:", code ? code.length : 0);

    // Try to estimate gas for createAndJoin with dummy data
    try {
        const abi = parseAbi(['function createAndJoin(string,uint8,string,bytes,address) payable returns (uint256)']);
        const estimate = await client.estimateContractGas({
            address: MAFIA_CONTRACT_ADDRESS,
            abi,
            functionName: 'createAndJoin',
            args: ["test", 5, "nick", "0x1234", "0x0000000000000000000000000000000000000000"],
            value: 1000000000000000n, // 0.001
            account: "0x0e0442Bda5bF288669a63f5a0687AF5309A8ac19", // Original user address from logs
        });
        console.log("[OK] createAndJoin Gas Estimate:", estimate);
    } catch (e) {
        console.error("[FAIL] createAndJoin Estimation:", e.shortMessage || e.message);
    }
}

probe();
