/**
 * Round 2 probe: we now know AgentRegistry.getAllAgents() returns 3 IDs.
 * Goal: identify which one is LLM Inference. Try to read metadata for each.
 */
import {
  createPublicClient,
  http,
  defineChain,
  parseAbi,
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

// Heavy variant list — Somnia agent registries often expose name/description/owner/price
const SIGS = [
  'function agents(uint256) view returns (address agent, string name, string description, address owner, uint256 perAgentPrice)',
  'function agents(uint256) view returns (address, string, string, address, uint256)',
  'function agents(uint256) view returns (tuple(address agent, string name, string description, address owner, uint256 perAgentPrice))',
  'function getAgent(uint256) view returns (address agent, string name, string description)',
  'function getAgent(uint256) view returns (address agent, string name, string description, uint256 perAgentPrice)',
  'function getAgent(uint256) view returns (address agent, string name, string description, address owner, uint256 perAgentPrice)',
  'function getAgent(uint256) view returns (tuple(address agent, string name, string description, address owner, uint256 perAgentPrice))',
  'function getAgentInfo(uint256) view returns (address, string, string)',
  'function agentInfo(uint256) view returns (address, string, string)',
  'function info(uint256) view returns (string)',
  'function name(uint256) view returns (string)',
  'function nameOf(uint256) view returns (string)',
  'function ownerOf(uint256) view returns (address)',
  'function agentOf(uint256) view returns (address)',
  'function metadata(uint256) view returns (string)',
  'function uri(uint256) view returns (string)',
  'function tokenURI(uint256) view returns (string)',
];

(async () => {
  for (const id of KNOWN_IDS) {
    console.log(`\n── agentId ${id} ──`);
    for (const sig of SIGS) {
      const fnName = sig.match(/function (\w+)/)![1];
      try {
        const result: any = await client.readContract({
          address: AGENT_REGISTRY,
          abi: parseAbi([sig]),
          functionName: fnName,
          args: [id],
        });
        console.log(`  ✓ ${fnName} via "${sig.slice(0, 90)}..."`);
        console.log(`     →`, JSON.stringify(result, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        ));
      } catch {
        // silent
      }
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
