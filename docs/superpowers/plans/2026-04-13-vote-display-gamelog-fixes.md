# Vote Display & GameLog Reliability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix vote arrows appearing late/never (voteMap not updated from WS), block regression causing skipped VoteCast cycles, and "Waiting for events..." persisting during voting results overlay.

**Architecture:** 3 surgical edits in 2 files. No server changes. No new abstractions. Each fix is independently deployable.

**Tech Stack:** React 18, Next.js 14, TypeScript, WebSocket singleton `gmWs`

---

## Files Changed

| File | What changes |
|------|-------------|
| `hooks/game/useEventPoller.ts` | (1) Update `voteMap` from WS `PLAYER_VOTED` log; (2) Block regression tolerance |
| `components/game/GameLog.tsx` | Lock `lockedVotingDayRef` to `Math.max(actualLoggedDay, dayCount)` |

---

## Task 1: Update voteMap from WS PLAYER_VOTED log

**Why:** The GM server already includes `voterAddress` and `targetAddress` in the `PLAYER_VOTED` log `eventData`, and immediately pushes it to all room clients via the WS `log` event. The client receives it but only calls `addLogs` — never `setVoteMap`. Vote arrows depend entirely on blockchain `VoteCast` events from `pollEvents`, which can be delayed by block regression or poll intervals (5s when WS connected).

**Fix:** In the WS `log` handler, when `log.eventType === 'PLAYER_VOTED'` and both address fields are present, call `setVoteMap` immediately. Vote arrows will appear as soon as the WS event arrives.

**Files:**
- Modify: `hooks/game/useEventPoller.ts` lines 432–472

- [ ] **Step 1: Open `hooks/game/useEventPoller.ts` and locate the WS `log` handler**

Find this block (around line 432):
```ts
    const wsHandlers = useMemo(() => ({
        'log': (data: unknown) => {
            const log = data as LogEntry;
            if (log && log.message) {
                addLogs([log]);
            }
            // Trigger voting results overlay from the VotingFinalized LOG arrival
            // rather than from the 'player-update' event. This guarantees all
            // preceding VoteCast 'log' messages have already been received (WS is
            // ordered) and their addLogs calls are batched with this one by React,
            // so gameState.logs contains every vote when the overlay first renders.
            // Dedup by log ID: watchContractEvent re-deliveries or parallel server
            // instances can re-broadcast the same log — ignore exact duplicates.
            if (log?.eventType === 'VOTING_RESULT' && log.id && log.id !== lastVotingResultLogIdRef.current) {
                lastVotingResultLogIdRef.current = log.id;
                triggerVotingResultsOverlay();
            }
        },
```

- [ ] **Step 2: Add `setVoteMap` call inside the `log` handler, after `addLogs`**

Replace the `'log'` handler with:
```ts
        'log': (data: unknown) => {
            const log = data as LogEntry;
            if (log && log.message) {
                addLogs([log]);
            }
            // Update vote arrows immediately from WS server log.
            // The GM server includes voterAddress + targetAddress in PLAYER_VOTED
            // eventData and pushes this log via WS as soon as VoteCast fires on-chain.
            // This makes vote arrows appear via WS rather than waiting for pollEvents
            // (which runs every 5s when WS connected and can be delayed by block regression).
            if (
                log?.eventType === 'PLAYER_VOTED' &&
                log.eventData?.voterAddress &&
                log.eventData?.targetAddress
            ) {
                const voter = (log.eventData.voterAddress as string).toLowerCase();
                const target = (log.eventData.targetAddress as string).toLowerCase();
                setVoteMap(prev => ({ ...prev, [voter]: target }));
            }
            // Trigger voting results overlay from the VotingFinalized LOG arrival
            // rather than from the 'player-update' event. This guarantees all
            // preceding VoteCast 'log' messages have already been received (WS is
            // ordered) and their addLogs calls are batched with this one by React,
            // so gameState.logs contains every vote when the overlay first renders.
            // Dedup by log ID: watchContractEvent re-deliveries or parallel server
            // instances can re-broadcast the same log — ignore exact duplicates.
            if (log?.eventType === 'VOTING_RESULT' && log.id && log.id !== lastVotingResultLogIdRef.current) {
                lastVotingResultLogIdRef.current = log.id;
                triggerVotingResultsOverlay();
            }
        },
```

- [ ] **Step 3: Add `setVoteMap` to the `wsHandlers` useMemo dependency array**

