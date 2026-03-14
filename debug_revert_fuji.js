const { createPublicClient, http } = require('viem');
const { avalancheFuji } = require('viem/chains');
const abi = require('./contracts/MafiaPortal.json').abi;

const client = createPublicClient({
  chain: avalancheFuji,
  transport: http('https://avalanche-fuji.drpc.org')
});

async function main() {
  const address = '0xa7f0fa14e49721ce598dd39b860b54b0e600b099';
  try {
    const res = await client.estimateContractGas({
      address,
      abi,
      functionName: 'createAndJoin',
      args: ['tur test2', 10, 'Haiman', '0x2e47e17e97f9a9ebe10607883da03a612259a0a20000', '0x2e47e17E97F9A9ebE10607883DA03a612259A0A2'],
      account: '0xd578569a91789Cc2CD83E1dC4d362d206344Ef66',
      value: 35000000000000000n
    });
    console.log("Success:", res);
  } catch (e) {
    console.error("Revert:", e);
  }
}
main();
