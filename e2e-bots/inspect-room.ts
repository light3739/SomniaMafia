/**
 * Inspect a room on Somnia testnet using raw eth_call → decodeAbiParameters
 * to bypass viem's auto Number coercion on tuple decoding.
 */
import { createPublicClient, http, defineChain, encodeFunctionData, decodeAbiParameters, parseAbi, parseAbiParameters } from 'viem';

const chain = defineChain({
  id: 50312, name: 'Somnia',
  nativeCurrency: { name: 'STT', symbol: 'STT', decimals: 18 },
  rpcUrls: { default: { http: ['https://api.infra.testnet.somnia.network/'] } },
});
const c = createPublicClient({ chain, transport: http() });
const DIAMOND = (process.env.DIAMOND ?? '0x031b6746155ce11c7b533935f4674f5fc4682338') as `0x${string}`;
const PHASES = ['LOBBY', 'SHUFFLING', 'REVEAL', 'DAY', 'VOTING', 'NIGHT', 'ENDED'];

const GET_ROOM_ABI = parseAbi([
  'function getRoom(uint256)',
]);
const GET_PLAYERS_ABI = parseAbi([
  'function getPlayers(uint256)',
]);

const ROOM_RETURN = parseAbiParameters(
  '(uint64 id, address host, string name, uint8 phase, uint8 maxPlayers, uint8 playersCount, uint8 aliveCount, uint16 dayCount, uint8 currentShufflerIndex, uint32 lastActionTimestamp, uint32 phaseDeadline, uint8 confirmedCount, uint8 votedCount, uint8 committedCount, uint8 revealedCount, uint8 keysSharedCount, uint128 depositPool, uint128 depositPerPlayer, bool isPrivate, uint256 tournamentId)'
);

const PLAYERS_RETURN = parseAbiParameters(
  '(address wallet, string nickname, bytes publicKey, uint32 flags)[]'
);

(async () => {
  const roomId = BigInt(process.argv[2] ?? '5');

  const roomData = await c.call({
    to: DIAMOND,
    data: encodeFunctionData({ abi: GET_ROOM_ABI, functionName: 'getRoom', args: [roomId] }),
  });
  if (!roomData.data) throw new Error('getRoom returned empty');
  const [r] = decodeAbiParameters(ROOM_RETURN, roomData.data) as any;
  console.log(`Room ${roomId}:`);
  console.log(`  phase: ${r.phase} (${PHASES[Number(r.phase)] ?? '?'})`);
  console.log(`  host : ${r.host}`);
  console.log(`  maxPlayers=${r.maxPlayers} playersCount=${r.playersCount} aliveCount=${r.aliveCount}`);
  console.log(`  dayCount=${r.dayCount} phaseDeadline=${r.phaseDeadline}`);
  console.log(`  votedCount=${r.votedCount} confirmedCount=${r.confirmedCount} committedCount=${r.committedCount}`);
  console.log(`  isPrivate=${r.isPrivate} tournamentId=${r.tournamentId}`);

  const playersData = await c.call({
    to: DIAMOND,
    data: encodeFunctionData({ abi: GET_PLAYERS_ABI, functionName: 'getPlayers', args: [roomId] }),
  });
  if (!playersData.data) throw new Error('getPlayers returned empty');
  const [players] = decodeAbiParameters(PLAYERS_RETURN, playersData.data) as any;
  console.log(`\nPlayers (${players.length}):`);
  for (const x of players) {
    const alive = (Number(x.flags) & 2) !== 0;
    console.log(`  ${x.wallet}  flags=${x.flags}  ${alive ? 'ALIVE' : 'DEAD '}  ${x.nickname}`);
  }
})().catch((e: any) => { console.error(e.shortMessage ?? e.message ?? e); process.exit(1); });
