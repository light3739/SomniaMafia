import express from 'express';
import cors from 'cors';
import { encodeAbiParameters, keccak256 } from 'viem';
import { verifyMessage, type Address, type Hash, parseAbiItem } from 'viem';
import {
  getRoom,
  getPlayers,
  getRoleCommit,
  setCachedRoleCommit,
  getSessionKey,
  resolveNight,
  publicClient,
  GM_ADDRESS,
  DIAMOND_ADDRESS,
  GamePhase,
  FLAGS,
  ACTION_TO_ROLE,
} from './chain.js';
import {
  getOrCreateNightState,
  clearNightState,
  getNightState,
  getAllNightStates,
  markKnownMafia,
  getKnownMafia,
  calculateMafiaConsensus,
  getDoctorHeal,
  type NightAction,
} from './game-state.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3001;
const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address;
const AUTO_RESOLVE_IDLE_MS = Number(process.env.GM_AUTO_RESOLVE_IDLE_MS || 65000);
const autoResolveTimers = new Map<bigint, NodeJS.Timeout>();

interface InvestigationProof {
  targetAddress: Address;
  timestamp: number;
}

const investigationProofs = new Map<string, Map<string, InvestigationProof>>();

const storeInvestigationProof = (roomId: bigint, detective: Address, target: Address) => {
  const roomKey = roomId.toString();
  let roomMap = investigationProofs.get(roomKey);
  if (!roomMap) {
    roomMap = new Map<string, InvestigationProof>();
    investigationProofs.set(roomKey, roomMap);
  }
  roomMap.set(detective.toLowerCase(), { targetAddress: target, timestamp: Date.now() });
};

const getInvestigationProof = (roomId: bigint, detective: Address): InvestigationProof | null => {
  return investigationProofs.get(roomId.toString())?.get(detective.toLowerCase()) || null;
};

const scheduleAutoResolve = (roomId: bigint) => {
  const existing = autoResolveTimers.get(roomId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    try {
      const state = getNightState(roomId);
      if (!state || state.resolved || state.actions.size === 0) return;

      const room = await getRoom(roomId);
      if (room.phase !== GamePhase.NIGHT) {
        clearNightState(roomId);
        return;
      }

      // Prune stale actions from dead/removed players before auto-resolve.
      const players = await getPlayers(roomId);
      const alivePlayers = new Set(
        players
          .filter((p) => (Number(p.flags) & FLAGS.ACTIVE) !== 0)
          .map((p) => p.wallet.toLowerCase())
      );

      for (const [key, action] of state.actions.entries()) {
        if (!alivePlayers.has(action.playerAddress.toLowerCase())) {
          state.actions.delete(key);
        }
      }

      if (state.actions.size === 0) return;

      const allActions = [...state.actions.values()];
      const knownMafia = getKnownMafia(roomId);
      const expectedAliveMafia = [...knownMafia].filter((addr) => alivePlayers.has(addr)).length;
      const killTarget = calculateMafiaConsensus(allActions, expectedAliveMafia);
      const healTarget = getDoctorHeal(allActions);

      for (const action of allActions) {
        if (action.actionType === 'check') {
          storeInvestigationProof(roomId, action.playerAddress, action.targetAddress);
        }
      }

      console.log(
        `[auto-resolve] Room ${roomId}: kill=${killTarget}, heal=${healTarget}, actions=${allActions.length}`
      );

      state.resolved = true;
      await resolveNight(roomId, killTarget, healTarget);
      clearNightState(roomId);
    } catch (err: any) {
      console.error('[auto-resolve] Error:', err?.message || err);
      const state = getNightState(roomId);
      if (state) state.resolved = false;
    }
  }, AUTO_RESOLVE_IDLE_MS);

  autoResolveTimers.set(roomId, timer);
};

// ─── Health ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    gm: GM_ADDRESS,
    diamond: DIAMOND_ADDRESS,
    activeRooms: getAllNightStates().size,
    uptime: process.uptime(),
  });
});

