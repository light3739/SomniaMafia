/**
 * Mafia on-chain e2e bots — Phase 1.
 *
 * Spawns N fake players against a local Anvil node and drives the game from
 * LOBBY → SHUFFLING → REVEAL without any browser. Each bot has its own main
 * wallet + session wallet, runs through createAndJoin/joinRoom, takes its
 * shuffle turn (commit + reveal), and verifies the room's phase advances.
 *
 * Usage (from frontend/e2e-bots):
 *   npm install        # once
 *   # in another terminal: npm run anvil
 *   npm run deploy     # deploys Diamond + Verifier, sets GM=0x7099...
 *   npm run bot        # runs this file
 *
 * Env overrides:
 *   DIAMOND_ADDRESS  override deployed Diamond (otherwise read from latest deployment json)
 *   RPC_URL          default http://127.0.0.1:8545
 *   PLAYER_COUNT     default 6
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  parseEventLogs,
  privateKeyToAccount,
  publicActions,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount as pkToAccount } from 'viem/accounts';
import { defineChain } from 'viem';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MAFIA_ABI, GamePhase, phaseName } from './abi.js';
import {
  SRAKeys,
  generateVerifiedSRAKeys,
  generateInitialDeck,
  generateDistributedDeck,
  encryptDeck,
  createDeckCommitHash,
  generateSalt,
  getCardOffset,
} from './sra.js';
// @ts-ignore — circomlibjs has no types
import { buildPoseidon } from 'circomlibjs';

// ─────────────────────────── Config ───────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const SOMNIA_DIR = join(__dirname, '..', '..', 'SomniaSol');
const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const PLAYER_COUNT = Number(process.env.PLAYER_COUNT ?? 6);
const LOBBY_FUNDING = parseEther('1.5'); // must match frontend useWalletManager

// Default anvil keys (deterministic: anvil --chain-id 31337)
const ANVIL_KEYS: Hex[] = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // [0] deployer
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // [1] GM
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // [2] bot 0 (host)
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // [3] bot 1
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a', // [4] bot 2
  '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', // [5] bot 3
  '0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e', // [6] bot 4
  '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', // [7] bot 5
  '0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97', // [8] bot 6
  '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6', // [9] bot 7
];

const anvilChain = defineChain({
  id: 31337,
  name: 'Anvil',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

// ─────────────────────────── Helpers ───────────────────────────
function resolveDiamondAddress(): Address {
  if (process.env.DIAMOND_ADDRESS) return process.env.DIAMOND_ADDRESS as Address;
  // Pick the most recent deployment-31337-*.json
  const files = readdirSync(SOMNIA_DIR)
    .filter((f) => f.startsWith('deployment-31337-') && f.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    throw new Error(
      `No deployment-31337-*.json found in ${SOMNIA_DIR}. Run \`npm run deploy\` first.`
    );
  }
  const latest = files[files.length - 1];
  const json = JSON.parse(readFileSync(join(SOMNIA_DIR, latest), 'utf8'));
  const addr = json?.contracts?.Diamond;
  if (!addr) throw new Error(`Diamond address missing in ${latest}`);
  console.log(`[deploy] Using Diamond from ${latest}: ${addr}`);
  return addr as Address;
}

function log(tag: string, ...args: unknown[]): void {
  console.log(`[${tag}]`, ...args);
}

async function waitForPhase(
  pc: PublicClient,
  diamond: Address,
  roomId: bigint,
  target: number,
  timeoutMs = 30_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const room = (await pc.readContract({
      address: diamond,
      abi: MAFIA_ABI,
      functionName: 'getRoom',
      args: [roomId],
    })) as any;
    const phase = Number(room.phase ?? room[4]);
    if (phase === target) return;
    await sleep(300);
  }
  throw new Error(`Timed out waiting for phase=${phaseName(target)}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────── Bot ───────────────────────────
interface Bot {
  idx: number;
  name: string;
  main: ReturnType<typeof pkToAccount>;
  session: ReturnType<typeof pkToAccount>;
  sessionPubKey: Hex;
  wallet: ReturnType<typeof createWalletClient>;
  sraKeys?: SRAKeys;
  roleSecret?: { role: number; mappedRole: number; salt: string };
}

function makeBot(idx: number, pk: Hex): Bot {
  const main = pkToAccount(pk);
  // Deterministic session key derived from main pk (simpler than random for tests)
  const sessionPk = `0x${Buffer.from(main.address.slice(2) + 'session', 'utf8')
    .toString('hex')
    .padEnd(64, '0')
    .slice(0, 64)}` as Hex;
  const session = pkToAccount(sessionPk);
  const sessionPubKey = session.publicKey;
  const wallet = createWalletClient({
    account: main,
    chain: anvilChain,
    transport: http(RPC_URL),
  });
  return {
    idx,
    name: `Bot_${idx}`,
    main,
    session,
    sessionPubKey,
    wallet,
  };
}

// ─────────────────────────── Game flow ───────────────────────────
async function createAndJoin(
  bot: Bot,
  diamond: Address,
  pc: PublicClient
): Promise<bigint> {
  log(bot.name, 'createAndJoin →', bot.main.address);
  const hash = await bot.wallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'createAndJoin',
    args: [
      'E2E Room',
      PLAYER_COUNT,
      bot.name,
      bot.sessionPubKey,
      bot.session.address,
      false,
      0n,
    ],
    chain: anvilChain,
    account: bot.main,
    value: LOBBY_FUNDING,
  } as any);
  const receipt = await pc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('createAndJoin reverted');
  const logs = parseEventLogs({ abi: MAFIA_ABI, eventName: 'RoomCreated', logs: receipt.logs });
  const roomId = (logs[0] as any).args.roomId as bigint;
  log(bot.name, `✓ room ${roomId} created`);
  return roomId;
}

async function joinRoom(bot: Bot, diamond: Address, pc: PublicClient, roomId: bigint) {
  log(bot.name, `joinRoom(${roomId}) → ${bot.main.address}`);
  const hash = await bot.wallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'joinRoom',
    args: [roomId, bot.name, bot.sessionPubKey, bot.session.address, '0x'],
    chain: anvilChain,
    account: bot.main,
    value: LOBBY_FUNDING,
  } as any);
  const receipt = await pc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${bot.name} joinRoom reverted`);
  log(bot.name, '✓ joined');
}

async function startGame(host: Bot, diamond: Address, pc: PublicClient, roomId: bigint) {
  log(host.name, `startGame(${roomId})`);
  const hash = await host.wallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'startGame',
    args: [roomId],
    chain: anvilChain,
    account: host.main,
  } as any);
  const receipt = await pc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('startGame reverted');
  log(host.name, '✓ game started (phase=SHUFFLING)');
}

async function runShuffleTurn(
  bot: Bot,
  diamond: Address,
  pc: PublicClient,
  roomId: bigint,
  prevDeck: string[] | null
): Promise<string[]> {
  // Seed SRA keys against the known card values so roundtrip is guaranteed.
  if (!bot.sraKeys) {
    const seed = [...new Set(generateInitialDeck(PLAYER_COUNT, roomId))];
    bot.sraKeys = generateVerifiedSRAKeys(seed);
  }

  const newDeck =
    prevDeck === null
      ? encryptDeck(bot.sraKeys, generateDistributedDeck(PLAYER_COUNT, roomId))
      : encryptDeck(bot.sraKeys, prevDeck);

  const salt = generateSalt();
  const deckHash = createDeckCommitHash(newDeck, salt);

  log(bot.name, `commitDeck #${bot.idx}`);
  let hash = await bot.wallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'commitDeck',
    args: [roomId, deckHash],
    chain: anvilChain,
    account: bot.main,
  } as any);
  let receipt = await pc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${bot.name} commitDeck reverted`);

  log(bot.name, `revealDeck #${bot.idx}`);
  hash = await bot.wallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'revealDeck',
    args: [roomId, newDeck, salt],
    chain: anvilChain,
    account: bot.main,
  } as any);
  receipt = await pc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${bot.name} revealDeck reverted`);
  log(bot.name, `✓ shuffle turn ${bot.idx} done`);
  return newDeck;
}

// ─────────────────────────── Role helpers ───────────────────────────
const ROLE_NAMES: Record<number, string> = { 1: 'MAFIA', 2: 'DOCTOR', 3: 'DETECTIVE', 4: 'CIVILIAN' };
const FLAG_ACTIVE = 2;

function roleFromCardValue(decrypted: string, roomId: bigint): number {
  const off = getCardOffset(roomId);
  return Number(BigInt(decrypted)) - off;
}

let _poseidon: any;
async function poseidonHash(inputs: bigint[]): Promise<`0x${string}`> {
  if (!_poseidon) _poseidon = await buildPoseidon();
  const hash = _poseidon(inputs);
  return ('0x' + _poseidon.F.toString(hash, 16).padStart(64, '0')) as `0x${string}`;
}

// ─────────────────────────── Phase 2: Role confirm ───────────────────
async function confirmRoles(
  bots: Bot[],
  diamond: Address,
  pc: PublicClient,
  roomId: bigint,
): Promise<Map<string, number>> {
  // Read encrypted deck from contract
  const encDeck = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getDeck',
    args: [roomId],
  })) as string[];

  // Collect all SRA decryption keys
  const allKeys = bots.map((b) => b.sraKeys!);
  const roleMap = new Map<string, number>(); // address → role (1-4)

  for (let i = 0; i < bots.length; i++) {
    const bot = bots[i];
    // Decrypt card through all layers
    let card = encDeck[i];
    for (const k of allKeys) {
      card = k.decrypt(card);
    }
    const role = roleFromCardValue(card, roomId);
    roleMap.set(bot.main.address.toLowerCase(), role);

    // Poseidon commitment: hash(mappedRole, salt) where mappedRole = 1 for MAFIA, 0 otherwise
    const mappedRole = role === 1 ? 1n : 0n;
    const salt = '0x' + generateSalt();
    const roleHash = await poseidonHash([mappedRole, BigInt(salt)]);
    bot.roleSecret = { role, mappedRole: Number(mappedRole), salt };

    log(bot.name, `role=${ROLE_NAMES[role] || 'UNKNOWN'}, commitAndConfirmRole...`);
    const hash = await bot.wallet.writeContract({
      address: diamond,
      abi: MAFIA_ABI,
      functionName: 'commitAndConfirmRole',
      args: [roomId, roleHash],
      chain: anvilChain,
      account: bot.main,
    } as any);
    const receipt = await pc.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${bot.name} commitAndConfirmRole reverted`);
    log(bot.name, `✓ role confirmed (${ROLE_NAMES[role]})`);
  }

  return roleMap;
}

// ─────────────────────────── Phase 3: Voting ───────────────────
async function runVoting(
  bots: Bot[],
  diamond: Address,
  pc: PublicClient,
  roomId: bigint,
  roleMap: Map<string, number>,
  gmWallet: ReturnType<typeof createWalletClient>,
  gmAccount: ReturnType<typeof pkToAccount>,
): Promise<{ eliminated: string | null; gameEnded: boolean }> {
  // Get alive players
  const players = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getPlayers',
    args: [roomId],
  })) as any[];
  const aliveBots = bots.filter((b) => {
    const p = players.find((p: any) => p.wallet.toLowerCase() === b.main.address.toLowerCase());
    return p && Number(p.flags) & FLAG_ACTIVE;
  });

  // Pick target: first alive mafia member
  const mafiaBot = aliveBots.find((b) => roleMap.get(b.main.address.toLowerCase()) === 1);
  const target = mafiaBot
    ? mafiaBot.main.address
    : aliveBots[aliveBots.length - 1].main.address; // fallback: last alive player

  // Start voting
  const host = aliveBots[0];
  log(host.name, `startVoting(${roomId})`);
  let hash = await host.wallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'startVoting',
    args: [roomId],
    chain: anvilChain,
    account: host.main,
  } as any);
  await pc.waitForTransactionReceipt({ hash });

  // All alive players vote
  for (const bot of aliveBots) {
    log(bot.name, `vote → ${target.slice(0, 8)}...`);
    hash = await bot.wallet.writeContract({
      address: diamond,
      abi: MAFIA_ABI,
      functionName: 'vote',
      args: [roomId, target],
      chain: anvilChain,
      account: bot.main,
    } as any);
    await pc.waitForTransactionReceipt({ hash });
  }

  // Check result
  const room = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getRoom',
    args: [roomId],
  })) as any;
  const phase = Number(room.phase ?? room[4]);
  const gameEnded = phase === GamePhase.ENDED;

  log('vote', `✓ voting done → phase=${phaseName(phase)}, eliminated=${target.slice(0, 8)}`);
  return { eliminated: target, gameEnded };
}

// ─────────────────────────── Phase 4: Night ───────────────────
async function runNight(
  bots: Bot[],
  diamond: Address,
  pc: PublicClient,
  roomId: bigint,
  roleMap: Map<string, number>,
  gmWallet: ReturnType<typeof createWalletClient>,
  gmAccount: ReturnType<typeof pkToAccount>,
): Promise<{ killed: string | null; gameEnded: boolean }> {
  const players = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getPlayers',
    args: [roomId],
  })) as any[];

  const aliveTown = players.filter((p: any) =>
    (Number(p.flags) & FLAG_ACTIVE) && roleMap.get(p.wallet.toLowerCase()) !== 1
  );

  // GM kills a town player (pick first alive town)
  const victim = aliveTown.length > 0 ? aliveTown[0].wallet : '0x0000000000000000000000000000000000000000';

  log('GM', `resolveNightAsGameMaster → victim=${(victim as string).slice(0, 8)}`);
  const hash = await gmWallet.writeContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'resolveNightAsGameMaster',
    args: [roomId, victim, '0x0000000000000000000000000000000000000000'],
    chain: anvilChain,
    account: gmAccount,
  } as any);
  const receipt = await pc.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('resolveNightAsGameMaster reverted');

  const room = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getRoom',
    args: [roomId],
  })) as any;
  const phase = Number(room.phase ?? room[4]);
  const gameEnded = phase === GamePhase.ENDED;

  log('GM', `✓ night resolved → phase=${phaseName(phase)}, killed=${(victim as string).slice(0, 8)}`);
  return { killed: victim, gameEnded };
}

// ─────────────────────────── Main ───────────────────────────
async function main() {
  console.log('═══ Mafia E2E Bots — Full Game ═══');
  console.log(`RPC: ${RPC_URL}`);
  console.log(`Players: ${PLAYER_COUNT}`);

  const diamond = resolveDiamondAddress();

  const pc = createPublicClient({ chain: anvilChain, transport: http(RPC_URL) }) as PublicClient;

  // GM wallet (ANVIL_KEYS[1])
  const gmAccount = pkToAccount(ANVIL_KEYS[1]);
  const gmWallet = createWalletClient({
    account: gmAccount,
    chain: anvilChain,
    transport: http(RPC_URL),
  });

  // Quick sanity ping
  const bn = await pc.getBlockNumber();
  console.log(`Anvil block: ${bn}`);

  // Spawn bots (skip keys [0]=deployer, [1]=GM)
  const bots: Bot[] = [];
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const pk = ANVIL_KEYS[2 + i];
    if (!pk) throw new Error(`Need at least ${PLAYER_COUNT + 2} anvil keys; have ${ANVIL_KEYS.length}`);
    bots.push(makeBot(i, pk));
  }

  // ══════════════════ PHASE 1: LOBBY → SHUFFLING → REVEAL ══════════════════
  const host = bots[0];
  const roomId = await createAndJoin(host, diamond, pc);
  for (let i = 1; i < bots.length; i++) {
    await joinRoom(bots[i], diamond, pc, roomId);
  }

  const lobbyPlayers = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getPlayers',
    args: [roomId],
  })) as any[];
  console.log(`[lobby] ✓ ${lobbyPlayers.length} players in room ${roomId}`);

  await startGame(host, diamond, pc, roomId);
  await waitForPhase(pc, diamond, roomId, GamePhase.SHUFFLING);

  let deck: string[] | null = null;
  for (const bot of bots) {
    deck = await runShuffleTurn(bot, diamond, pc, roomId, deck);
  }

  await waitForPhase(pc, diamond, roomId, GamePhase.REVEAL);
  console.log('✅ PHASE 1 PASS — reached REVEAL\n');

  // ══════════════════ PHASE 2: ROLE CONFIRM (REVEAL → DAY) ══════════════════
  const roleMap = await confirmRoles(bots, diamond, pc, roomId);
  await waitForPhase(pc, diamond, roomId, GamePhase.DAY);

  // Print role distribution
  console.log('── Role distribution ──');
  for (const [addr, role] of roleMap) {
    const bot = bots.find((b) => b.main.address.toLowerCase() === addr);
    console.log(`  ${bot?.name || addr.slice(0, 8)}: ${ROLE_NAMES[role] || 'UNKNOWN'}`);
  }
  console.log('✅ PHASE 2 PASS — roles confirmed, reached DAY\n');

  // ══════════════════ PHASE 3-5: DAY/VOTE/NIGHT LOOP ══════════════════
  let round = 0;
  const MAX_ROUNDS = 10; // safety valve

  while (round < MAX_ROUNDS) {
    round++;
    console.log(`══ Round ${round} ══`);

    // ── DAY → VOTING ──
    const room = (await pc.readContract({
      address: diamond,
      abi: MAFIA_ABI,
      functionName: 'getRoom',
      args: [roomId],
    })) as any;
    const phase = Number(room.phase ?? room[4]);

    if (phase === GamePhase.ENDED) break;
    if (phase !== GamePhase.DAY) {
      console.error(`❌ Expected DAY, got ${phaseName(phase)}`);
      process.exit(1);
    }

    const voteResult = await runVoting(bots, diamond, pc, roomId, roleMap, gmWallet, gmAccount);
    if (voteResult.gameEnded) {
      console.log('✅ PHASE 3 PASS — game ended after voting\n');
      break;
    }
    console.log(`✅ Round ${round} voting done — eliminated ${voteResult.eliminated?.slice(0, 8)}`);

    // ── NIGHT ──
    await waitForPhase(pc, diamond, roomId, GamePhase.NIGHT);
    const nightResult = await runNight(bots, diamond, pc, roomId, roleMap, gmWallet, gmAccount);
    if (nightResult.gameEnded) {
      console.log('✅ PHASE 4 PASS — game ended after night\n');
      break;
    }
    console.log(`✅ Round ${round} night done — killed ${nightResult.killed?.slice(0, 8)}\n`);

    await waitForPhase(pc, diamond, roomId, GamePhase.DAY);
  }

  // ══════════════════ VERIFY END STATE ══════════════════
  const endRoom = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getRoom',
    args: [roomId],
  })) as any;
  const endPhase = Number(endRoom.phase ?? endRoom[4]);
  if (endPhase !== GamePhase.ENDED) {
    console.error(`❌ Expected ENDED after ${MAX_ROUNDS} rounds, got ${phaseName(endPhase)}`);
    process.exit(1);
  }

  const endPlayers = (await pc.readContract({
    address: diamond,
    abi: MAFIA_ABI,
    functionName: 'getPlayers',
    args: [roomId],
  })) as any[];
  const alive = endPlayers.filter((p: any) => Number(p.flags) & FLAG_ACTIVE);
  const aliveMafia = alive.filter((p: any) => roleMap.get(p.wallet.toLowerCase()) === 1);
  const aliveTown = alive.filter((p: any) => roleMap.get(p.wallet.toLowerCase()) !== 1);

  console.log('── Final state ──');
  console.log(`  Alive: ${alive.length} (${aliveMafia.length} mafia, ${aliveTown.length} town)`);
  console.log(`  Rounds: ${round}`);
  const winner = aliveMafia.length === 0 ? 'TOWN' : 'MAFIA';
  console.log(`  Winner: ${winner}`);

  console.log('\n✅ PHASE 5 PASS — game ended correctly');
  console.log('✅ ALL PHASES PASSED — Full game cycle complete!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
