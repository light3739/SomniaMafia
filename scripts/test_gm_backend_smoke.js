/* eslint-disable no-console */

const BASE_URL = process.env.GM_SERVER_URL || 'https://mafia-voice.serveminecraft.net/gm';

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function expectStatus(label, response, expectedStatus) {
  if (response.status !== expectedStatus) {
    const payload = await safeJson(response);
    throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}. payload=${JSON.stringify(payload)}`);
  }
}

async function main() {
  console.log(`[gm-smoke] Base URL: ${BASE_URL}`);

  const healthRes = await fetch(`${BASE_URL}/health`);
  await expectStatus('health', healthRes, 200);
  const health = await healthRes.json();
  if (!health || health.status !== 'ok') {
    throw new Error(`health: expected status=ok, got ${JSON.stringify(health)}`);
  }
  console.log('[gm-smoke] ✓ GET /health -> ok');

  const nightActionRes = await fetch(`${BASE_URL}/night-action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  await expectStatus('night-action validation', nightActionRes, 400);
  console.log('[gm-smoke] ✓ POST /night-action invalid payload -> 400');

  const resolveNightRes = await fetch(`${BASE_URL}/resolve-night`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  await expectStatus('resolve-night validation', resolveNightRes, 400);
  console.log('[gm-smoke] ✓ POST /resolve-night invalid payload -> 400');

  console.log('[gm-smoke] All backend smoke checks passed');
}

main().catch((err) => {
  console.error('[gm-smoke] FAILED:', err.message);
  process.exit(1);
});
