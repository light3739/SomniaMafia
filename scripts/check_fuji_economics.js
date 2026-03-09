/* eslint-disable no-console */
import {
  createPublicClient,
  http,
  parseAbi,
  formatEther,
} from 'viem';

const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc';
const DIAMOND = '0x3c1bd1923f8318247e2b60e41b0f280391c4e1e1';

const client = createPublicClient({ transport: http(RPC_URL) });

const readAbi = parseAbi([
  'function getDefaultDeposit() view returns (uint256)',
  'function nextRoomId() view returns (uint256)',
  'function getRoom(uint256 roomId) view returns ((uint64 id,address host,string name,uint8 phase,uint8 maxPlayers,uint8 playersCount,uint8 aliveCount,uint16 dayCount,uint8 currentShufflerIndex,uint32 lastActionTimestamp,uint32 phaseDeadline,uint8 confirmedCount,uint8 votedCount,uint8 committedCount,uint8 revealedCount,uint8 keysSharedCount,uint128 depositPool,uint128 depositPerPlayer))',
]);

const eventAbi = parseAbi([
  'event DepositCollected(uint256 indexed roomId, address indexed player, uint256 amount)',
  'event DepositRefunded(uint256 indexed roomId, address indexed player, uint256 amount)',
]);

async function getLogsChunked(event, fromBlock, toBlock, step = 2048n) {
  const all = [];
  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + step - 1n > toBlock ? toBlock : start + step - 1n;
    const chunk = await client.getLogs({
      address: DIAMOND,
      event,
      fromBlock: start,
      toBlock: end,
    });
    all.push(...chunk);
    start = end + 1n;
  }
  return all;
}

const GAS_ESTIMATES = {
  commitDeck: 1_000_000n,
  revealDeck: 30_000_000n,
  shareKeysToAll: 30_000_000n,
  commitAndConfirmRole: 1_000_000n,
  vote: 500_000n,
  revealRole: 2_000_000n,
  commitNightAction: 500_000n,
  revealNightAction: 1_000_000n,
  commitMafiaTarget: 500_000n,
  revealMafiaTarget: 2_000_000n,
};

function calculateRounds(players, mafiaCount) {
  const townCount = players - mafiaCount;
  return Math.ceil(townCount / 2) + 1;
}

function toAvax(wei) {
  return Number(formatEther(wei));
}

(async () => {
  const [gasPrice, defaultDeposit, nextRoomId, latestBlock] = await Promise.all([
    client.getGasPrice(),
    client.readContract({ address: DIAMOND, abi: readAbi, functionName: 'getDefaultDeposit' }),
    client.readContract({ address: DIAMOND, abi: readAbi, functionName: 'nextRoomId' }),
    client.getBlockNumber(),
  ]);

  const players = 16;
  const mafia = 4;
  const rounds = calculateRounds(players, mafia); // 7

  const citizenGas =
    GAS_ESTIMATES.commitDeck +
    GAS_ESTIMATES.revealDeck +
    GAS_ESTIMATES.shareKeysToAll +
    GAS_ESTIMATES.commitAndConfirmRole +
    GAS_ESTIMATES.vote * BigInt(rounds) +
    GAS_ESTIMATES.revealRole;

  const specialGas = citizenGas +
    (GAS_ESTIMATES.commitNightAction + GAS_ESTIMATES.revealNightAction) * BigInt(rounds);

  const mafiaGas = citizenGas +
    (GAS_ESTIMATES.commitMafiaTarget + GAS_ESTIMATES.revealMafiaTarget) * BigInt(rounds);

  const fund002 = 20_000_000_000_000_000n; // 0.02 AVAX

  const citizenCostWei = citizenGas * gasPrice;
  const specialCostWei = specialGas * gasPrice;
  const mafiaCostWei = mafiaGas * gasPrice;

  const coverageGas = fund002 / gasPrice;

  const fromBlock = latestBlock > 200_000n ? latestBlock - 200_000n : 0n;
  const [collectedLogs, refundedLogs] = await Promise.all([
    getLogsChunked(eventAbi[0], fromBlock, latestBlock),
    getLogsChunked(eventAbi[1], fromBlock, latestBlock),
  ]);

  const recentRooms = [];
  const maxRoomId = Number(nextRoomId) - 1;
  for (let roomId = Math.max(1, maxRoomId - 4); roomId <= maxRoomId; roomId += 1) {
    try {
      const room = await client.readContract({
        address: DIAMOND,
        abi: readAbi,
        functionName: 'getRoom',
        args: [BigInt(roomId)],
      });
      recentRooms.push({
        roomId,
        phase: Number(room.phase),
        playersCount: Number(room.playersCount),
        depositPool: room.depositPool,
        depositPerPlayer: room.depositPerPlayer,
      });
    } catch {
      // ignore missing/invalid room ids
    }
  }

  console.log('--- FUJI ECONOMICS CHECK ---');
  console.log('gasPriceWei:', gasPrice.toString());
  console.log('gasPriceGwei:', Number(gasPrice) / 1e9);
  console.log('defaultDepositWei:', defaultDeposit.toString());
  console.log('defaultDepositAVAX:', toAvax(defaultDeposit));
  console.log('nextRoomId:', nextRoomId.toString());
  console.log('fromBlockScanned:', fromBlock.toString());
  console.log('depositCollectedEvents(last200k):', collectedLogs.length);
  console.log('depositRefundedEvents(last200k):', refundedLogs.length);

  console.log('\n--- 16 PLAYERS, 1 PLAYER FULL GAME ---');
  console.log('roundsAssumed:', rounds);
  console.log('citizenGas:', citizenGas.toString(), 'costAVAX:', toAvax(citizenCostWei));
  console.log('doctor/detectiveGas:', specialGas.toString(), 'costAVAX:', toAvax(specialCostWei));
  console.log('mafiaGas:', mafiaGas.toString(), 'costAVAX:', toAvax(mafiaCostWei));

  console.log('\n--- FUND 0.02 AVAX COVERAGE ---');
  console.log('fundAVAX:', 0.02);
  console.log('coversGasApprox:', coverageGas.toString());
  console.log('coverageVsCitizen:', Number(coverageGas) / Number(citizenGas));
  console.log('coverageVsSpecial:', Number(coverageGas) / Number(specialGas));
  console.log('coverageVsMafia:', Number(coverageGas) / Number(mafiaGas));

  console.log('\n--- RECENT ROOM DEPOSITS ---');
  for (const room of recentRooms) {
    console.log(
      `room ${room.roomId}: players=${room.playersCount}, phase=${room.phase}, depositPerPlayer=${formatEther(room.depositPerPlayer)} AVAX, depositPool=${formatEther(room.depositPool)} AVAX`
    );
  }
})();