// ─── Investigation Proof (GM-verified) ───────────────────
app.post('/investigation-proof', async (req, res) => {
  try {
    const { roomId, detectiveAddress, targetAddress, signature, signerAddress } = req.body;

    if (!roomId || !detectiveAddress || !targetAddress || !signature) {
      return res.status(400).json({ error: 'Missing fields: roomId, detectiveAddress, targetAddress, signature' });
    }

    const rid = BigInt(roomId);
    const detective = (detectiveAddress as string).toLowerCase() as Address;
    const target = (targetAddress as string).toLowerCase() as Address;
    const signer = ((signerAddress as string | undefined) || detectiveAddress).toLowerCase() as Address;
    const message = `investigate:${roomId}:${targetAddress}`;

    const valid = await verifyMessage({
      address: signer,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (signer !== detective) {
      const sk = await getSessionKey(detective);
      const nowSec = Math.floor(Date.now() / 1000);
      const sessionRoomId = BigInt(sk.roomId);

      if (
        !sk.isActive ||
        sk.sessionAddress.toLowerCase() !== signer ||
        Number(sk.expiresAt) <= nowSec ||
        sessionRoomId !== rid
      ) {
        return res.status(401).json({ error: 'Invalid session signer' });
      }
    }

    const proof = getInvestigationProof(rid, detective);
    if (!proof) {
      return res.status(403).json({ error: 'No detective proof found for this room/night' });
    }

    if (proof.targetAddress.toLowerCase() !== target) {
      return res.status(403).json({ error: 'Investigation target mismatch' });
    }

    return res.json({ ok: true, source: 'gm-proof', targetAddress: proof.targetAddress, timestamp: proof.timestamp });
  } catch (err: any) {
    console.error('[investigation-proof] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Investigation proof check failed' });
  }
});

// ─── Sync Role Commit (trusted by tx receipt) ────────────
// Frontend calls this right after commitRole/commitAndConfirmRole tx.
// We trust only on-chain event data from the tx receipt block.
app.post('/role-commit-sync', async (req, res) => {
  try {
    const { roomId, playerAddress, txHash, signature, signerAddress } = req.body;

    if (!roomId || !playerAddress || !txHash || !signature) {
      return res.status(400).json({ error: 'Missing fields: roomId, playerAddress, txHash, signature' });
    }

    const rid = BigInt(roomId);
    const player = (playerAddress as string).toLowerCase() as Address;
    const signer = ((signerAddress as string | undefined) || (playerAddress as string)).toLowerCase() as Address;
    const msg = `sync-role-commit:${roomId}:${txHash}`;

    const valid = await verifyMessage({
      address: signer,
      message: msg,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    if (signer !== player) {
      const sk = await getSessionKey(player);
      const nowSec = Math.floor(Date.now() / 1000);
      const sessionRoomId = BigInt(sk.roomId);

      if (
        !sk.isActive ||
        sk.sessionAddress.toLowerCase() !== signer ||
        Number(sk.expiresAt) <= nowSec ||
        sessionRoomId !== rid
      ) {
        return res.status(401).json({ error: 'Invalid session signer' });
      }
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as Hash });
    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Commit transaction failed on-chain' });
    }

    const logs = await publicClient.getLogs({
      address: DIAMOND_ADDRESS,
      event: parseAbiItem('event RoleCommitted(uint256 indexed roomId, address player, bytes32 commitHash)'),
      args: { roomId: rid },
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
    });

    const matched = logs.find(
      (l) =>
        l.transactionHash?.toLowerCase() === (txHash as string).toLowerCase() &&
        l.args.player?.toLowerCase() === player
    );

    if (!matched?.args.commitHash) {
      return res.status(404).json({ error: 'RoleCommitted event not found for this player/tx' });
    }

    setCachedRoleCommit(rid, player, matched.args.commitHash as string);
    return res.json({ ok: true, commitHash: matched.args.commitHash });
  } catch (err: any) {
    console.error('[role-commit-sync] Error:', err.message);
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
});

// ─── Submit Night Action ──────────────────────────────────
// Players call this instead of on-chain commitNightAction
app.post('/night-action', async (req, res) => {
  try {
    const { roomId, playerAddress, actionType, targetAddress, signature, signerAddress, role, salt } = req.body;

    // Validate inputs
    if (!roomId || !playerAddress || !actionType || !targetAddress || !signature) {
      return res.status(400).json({ error: 'Missing fields: roomId, playerAddress, actionType, targetAddress, signature' });
    }

    if (!['kill', 'heal', 'check'].includes(actionType)) {
      return res.status(400).json({ error: 'actionType must be: kill, heal, check' });
    }

    const rid = BigInt(roomId);

    // 1. Verify room is in NIGHT phase & uses GM mode
    const room = await getRoom(rid);
    if (room.phase !== GamePhase.NIGHT) {
      return res.status(400).json({ error: 'Room is not in NIGHT phase' });
    }

    // 2. Verify player is in the room and alive
    const players = await getPlayers(rid);
    const player = players.find(
      (p) => p.wallet.toLowerCase() === (playerAddress as string).toLowerCase()
    );
    if (!player) {
      return res.status(400).json({ error: 'Player not in room' });
    }
    if (!(Number(player.flags) & FLAGS.ACTIVE)) {
      return res.status(400).json({ error: 'Player is dead' });
    }

    // 3. Verify the target is valid
    const target = players.find(
      (p) => p.wallet.toLowerCase() === (targetAddress as string).toLowerCase()
    );
    if (!target) {
      return res.status(400).json({ error: 'Target not in room' });
    }
    if (actionType === 'kill' && !(Number(target.flags) & FLAGS.ACTIVE)) {
      return res.status(400).json({ error: 'Cannot kill dead player' });
    }
    if (actionType === 'kill' && (playerAddress as string).toLowerCase() === (targetAddress as string).toLowerCase()) {
      return res.status(400).json({ error: 'Cannot target yourself' });
    }

    // 4. Verify signature FIRST (before role check to prevent role enumeration)
    // Supports main-wallet signatures and session-key signatures bound to main wallet.
    const signer = ((signerAddress as string | undefined) || (playerAddress as string)).toLowerCase() as Address;
    const message = `night:${roomId}:${actionType}:${targetAddress}`;
    const valid = await verifyMessage({
      address: signer,
      message,
      signature: signature as `0x${string}`,
    });

    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // If signed by session key, ensure this signer is the active session key of playerAddress
    if (signer !== (playerAddress as string).toLowerCase()) {
      const sk = await getSessionKey(playerAddress as Address);
      const nowSec = Math.floor(Date.now() / 1000);
      const sessionRoomId = BigInt(sk.roomId);

      if (
        !sk.isActive ||
        sk.sessionAddress.toLowerCase() !== signer ||
        Number(sk.expiresAt) <= nowSec ||
        sessionRoomId !== rid
      ) {
        return res.status(401).json({ error: 'Invalid session signer' });
      }
    }

    // 5. Verify role proof matches the committed role hash (only after signature is proven)
    // Hidden-role model: playerRoles is usually unrevealed during gameplay.
    const requiredRole = ACTION_TO_ROLE[actionType];
    const roleNum = Number(role);
    const roleSalt = typeof salt === 'string' ? salt : '';

    if (!Number.isFinite(roleNum) || !roleSalt) {
      return res.status(400).json({ error: 'Missing role proof fields: role, salt' });
    }
    if (roleNum !== requiredRole) {
      return res.status(403).json({ error: 'You cannot perform this action' });
    }

    const calculatedHash = keccak256(
      encodeAbiParameters(
        [{ type: 'uint8' }, { type: 'string' }],
        [roleNum, roleSalt]
      )
    );

    const committedHash = await getRoleCommit(rid, playerAddress as Address);
    if (!committedHash) {
      return res.status(403).json({ error: 'Role commit not found. Please re-commit role and try again.' });
    }

    if (calculatedHash.toLowerCase() !== committedHash.toLowerCase()) {
      return res.status(403).json({ error: 'Invalid role proof' });
    }

    // Build trusted mafia set from successfully verified kill actions.
    if (actionType === 'kill' && roleNum === ACTION_TO_ROLE.kill) {
      markKnownMafia(rid, playerAddress as Address);
    }

    // 6. Store the action
    const state = getOrCreateNightState(rid);
    if (state.resolved) {
      return res.status(400).json({ error: 'Night already resolved' });
    }

    const action: NightAction = {
      playerAddress: playerAddress as Address,
      actionType,
      targetAddress: targetAddress as Address,
      timestamp: Date.now(),
    };

    state.actions.set((playerAddress as string).toLowerCase(), action);

    // Debounced auto-resolve: if no new actions arrive for N ms, resolve night early.
    scheduleAutoResolve(rid);

    console.log(
      `[night] Room ${roomId}: ${player.nickname} (${actionType}) → ${target.nickname} | ${state.actions.size} actions total`
    );

    return res.json({
      ok: true,
      actionsReceived: state.actions.size,
    });
  } catch (err: any) {
    console.error('[night-action] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Resolve Night ────────────────────────────────────────
// Called by frontend or auto-triggered when all actions are in
app.post('/resolve-night', async (req, res) => {
  try {
    const { roomId, signature, callerAddress } = req.body;
    if (!roomId) return res.status(400).json({ error: 'Missing roomId' });

    // Only GM or authenticated caller can trigger resolve
    if (!signature || !callerAddress) {
      return res.status(401).json({ error: 'Missing signature or callerAddress' });
    }

    const resolveMsg = `resolve-night:${roomId}`;
    const validSig = await verifyMessage({
      address: callerAddress as Address,
      message: resolveMsg,
      signature: signature as `0x${string}`,
    });
    if (!validSig) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const rid = BigInt(roomId);
    const state = getNightState(rid);

    if (!state || state.actions.size === 0) {
      return res.status(400).json({ error: 'No night actions submitted' });
    }
    if (state.resolved) {
      return res.status(400).json({ error: 'Night already resolved' });
    }

    // Verify room is still in NIGHT phase
    const room = await getRoom(rid);
    if (room.phase !== GamePhase.NIGHT) {
      return res.status(400).json({ error: 'Room is not in NIGHT phase' });
    }

    // Prune stale actions from dead/removed players.
    // This prevents dead mafia actions from poisoning consensus in subsequent nights.
    const players = await getPlayers(rid);
    const alivePlayers = new Set(
      players
        .filter((p) => (Number(p.flags) & FLAGS.ACTIVE) !== 0)
        .map((p) => p.wallet.toLowerCase())
    );

    for (const [key, action] of state.actions.entries()) {
      if (!alivePlayers.has(action.playerAddress.toLowerCase())) {
        state.actions.delete(key);
      }
    }

    if (state.actions.size === 0) {
      return res.status(400).json({ error: 'No valid night actions from alive players' });
    }

    // Calculate consensus
    const allActions = [...state.actions.values()];
    const knownMafia = getKnownMafia(rid);
    const expectedAliveMafia = [...knownMafia].filter((addr) => alivePlayers.has(addr)).length;
    const killTarget = calculateMafiaConsensus(allActions, expectedAliveMafia);
    const healTarget = getDoctorHeal(allActions);

    for (const action of allActions) {
      if (action.actionType === 'check') {
        storeInvestigationProof(rid, action.playerAddress, action.targetAddress);
      }
    }

    console.log(
      `[resolve] Room ${roomId}: kill=${killTarget}, heal=${healTarget}, actions=${allActions.length}`
    );

    // Submit to contract
    state.resolved = true;
    const { hash } = await resolveNight(rid, killTarget, healTarget);

    // Clean up
    clearNightState(rid);
    const pendingTimer = autoResolveTimers.get(rid);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      autoResolveTimers.delete(rid);
    }

    return res.json({
      ok: true,
      txHash: hash,
      killTarget,
      healTarget,
    });
  } catch (err: any) {
    console.error('[resolve-night] Error:', err.message);
    // Reset resolved flag if tx fails
    const rid = BigInt(req.body.roomId);
    const state = getNightState(rid);
    if (state) state.resolved = false;
    return res.status(500).json({ error: err.message });
  }
});

// ─── Get Night Status ─────────────────────────────────────
// Frontend polls this to check how many actions are in
app.get('/night-status/:roomId', (req, res) => {
  const rid = BigInt(req.params.roomId);
  const state = getNightState(rid);

  if (!state) {
    return res.json({ active: false, actionsReceived: 0 });
  }

  return res.json({
    active: true,
    actionsReceived: state.actions.size,
    resolved: state.resolved,
    startedAt: state.nightStartedAt,
    // Don't leak action types — only the count
  });
});

// ─── Get Room Info (convenience proxy) ────────────────────
app.get('/room/:roomId', async (req, res) => {
  try {
    const rid = BigInt(req.params.roomId);
    const [room, players] = await Promise.all([getRoom(rid), getPlayers(rid)]);
    return res.json({
      room: {
        id: Number(room.id),
        host: room.host,
        name: room.name,
        phase: room.phase,
        phaseLabel: ['LOBBY', 'SHUFFLING', 'REVEAL', 'DAY', 'VOTING', 'NIGHT', 'ENDED'][room.phase],
        maxPlayers: room.maxPlayers,
        playersCount: room.playersCount,
        aliveCount: room.aliveCount,
        dayCount: room.dayCount,
      },
      players: players.map((p) => ({
        wallet: p.wallet,
        nickname: p.nickname,
        active: !!(Number(p.flags) & FLAGS.ACTIVE),
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎭 Mafia GM Server running on port ${PORT}`);
  console.log(`   GM Address: ${GM_ADDRESS}`);
  console.log(`   Diamond:    ${DIAMOND_ADDRESS}`);
  console.log(`   Health:     http://0.0.0.0:${PORT}/health\n`);
});
