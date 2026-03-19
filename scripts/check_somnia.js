const { createPublicClient, http, parseAbi, formatEther } = require('viem');

const RPC_URL = 'https://dream-rpc.somnia.network/';
const DIAMOND = '0x0406a14729b0c77c187ac5229c8c2317589e73c0';
const USER = '0x0Da3194795CcBBc2afb70e40cD776a54747e49C4';

const client = createPublicClient({ 
    transport: http(RPC_URL) 
});

const abi = parseAbi([
    'function getDefaultDeposit() view returns (uint256)',
    'function nextRoomId() view returns (uint256)'
]);

async function main() {
    try {
        const [defaultDeposit, nextId, balance] = await Promise.all([
            client.readContract({ address: DIAMOND, abi: abi, functionName: 'getDefaultDeposit' }),
            client.readContract({ address: DIAMOND, abi: abi, functionName: 'nextRoomId' }),
            client.getBalance({ address: USER })
        ]);

        console.log('--- SOMNIA CONTRACT CHECK ---');
        console.log('Address:', USER);
        console.log('Balance (STT):', formatEther(balance));
        console.log('Default Deposit (STT):', formatEther(defaultDeposit));
        console.log('Next Room ID:', nextId.toString());
    } catch (err) {
        console.error('Error:', err);
    }
}

main();