Find the closing of the `wsHandlers` useMemo (around line 470):
```ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addLogs, dataSync, refs, handleIncomingMafiaSignal, triggerVotingResultsOverlay]);
```

Replace with:
```ts
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addLogs, dataSync, refs, handleIncomingMafiaSignal, triggerVotingResultsOverlay, setVoteMap]);
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
cd /c/Users/Haiman/Downloads/osmnia/SomniaMafia
npx tsc --noEmit
```

Expected: no errors related to `useEventPoller.ts`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Haiman/Downloads/osmnia/SomniaMafia
git add hooks/game/useEventPoller.ts
git commit -m "fix: update voteMap from WS PLAYER_VOTED log immediately

GM server already pushes PLAYER_VOTED with voterAddress+targetAddress
via WS log event. Client was only calling addLogs, never setVoteMap.
Vote arrows now appear on WS delivery instead of waiting for pollEvents
(5s interval when WS connected, subject to block regression)."
```

---

## Task 2: Block regression tolerance in pollEvents

**Why:** When RPC load balancer returns a block number 1–2 behind `lastProcessedBlockRef.current`, the entire `pollEvents` cycle is skipped (hard return at line 138). On Somnia with WS connected, poll interval is 5s — one skipped cycle means up to 10s of missed `VoteCast` and other blockchain events. 1–5 block regressions are normal RPC lag; they should reset the ref and continue. Larger regressions (>5 blocks) still skip — potential reorg.

**Files:**
- Modify: `hooks/game/useEventPoller.ts` lines 136–139

- [ ] **Step 1: Open `hooks/game/useEventPoller.ts` and locate the block regression guard**

Find this block (around line 135):
```ts
            const currentBlock = await pClient.getBlockNumber();
            if (currentBlock < lastProcessedBlockRef.current) {
                console.warn(`[EventPoller] Block regression: RPC returned ${currentBlock}, expected >= ${lastProcessedBlockRef.current}. Skipping cycle.`);
                return;
            }
```

- [ ] **Step 2: Replace with tolerance-based handling**

Replace the block above with:
```ts
            const currentBlock = await pClient.getBlockNumber();
            if (currentBlock < lastProcessedBlockRef.current) {
                const regression = lastProcessedBlockRef.current - currentBlock;
                if (regression <= 5n) {
                    // Common RPC load balancer lag (different nodes 1-5 blocks apart).
                    // Reset ref to current block and continue — processedEventsRef
                    // deduplicates any events already handled in prior cycles.
                    console.warn(`[EventPoller] Block regression by ${regression} block(s), re-scanning from ${currentBlock}.`);
                    lastProcessedBlockRef.current = currentBlock;
                } else {
                    // Large regression — potential reorg or major RPC issue. Skip cycle.
                    console.warn(`[EventPoller] Block regression: RPC returned ${currentBlock}, expected >= ${lastProcessedBlockRef.current}. Skipping cycle.`);
                    return;
                }
            }
```

- [ ] **Step 3: Verify TypeScript compiles without errors**

```bash
cd /c/Users/Haiman/Downloads/osmnia/SomniaMafia
npx tsc --noEmit
```

Expected: no errors related to `useEventPoller.ts`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Haiman/Downloads/osmnia/SomniaMafia
git add hooks/game/useEventPoller.ts
git commit -m "fix: tolerate small block regressions in pollEvents instead of skipping

RPC load balancers on Somnia routinely return blocks 1-5 behind
lastProcessedBlockRef (different nodes at different heights).
Previously this skipped the entire cycle — up to 10s of missed events
when WS connected (5s poll). Now resets ref and continues; processedEventsRef
deduplicates re-processed events. Regressions >5 blocks still skip."
```

---

## Task 3: Lock correct day in GameLog voting results overlay

**Why:** When `showVotingResults` transitions to `true`, `lockedVotingDayRef` is set to `actualLoggedDay`. If logs haven't fully arrived yet (e.g., after a WS auth rejection at game start causing a 5s gap), `actualLoggedDay` returns `1` (fallback — no `DayStarted` log found). The lock stays at `1` for the entire 8s overlay. Even when correct logs arrive, `targetDay=1`, `dayStartIdx` finds the wrong day's marker → `dayEvents` is empty → "Waiting for events..." for the full overlay.

`dayCount` (from `gameState.dayCount`, sourced from on-chain `fetchGameData`) is always current and unaffected by log delivery timing. Locking to `Math.max(actualLoggedDay, dayCount)` ensures the lock is at least the correct current day.

**Files:**
- Modify: `components/game/GameLog.tsx` line 147

