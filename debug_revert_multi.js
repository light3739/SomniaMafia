
const { createPublicClient, http, parseEther, encodeFunctionData } = require('viem');
const { avalancheFuji } = require('viem/chains');

const rpcs = [
    'https://avalanche-fuji-c-chain-rpc.publicnode.com',
    'https://api.avax-test.network/ext/bc/C/rpc'
];

const ABI = [
    {
        "inputs": [
            { "name": "roomName", "type": "string" },
            { "name": "maxPlayers", "type": "uint8" },
            { "name": "nickname", "type": "string" },
            { "name": "publicKey", "type": "bytes" },
            { "name": "sessionAddress", "type": "address" }
        ],
        "name": "createAndJoin",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "payable",
        "type": "function"
    }
];

const args = [
    "test1",
    16,
    "Haiman",
    "0x30820122300d06092a864886f70d01010105000382010f003082010a0282010100ab86aaf34bd353bc055e94604eaa9648d8e79e24dec1c17cb5ce523656225dbfe0198c930ee3e5f5c5c3e579402ac62760de927f6faa44aa3814e0f20cf76c120cb828dfcd4fb180629fc80d29974a80e812bcacd6e9b3de32860117308d5f07eb22014e649ce506f3d46ba2e23e16fa38de48a90b451e29c0247f787b0118d2e3a1497852cc2147b5394bad6a586c5581bd434231eb1948390cf721ccbf0062e30877b4507925fe95d017fb0fd7e0da195e0864a9cadfbff215101c8a3c48d258f4102d08fc2ff94a4eac51cee49b4b4b4acfabbf2a7d6de7578ff231a4b4a65fe0f6d23432c3df8dd399b3b8997f32353fc48e2c31602dee357578661532d70203010001",
    "0x2D31975f6Dce43648d2f76fFE33b13b3fa93c174"
];

(async () => {
    const data = encodeFunctionData({
        abi: ABI,
        functionName: 'createAndJoin',
        args: args
    });

    for (const rpc of rpcs) {
        console.log(`Checking RPC: ${rpc}`);
        try {
            const response = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'eth_call',
                    params: [{
                        to: '0xa7f0fa14e49721ce598dd39b860b54b0e600b099',
                        data: data,
                        from: '0xd578569a91789Cc2CD83E1dC4d362d206344Ef66',
                        value: '0x4db732547630000'
                    }, 'latest']
                })
            });
            const result = await response.json();
            console.log(JSON.stringify(result, null, 2));
        } catch (e) {
            console.log(`Error with ${rpc}: ${e.message}`);
        }
    }
})();
