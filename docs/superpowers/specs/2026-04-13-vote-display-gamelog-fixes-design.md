# Design: Vote Display & GameLog Reliability Fixes

**Date:** 2026-04-13
**Scope:** Frontend only — 2 files, 3 targeted changes
**Status:** Approved

---

## Problem Summary

Three bugs observed during live gameplay on Somnia mainnet:

1. **Vote arrows don't appear** during voting phase — `voteMap` is only updated from blockchain `VoteCast` events polled by `pollEvents`. When `pollEvents` skips a cycle (block regression), vote arrows never update.

2. **Block regression causes skipped cycles** — when the RPC load balancer hits a lagging node and returns a block number 1–2 behind `lastProcessedBlockRef`, the entire `pollEvents` cycle is skipped. On Somnia with WS connected, the poll interval is 5s — a skipped cycle means up to 10s of missed `VoteCast` events.

3. **"Waiting for events..." during voting results overlay** — when `showVotingResults` fires while logs haven't fully arrived yet, `actualLoggedDay` returns `1` (fallback). `lockedVotingDayRef` gets locked to `1` instead of the actual current day. Since the lock is fixed for the entire overlay duration (5+3s), even when correct logs arrive, `targetDay` stays wrong → `dayStartIdx === -1` → empty state → "Waiting for events..." for the full overlay.

---

## Root Causes

### A — `voteMap` not updated from WS server logs
**File:** `hooks/game/useEventPoller.ts` — WS `log` handler

The GM server already:
- Writes `PLAYER_VOTED` log with `voterAddress` + `targetAddress` in `eventData` (logListener.ts:140–145)
- Immediately pushes it to all room clients via `{ type: 'log', data: logEntry }` WS broadcast (logListener.ts:274)

The client receives this WS `log` event and calls `addLogs([log])` — but never calls `setVoteMap`. Vote arrows depend exclusively on the blockchain `VoteCast` handler in `pollEvents`, which is subject to block regression delays and poll intervals.

### B — Block regression hard-skips pollEvents cycle
**File:** `hooks/game/useEventPoller.ts` — `pollEvents`, lines 136–139

When `currentBlock < lastProcessedBlockRef.current`, the entire cycle returns early. On Somnia with load-balanced RPC, 1-block regressions are common. With WS connected (5s poll interval), one skipped cycle = up to 10s delay for blockchain-derived updates.

The correct behavior for small regressions (≤ 5 blocks, typical RPC lag): reset `lastProcessedBlockRef` to `currentBlock` and continue. The `processedEventsRef` Set deduplicates any events already processed in prior cycles. Large regressions (> 5 blocks) should still skip — they may indicate a genuine reorg or major RPC issue.

### C — `lockedVotingDayRef` locks to wrong day
**File:** `components/game/GameLog.tsx` — lines 146–147

```ts
if (showVotingResults && !prevShowVotingResultsRef.current) {
    lockedVotingDayRef.current = actualLoggedDay;  // may be 1 (fallback)
}
```

`actualLoggedDay` scans logs for the last `DayStarted` entry. If logs haven't arrived yet (WS auth rejection at start causing 5s gap, or slow pollServerLogs response), it returns `1`. The lock stays at `1` for the entire overlay duration — even after correct logs arrive.

`dayCount` (from `gameState.dayCount`, sourced from on-chain state via `fetchGameData`) is always current and unaffected by log delivery timing. Using `Math.max(actualLoggedDay, dayCount)` as the lock value ensures the lock is at least at the correct current day.

---

## Solution: 3 Targeted Changes in 2 Files

### Fix A — Read voteMap from WS PLAYER_VOTED log
**File:** `hooks/game/useEventPoller.ts` — inside the WS `'log'` handler

When the incoming `log` has `eventType === 'PLAYER_VOTED'` and `eventData` contains `voterAddress`/`targetAddress`, call `setVoteMap` immediately. Vote arrows appear as soon as the WS log event arrives, independent of blockchain polling.

```
Server detects VoteCast on chain
  → writes PLAYER_VOTED log with voterAddress + targetAddress
  → pushes via WS { type: 'log', data: logEntry }
  → client addLogs([log])                     ← vote text in GameLog
  → client setVoteMap(voter → target)         ← vote arrow on player circles  ← NEW
```

The blockchain `VoteCast` handler in `pollEvents` retains its `setVoteMap` call as a fallback. Deduplication is handled by `processedEventsRef` (blockchain) and `addLogs` Map (server logs).

### Fix B — Block regression tolerance
**File:** `hooks/game/useEventPoller.ts` — `pollEvents` lines 136–138

Replace hard skip with tolerance-based handling:

```ts
// BEFORE:
if (currentBlock < lastProcessedBlockRef.current) {
    console.warn(`...Skipping cycle.`);
    return;
}

// AFTER:
const REGRESSION_TOLERANCE = 5n;
if (currentBlock < lastProcessedBlockRef.current) {
    if (lastProcessedBlockRef.current - currentBlock <= REGRESSION_TOLERANCE) {
        // Common RPC load balancer lag — reset and re-scan from current block.
        // processedEventsRef deduplicates any already-handled events.
        console.warn(`[EventPoller] Block regression by ${lastProcessedBlockRef.current - currentBlock}. Re-scanning from ${currentBlock}.`);
        lastProcessedBlockRef.current = currentBlock;
    } else {
        // Large regression — potential reorg or major RPC issue. Skip.
        console.warn(`[EventPoller] Block regression: RPC returned ${currentBlock}, expected >= ${lastProcessedBlockRef.current}. Skipping.`);
        return;
    }
}
```

### Fix C — Lock correct day in GameLog
**File:** `components/game/GameLog.tsx` — line 147

```ts
// BEFORE:
lockedVotingDayRef.current = actualLoggedDay;

// AFTER:
lockedVotingDayRef.current = Math.max(actualLoggedDay, dayCount || 1);
```

---

## Files Changed

| File | Change | Fixes |
|------|--------|-------|
| `hooks/game/useEventPoller.ts` | Update `voteMap` from WS `PLAYER_VOTED` log | A |
| `hooks/game/useEventPoller.ts` | Block regression tolerance (≤5 blocks reset, >5 skip) | B |
| `components/game/GameLog.tsx` | Lock `lockedVotingDayRef` to `Math.max(actualLoggedDay, dayCount)` | C |

---

## What Is NOT Changed

- GM server — no changes needed (already sends correct data)
- WebSocket protocol — no new event types
- `pollEvents` overall structure — only the regression guard changes
- `pollServerLogs` — unchanged
- All other frontend components — untouched

---

## Risk Assessment

**Low risk. All three changes are defensive:**
- Fix A: adds `setVoteMap` call in existing WS handler path — additive only
- Fix B: changes skip→reset for small regressions; deduplication absorbs re-processed events
- Fix C: `Math.max` can only produce a value ≥ current `actualLoggedDay` — never worse than before

---

## Success Criteria

- Vote arrows appear within 1s of a player casting a vote (via WS, not blockchain poll)
- Block regression log still appears but no longer causes skipped VoteCast processing
- During voting results overlay, GameLog shows correct day's events even when logs arrived late
- "Waiting for events..." does not persist for an entire day/phase
