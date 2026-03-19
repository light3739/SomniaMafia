const { createPublicClient, http, parseAbi, formatEther } = require('viem');

const RPC_URL = 'https://dream-rpc.somnia.network/';

const client = createPublicClient({ 
    transport: http(RPC_URL) 
});

async function main() {
    try {
        const gasPrice = await client.getGasPrice();
        console.log('Gas Price (Wei):', gasPrice.toString());
        console.log('Gas Price (Gwei):', Number(gasPrice) / 1e9);
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