- [ ] **Step 1: Open `components/game/GameLog.tsx` and locate the voting day lock**

Find this block (around line 143):
```ts
    // Lock the day synchronously during render to avoid the useEffect timing gap.
    const lockedVotingDayRef = React.useRef<number>(0);
    const prevShowVotingResultsRef = React.useRef(false);
    if (showVotingResults && !prevShowVotingResultsRef.current) {
        lockedVotingDayRef.current = actualLoggedDay;
    } else if (!showVotingResults) {
        lockedVotingDayRef.current = 0;
    }
    prevShowVotingResultsRef.current = showVotingResults;
```

- [ ] **Step 2: Change the lock assignment to use Math.max**

Replace only the lock assignment line:
```ts
        lockedVotingDayRef.current = actualLoggedDay;
```

With:
```ts
        // Use dayCount as floor: if logs haven't arrived yet, actualLoggedDay
        // returns 1 (fallback). dayCount from on-chain state is always current.
        lockedVotingDayRef.current = Math.max(actualLoggedDay, dayCount || 1);
```

- [ ] **Step 3: Verify the full block now looks like this**

After the edit the block should read:
```ts
    // Lock the day synchronously during render to avoid the useEffect timing gap.
    const lockedVotingDayRef = React.useRef<number>(0);
    const prevShowVotingResultsRef = React.useRef(false);
    if (showVotingResults && !prevShowVotingResultsRef.current) {
        // Use dayCount as floor: if logs haven't arrived yet, actualLoggedDay
        // returns 1 (fallback). dayCount from on-chain state is always current.
        lockedVotingDayRef.current = Math.max(actualLoggedDay, dayCount || 1);
    } else if (!showVotingResults) {
        lockedVotingDayRef.current = 0;
    }
    prevShowVotingResultsRef.current = showVotingResults;
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
cd /c/Users/Haiman/Downloads/osmnia/SomniaMafia
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Haiman/Downloads/osmnia/SomniaMafia
git add components/game/GameLog.tsx
git commit -m "fix: lock voting results day to Math.max(actualLoggedDay, dayCount)

When showVotingResults fires before logs arrive (e.g. after 5s WS auth
gap), actualLoggedDay returns 1 (fallback). Lock was stuck at 1 for
the entire 8s overlay even after correct logs arrived — dayStartIdx
for day 1 found wrong markers, dayEvents empty, 'Waiting for events...'.
dayCount from on-chain state is always current, so Math.max ensures
the lock is never below the actual game day."
```

---

## Task 4: Manual Verification Checklist

These fixes address race conditions that require real game sessions to verify.

- [ ] **Verify Fix A (vote arrows):** During a voting round, cast votes. Vote arrows (connecting voter → target circles) should appear within ~1 second of each vote — not after a 5s delay. Check browser console: no `[EventPoller] Block regression` warnings should be followed by missing vote arrows.

- [ ] **Verify Fix B (block regression):** Watch browser console during gameplay. `Block regression by N block(s), re-scanning from X` should appear instead of `Skipping cycle.` when RPC returns stale block. Vote arrows should not be affected by regressions ≤5 blocks.

- [ ] **Verify Fix C (voting results overlay):** After voting finalization, the GameLog panel inside the overlay should immediately show discussion and vote events — not "Waiting for events...". Brief flash of "Waiting" (< 1s) is acceptable; persisting for the full 8s is not.

---

## Self-Review

**Spec coverage:**
- Fix A (voteMap from WS) → Task 1 ✓
- Fix B (block regression tolerance) → Task 2 ✓
- Fix C (lockedVotingDayRef correct day) → Task 3 ✓

**Placeholder scan:** None found. All steps have exact code.

**Type consistency:**
- `setVoteMap` is `React.Dispatch<React.SetStateAction<Record<string, string>>>` — `prev => ({ ...prev, [voter]: target })` matches ✓
- `regression` is `bigint` (result of `lastProcessedBlockRef.current - currentBlock`, both `bigint`) — compared to `5n` ✓
- `Math.max(actualLoggedDay, dayCount || 1)` — both are `number` (`actualLoggedDay` from `useMemo` returns `number`, `dayCount` prop is `number`) ✓

**Risk:** All 3 changes are low-risk:
- Task 1: additive — existing `addLogs` call unchanged, new `setVoteMap` call is conditional
- Task 2: regression handling is more lenient, not more strict — deduplication absorbs re-processed events
- Task 3: `Math.max` can only produce a value ≥ current `actualLoggedDay` — never worse than before
