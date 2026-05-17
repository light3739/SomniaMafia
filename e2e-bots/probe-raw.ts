/**
 * Raw eth_call to getAgent(uint256) for each known agentId. Dump return bytes.
 * Then try several return-tuple decodings.
 */
import {
  createPublicClient,
  http,
  defineChain,
  encodeFunctionData,
  parseAbi,
  decodeAbiParameters,
  parseAbiParameters,
  type Address,
} from 'viem';

const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.infra.testnet.somnia.network/'] } },
});
const AGENT_REGISTRY: Address = '0x08D1Fc808f1983d2Ea7B63a28ECD4d8C885Cd02A';
const KNOWN_IDS = [
  12875401142070969085n,
  12847293847561029384n,
  13174292974160097713n,
];

const client = createPublicClient({ chain: somniaTestnet, transport: http() });

const CANDIDATE_RETURNS = [
  'string',
  'address',
  'string,string',
  'address,string',
  'address,string,string',
  'string,string,string',
  'address,string,string,uint256',
  'address,string,string,address,uint256',
  'address,string,string,address,uint256,uint256',
  'tuple(address agent, string name, string description)',
  'tuple(address agent, string name, string description, address owner)',
  'tuple(address agent, string name, string description, address owner, uint256 price)',
  'tuple(uint256 id, address agent, string name)',
  'tuple(uint256 id, address agent, string name, string description)',
  'tuple(uint256 id, address agent, string name, string description, address owner, uint256 price)',
  'tuple(string,string,address,uint256,uint256,uint256)',
  'tuple(address,uint256,uint256,bool,string,string)',
  'tuple(uint256,address,address,uint256,uint256,bytes32,string,string)',
];

(async () => {
  for (const id of KNOWN_IDS) {
    const data = encodeFunctionData({
      abi: parseAbi(['function getAgent(uint256) view returns (bytes)']),
      functionName: 'getAgent',
      args: [id],
    });
    const result = await client.call({ to: AGENT_REGISTRY, data });
    const raw = result.data ?? '0x';
    console.log(`\n── agentId ${id} ──`);
    console.log(`  raw len = ${raw.length}`);
    console.log(`  raw = ${raw}`);

    // Try every candidate decoding
    for (const sig of CANDIDATE_RETURNS) {
      try {
        const params = parseAbiParameters(sig);
        const decoded = decodeAbiParameters(params, raw);
        const j = JSON.stringify(decoded, (_, v) => typeof v === 'bigint' ? v.toString() : v);
        if (j !== '[]' && !j.includes('"\\u0000')) {
          console.log(`  ✓ decode "${sig}" → ${j.slice(0, 400)}`);
        }
      } catch { /* skip */ }
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
