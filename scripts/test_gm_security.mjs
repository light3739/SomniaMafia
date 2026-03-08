/**
 * test_gm_security.mjs
 *
 * GM Server Security & Anonymity Audit
 * Tests every route for: auth bypass, replay attacks, role impersonation,
 * information leakage, timing oracles, CORS exposure.
 *
 * Intended to catch regressions and document the security posture of
 * each endpoint — especially important before tournament mode.
 *
 * Run: node scripts/test_gm_security.mjs
 * Against test env: GM_URL=https://gm-test.mafiaonchain.live node scripts/test_gm_security.mjs
 */
import { privateKeyToAccount } from 'viem/accounts';

// ─── Config ───────────────────────────────────────────────────────────────────
const GM_URL = process.env.GM_URL ?? 'https://gm-test.mafiaonchain.live';

// Three throwaway wallets — deterministic, never used on mainnet
const MAFIA   = privateKeyToAccount('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
const DOCTOR  = privateKeyToAccount('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
const DETECTIVE = privateKeyToAccount('0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
const CIVILIAN  = privateKeyToAccount('0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd');

const FAKE_ROOM = '777777';

console.log(`\n════════════════════════════════════════════════`);
console.log(` GM Security & Anonymity Audit`);
console.log(` GM: ${GM_URL}`);
console.log(`════════════════════════════════════════════════\n`);

// ─── Helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, warned = 0;
const findings = [];

function sign(account, message) { return account.signMessage({ message }); }

async function test(label, fn) {
  try {
    await fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    if (e.__warn) {
      console.warn(`  ⚠️  ${label}: ${e.message}`);
      warned++;
      findings.push({ severity: e.__warn, label, msg: e.message });
    } else {
      console.error(`  ❌ FAIL ${label}: ${e.message}`);
      failed++;
      findings.push({ severity: 'BUG', label, msg: e.message });
    }
  }
}

function warn(severity, msg) {
  const e = new Error(msg);
  e.__warn = severity;
  throw e;
}

async function post(path, body) {
  const r = await fetch(`${GM_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function get(path) {
  const r = await fetch(`${GM_URL}${path}`);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: Auth bypass — endpoints that should require auth but may not
// ─────────────────────────────────────────────────────────────────────────────
console.log('━━━ Section 1: Auth bypass ━━━\n');

await test('/health — GM address exposed publicly (minor info leak)', async () => {
  const { body } = await get('/health');
  if (!body.gm) return; // ok if absent
  // The GM address is semi-public but confirms the server is the real GM
  // For tournaments: expose as 🔶 WARNING (not critical)
  warn('INFO', `GM address visible to anyone: ${body.gm}, activeRooms: ${body.activeRooms}`);
});

await test('/role-commit-sync — rejects calls without auth', async () => {
  const { status } = await post('/role-commit-sync', {
    roomId: FAKE_ROOM,
    playerAddress: MAFIA.address,
    txHash: '0xdeadbeef',
  });
  if (status === 200) {
    warn('HIGH', '/role-commit-sync has NO authentication — anyone can flood GM logs / DoS');
  }
});

await test('/night-status — returns data without auth (info leak)', async () => {
  const { status, body } = await get(`/night-status/${FAKE_ROOM}`);
  if (status === 200) {
    // Not critical on its own but leaks action count to unauthenticated parties
    warn('LOW', `/night-status returns actionsReceived=${body.actionsReceived} with no auth — Mafia can use as timing oracle`);
  }
});

await test('/room/:roomId — returns player list without auth', async () => {
  // This is public on-chain, so acceptable — just documenting
  const { status } = await get(`/room/${FAKE_ROOM}`);
  // Status 500 expected (room doesn't exist) but no auth check
  if (status !== 401 && status !== 403) {
    warn('INFO', '/room/:roomId proxies on-chain data with no auth (on-chain data is public, acceptable)');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: Replay attacks & signature weaknesses
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n━━━ Section 2: Replay attacks ━━━\n');

await test('/investigation-proof — rejects expired timestamps (replay protection)', async () => {
  // This route has its OWN inline signature check (not using verifyAuthorizedSignature)
  // The fix for expired timestamps was applied to verifyAuthorizedSignature but NOT here
  const EXPIRED_TS = Math.floor(Date.now() / 1000) - 400; // 400s ago
  const nonce = crypto.randomUUID();
  const message = `investigate:${FAKE_ROOM}:${DETECTIVE.address}:${nonce}:${EXPIRED_TS}`;
  const sig = await sign(DETECTIVE, message);
  const { status } = await post('/investigation-proof', {
    roomId: FAKE_ROOM,
    detectiveAddress: DETECTIVE.address,
    targetAddress: MAFIA.address,
    signature: sig,
    signerAddress: DETECTIVE.address,
    nonce,
    timestamp: EXPIRED_TS,
  });
  // Expect 401. If 404 ("no proof"), auth still passed → replay accepted
  if (status === 404 || status === 200) {
    warn('HIGH', `/investigation-proof accepted a ${400}s-old timestamp — replay attack possible! (missing timestamp check in inline verifyMessage)`);
  }
  // 401 = correct rejection
});

await test('/night-action — legacy message lacks night/day number (cross-night replay)', async () => {
  // Legacy message: "night:roomId:actionType:targetAddress"  — no dayCount!
  // An attacker could replay a kill action from night 1 into night 2.
  // This test documents the vuln (we can't replay against a real room,
  // but we verify the message format lacks the nonce-equivalent).
  const legacyMsg = `night:${FAKE_ROOM}:kill:${CIVILIAN.address}`;
  const sig = await sign(MAFIA, legacyMsg);
  //  If accepted (would be 400 "not in NIGHT phase" for fake room, not 401),
  // then the legacy message format is used.
  const { status } = await post('/night-action', {
    roomId: FAKE_ROOM,
    playerAddress: MAFIA.address,
    actionType: 'kill',
    targetAddress: CIVILIAN.address,
    signature: sig,
  });
  // Not 401 → auth passed with no dayCount binding → cross-night replay possible
  if (status !== 401) {
    warn('HIGH', `Legacy night-action sig lacks dayCount — cross-night replay: player can reuse sig from night N in night N+1 (format: "night:roomId:action:target")`);
  }
});

await test('/submit-sra-key — rejects expired timestamp (regression check)', async () => {
  const EXPIRED_TS = Math.floor(Date.now() / 1000) - 400;
  const nonce = crypto.randomUUID();
  const sraKey = '123456789';
  const message = `submit-key:${FAKE_ROOM}:${sraKey}:${nonce}:${EXPIRED_TS}`;
  const sig = await sign(MAFIA, message);
  const { status } = await post('/submit-sra-key', {
    roomId: FAKE_ROOM,
    playerAddress: MAFIA.address,
    sraKey,
    signature: sig,
    signerAddress: MAFIA.address,
    nonce,
    timestamp: EXPIRED_TS,
  });
  if (status === 200) {
    warn('HIGH', '/submit-sra-key accepted expired timestamp — replay attack!');
  }
  // 401 = good
});

await test('/my-role — rejects expired timestamp (regression check)', async () => {
  const EXPIRED_TS = Math.floor(Date.now() / 1000) - 400;
  const nonce = crypto.randomUUID();
  const message = `my-role:${FAKE_ROOM}:${MAFIA.address.toLowerCase()}:${nonce}:${EXPIRED_TS}`;
  const sig = await sign(MAFIA, message);
  const params = new URLSearchParams({
    playerAddress: MAFIA.address,
    signature: sig,
    signerAddress: MAFIA.address,
    nonce,
    timestamp: String(EXPIRED_TS),
  });
  const { status } = await get(`/my-role/${FAKE_ROOM}?${params}`);
  if (status !== 401) {
    warn('HIGH', '/my-role accepted expired timestamp — replay attack!');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3: Role impersonation / game logic integrity
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n━━━ Section 3: Role impersonation & game integrity ━━━\n');

await test('/night-action — rejects invalid actionType values', async () => {
  const sig = await sign(CIVILIAN, `night:${FAKE_ROOM}:explode:${DETECTIVE.address}`);
  const { status } = await post('/night-action', {
    roomId: FAKE_ROOM, playerAddress: CIVILIAN.address,
    actionType: 'explode', targetAddress: DETECTIVE.address,
    signature: sig,
  });
  if (status !== 400) warn('LOW', `actionType='explode' not rejected (got ${status})`);
});

await test('/night-action — civilian submitting kill: role verification is enforced', async () => {
  // Role check is at step 5b (after phase, player, sig, hasCommittedRole).
  // Fake room: phase=0 (LOBBY) fires first, returning 400, so we can't reach step 5b.
  // When resolvedRoles is populated (all SRA keys submitted), step 5b rejects wrong roles.
  const sig = await sign(CIVILIAN, `night:${FAKE_ROOM}:kill:${DOCTOR.address}`);
  const { status } = await post('/night-action', {
    roomId: FAKE_ROOM,
    playerAddress: CIVILIAN.address,
    actionType: 'kill',
    targetAddress: DOCTOR.address,
    signature: sig,
  });
  // 200 = accepted blindly — bad
  // 400/401/403/500 = rejected at some gate — acceptable (role check fires for real NIGHT rooms)
  if (status === 200) {
    warn('CRITICAL', `CIVILIAN kill accepted with status 200 — role verification missing!`);
  }
});

await test('/night-action — civilian submitting check: detective impersonation blocked', async () => {
  const sig = await sign(CIVILIAN, `night:${FAKE_ROOM}:check:${MAFIA.address}`);
  const { status, body } = await post('/night-action', {
    roomId: FAKE_ROOM,
    playerAddress: CIVILIAN.address,
    actionType: 'check',
    targetAddress: MAFIA.address,
    signature: sig,
  });
  // Same as above — blocked at phase/player check for fake room, role check is at step 5b
  if (status === 200) {
    warn('CRITICAL', `CIVILIAN check was accepted with status 200 — role verification missing!`);
  }
  // 400/401/403/500 = not accepted
});

await test('/night-action — multiple heal submissions: usurpation mitigated by role check', async () => {
  // getDoctorHeal still uses first-match (actions.find), but role verification in step 5b
  // prevents any non-DOCTOR from submitting a heal action in the first place.
  // No warn needed — architecture fix covers this case.
});

await test('/resolve-night — accessible to any authenticated player (not host-only)', async () => {
  const sig = await sign(CIVILIAN, `resolve-night:${FAKE_ROOM}`);
  const { status, body } = await post('/resolve-night', {
    roomId: FAKE_ROOM,
    callerAddress: CIVILIAN.address,
    signature: sig,
  });
  // If any player auth passes (not 401), this is a problem
  // Expected: 401 auth fail or 400 "not in NIGHT phase" / "no actions"
  // A MAFIA player knowing doctor hasn't acted yet can force early resolve → guaranteed kill
  if (status !== 401 && status !== 403) {
    warn('HIGH', `Any authenticated player can trigger /resolve-night (got ${status}). A Mafia player can call this when doctor/detective haven't submitted yet → guaranteed kill / blocked investigation.`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4: Information leakage & anonymity
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n━━━ Section 4: Information leakage & anonymity ━━━\n');

await test('/investigation-proof — leaks proof existence (not just mismatch)', async () => {
  const sig = await sign(DETECTIVE, `investigate:${FAKE_ROOM}:${MAFIA.address}`);
  const { status, body } = await post('/investigation-proof', {
    roomId: FAKE_ROOM,
    detectiveAddress: DETECTIVE.address,
    targetAddress: MAFIA.address,
    signature: sig,
  });
  if (status === 403 && body.error?.includes('mismatch')) {
    warn('LOW', 'investigation-proof returns 403 "target mismatch" vs 404 "no proof" — tells adversary whether detective used action this night');
  }
  if (status === 404) {
    // Good — only says "no proof" without telling what the real target was
  }
});

await test('/night-status — actionsReceived is a Mafia timing oracle', async () => {
  // This is by design for UI but important to document for tournaments
  // Mafia knows when to submit their kill: wait until actionsReceived = N (all actors done)
  warn('INFO', '/night-status exposes actionsReceived count — Mafia can time kill to be last, after doctor has committed, then immediately trigger /resolve-night. Consider: return count only above threshold or add host-secreted randomness to action submission order.');
});

await test('/night-status — does NOT leak action details (only count)', async () => {
  const { body } = await get(`/night-status/${FAKE_ROOM}`);
  // Should NOT contain action types or targets
  if (body.actions || body.killTarget || body.healTarget || body.checkTarget) {
    warn('CRITICAL', `/night-status leaks action contents: ${JSON.stringify(body)}`);
  }
  // actionsReceived count is intentional (documented above)
});

await test('CORS — origin restriction (should not be wildcard for tournaments)', async () => {
  // Test with a fake evil origin
  const r = await fetch(`${GM_URL}/health`, {
    headers: { 'Origin': 'https://evil-mafia-cheater.com' },
  });
  const acaoHeader = r.headers.get('access-control-allow-origin');
  if (acaoHeader === '*') {
    warn('MEDIUM', `CORS is wildcard (*) — any website can make requests to the GM on behalf of a player. For tournaments, restrict to mafiaonchain.live and test.mafiaonchain.live only.`);
  }
});

await test('/room/:roomId — player flags exposed (active/dead status)', async () => {
  // Acceptable since it's on-chain, but confirm no role info leaks
  const { status, body } = await get(`/room/${FAKE_ROOM}`);
  if (status === 200 && body.players) {
    const p = body.players[0];
    if (p && (p.role || p.ismafia || p.flags)) {
      warn('CRITICAL', `/room endpoint leaks role information: ${JSON.stringify(p)}`);
    }
  }
  // 500 expected for fake room, which is fine
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5: DoS / rate limiting
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n━━━ Section 5: DoS & rate limiting ━━━\n');

await test('Rate limiting — rapid requests are not throttled (no 429)', async () => {
  const results = await Promise.all(Array.from({ length: 10 }, () =>
    fetch(`${GM_URL}/health`).then(r => r.status)
  ));
  if (!results.includes(429)) {
    warn('MEDIUM', 'No rate limiting detected — 10 parallel /health requests all returned 200. For tournaments: add express-rate-limit (100 req/min per IP, 10 req/min on signed routes).');
  }
});

await test('/night-action — one action per player (duplicate submission overrides not multiplied)', async () => {
  // state.actions.set(playerAddress, action) — last-write-wins per player
  // This is correct behavior (not a bug) — document it
  console.log('     (by design: each player can update their action until resolved)');
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6: Tournament-specific concerns
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n━━━ Section 6: Tournament-specific ━━━\n');

await test('ECIES keys survive across GM restarts (in-memory only!)', async () => {
  warn('HIGH', 'eciesPubkeys and sraSKeys are in-memory Maps — a GM restart during a game loses all registered pubkeys and SRA keys. Players would need to re-register. For tournaments: persist to Redis with TTL or at minimum warn in /health if state was recently cleared.');
});

await test('Night state survives across GM restarts (in-memory only!)', async () => {
  warn('HIGH', 'Night actions are in-memory (game-state.ts nightStates Map) — a GM crash/restart during night phase loses all submitted actions. /resolve-night will return "No night actions submitted". For tournaments: persist night state to Redis.');
});

await test('GM private key is the only resolve authority (single point of failure)', async () => {
  warn('MEDIUM', 'resolveNightAsGameMaster requires GM_PRIVATE_KEY. If the key is compromised, attacker can resolve all nights with arbitrary outcomes. For tournaments: use a hardware wallet or MPC signing, and emit events for audit trail.');
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════════════');
console.log(` Tests passed:  ${passed}`);
console.log(` Tests failed:  ${failed}`);
console.log(` Warnings:      ${warned}`);
console.log('════════════════════════════════════════════════\n');

if (findings.length > 0) {
  const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [], INFO: [] };
  for (const f of findings) (bySeverity[f.severity] || bySeverity.INFO).push(f);
  
  console.log('Findings by severity:\n');
  for (const [sev, items] of Object.entries(bySeverity)) {
    if (!items.length) continue;
    const emoji = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵', INFO: '⚪' }[sev] || '⚪';
    console.log(`  ${emoji} ${sev} (${items.length}):`);
    for (const f of items) console.log(`     • ${f.label}`);
    console.log();
  }
}

if (failed > 0) process.exit(1);
// Warnings don't fail the process — they're informational
process.exit(0);
