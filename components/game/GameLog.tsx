import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';

// Module-level cache of strings whose typewriter animation has finished. Lets
// us skip retyping logs when GameLog remounts (e.g. day → night → day) and
// also keeps already-typed entries stable when a brand-new log arrives.
const typedTextCache = new Set<string>();
export const __resetGameLogTypewriterCache = () => typedTextCache.clear();

// ── TypewriterText ────────────────────────────────────────────────────────
const TypewriterText: React.FC<{ text: string; speed?: number; className?: string }> = ({
    text,
    speed = 28,
    className,
}) => {
    const wasShown = typedTextCache.has(text);
    const [displayed, setDisplayed] = useState(wasShown ? text : '');
    const [done, setDone] = useState(wasShown);

    useEffect(() => {
        if (typedTextCache.has(text)) {
            setDisplayed(text);
            setDone(true);
            return;
        }
        setDisplayed('');
        setDone(false);
        let i = 0;
        const interval = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(interval);
                setDone(true);
                typedTextCache.add(text);
            }
        }, speed);
        return () => clearInterval(interval);
    }, [text, speed]);

    return (
        <span className={className}>
            {displayed}
            {!done && (
                <span className="animate-pulse text-[#916A47] opacity-70 ml-[1px]">▌</span>
            )}
        </span>
    );
};

const HighlightedTypewriterText: React.FC<{
    parts: { text: string; className?: string }[];
    speed?: number;
    className?: string;
}> = ({ parts, speed = 28, className }) => {
    const fullText = parts.map(p => p.text).join('');
    const wasShown = typedTextCache.has(fullText);
    const [displayed, setDisplayed] = useState(wasShown ? fullText : '');
    const [done, setDone] = useState(wasShown);

    useEffect(() => {
        if (typedTextCache.has(fullText)) {
            setDisplayed(fullText);
            setDone(true);
            return;
        }
        setDisplayed('');
        setDone(false);
        let i = 0;
        const interval = setInterval(() => {
            i++;
            setDisplayed(fullText.slice(0, i));
            if (i >= fullText.length) {
                clearInterval(interval);
                setDone(true);
                typedTextCache.add(fullText);
            }
        }, speed);
        return () => clearInterval(interval);
    }, [fullText, speed]);

    let currentLen = 0;

    return (
        <span className={className}>
            {parts.map((p, idx) => {
                const start = currentLen;
                const end = start + p.text.length;
                currentLen = end;
                if (displayed.length <= start) return null;
                const partDisplayed = displayed.slice(start, Math.min(displayed.length, end));
                return <span key={idx} className={p.className}>{partDisplayed}</span>;
            })}
            {!done && (
                <span className="animate-pulse text-[#916A47] opacity-70 ml-[1px]">▌</span>
            )}
        </span>
    );
};

interface GameLogProps {
    liveDiscussion?: {
        active?: boolean;
        finished?: boolean;
        currentSpeakerName?: string | null;
    };
    forceVotingActive?: boolean;
    hideActions?: boolean;
}

// Known structured eventType values that the server maps from raw blockchain events.
// Logs with these eventTypes are processed via structured eventData, NOT text parsing.
const KNOWN_EVENT_TYPES = new Set([
    'NIGHT_RESULT', 'DISCUSSION_STARTED', 'PLAYER_SPEAKING', 'DISCUSSION_ENDED',
    'VOTING_STARTED', 'PLAYER_VOTED', 'VOTING_RESULT', 'NIGHT_FALLS', 'SYSTEM_MESSAGE',
]);

export const GameLog: React.FC<GameLogProps> = React.memo(({ liveDiscussion, forceVotingActive = false, hideActions = false }) => {
    const { gameState, showVotingResults } = useGameContext();
    const dayCount = gameState.dayCount;
    const phase = gameState.phase;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const logs = gameState.logs;

    // ─── Determine target day ────────────────────────────────────────────
    // Use server's DayStarted eventData first (structured), then text fallback.
    const actualLoggedDay = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            const l = logs[i];
            // Primary: structured eventData from server
            if (l.eventType === 'DayStarted' && l.eventData?.dayNumber) {
                return Number(l.eventData.dayNumber);
            }
            // Fallback: text match (for client logs or old server format)
            const m = l.message.match(/Day (\d+) has begun/i);
            if (m) return Number(m[1]);
        }
        return 1;
    }, [logs]);

    // Lock the day synchronously during render to avoid the useEffect timing gap.
    const lockedVotingDayRef = React.useRef<number>(0);
    const prevShowVotingResultsRef = React.useRef(false);
    if (showVotingResults && !prevShowVotingResultsRef.current) {
        // Lock to the day whose logs have already arrived (actualLoggedDay).
        // Do NOT use Math.max(actualLoggedDay, dayCount): on Somnia NightStarted
        // fires in the same tx as VotingFinalized (100ms blocks), so dayCount
        // can already be N+1 when showVotingResults first renders. Locking to N+1
        // would make targetDay=N+1, find no DayStarted(N+1), and show
        // "Waiting for events..." for the full 8s overlay.
        lockedVotingDayRef.current = actualLoggedDay;
    } else if (!showVotingResults) {
        lockedVotingDayRef.current = 0;
    }
    prevShowVotingResultsRef.current = showVotingResults;

    const displayDay = (showVotingResults && lockedVotingDayRef.current > 0)
        ? lockedVotingDayRef.current
        : 0;

    // Always target actualLoggedDay — the highest day whose DayStarted log
    // actually EXISTS in the logs array. Using dayCount here caused persistent
    // dayStartIdx=-1: fetchGameData reads dayCount=N+1 from chain BEFORE
    // DayStarted(N+1) log arrives via pollServerLogs/WS, so the search for
    // DayStarted(N+1) fails. Better to show Day N's events until Day N+1's
    // log arrives than to show nothing.
    const targetDay = (showVotingResults && lockedVotingDayRef.current > 0)
        ? lockedVotingDayRef.current
        : (actualLoggedDay || 1);

    // ─── dayEvents: single source of truth from eventType/eventData ──────
    // Scans ALL logs directly instead of relying on todayLogs slice.
    // Uses eventType as primary discriminator, text parsing only for
    // client-only logs (discussion) that have no eventType.
    const dayEvents = useMemo(() => {
        // Resolve a player's current canonical nickname via address — falls back
        // to whatever name was baked into the log if the address is missing or
        // the player has since been removed.
        const resolveName = (addr: string | undefined, fallback: string | undefined): string | undefined => {
            if (addr) {
                const match = gameState.players.find(p => p.address.toLowerCase() === addr.toLowerCase());
                if (match?.name) return match.name;
            }
            return fallback;
        };

        let nightResult: { type: 'safe' | 'killed'; playerName?: string } | null = null;
        let discussionStarted = false;
        let discussionFinished = false;
        let currentSpeaker: string | null = null;
        let votingStarted = false;
        let votingResult: { type: 'eliminated' | 'no_one'; playerName?: string } | null = null;
        let nightFallen = false;
        let voteCasts: { voter: string; target: string }[] = [];

        // 1. Find the current day's start index in the logs array.
        //    Uses both eventType and text matching for robustness.
        //    `dayStartIdx === -1` means the marker for the current day hasn't
        //    arrived yet — we must NOT fall back to scanning prior days.
        let dayStartIdx = -1;
        for (let i = logs.length - 1; i >= 0; i--) {
            const l = logs[i];
            const isDayMatch =
                (l.eventType === 'DayStarted' && Number(l.eventData?.dayNumber) === targetDay) ||
                l.message.match(new RegExp(`Day\\s+${targetDay}\\s+has begun`, 'i'));
            if (isDayMatch) {
                dayStartIdx = i;
                break;
            }
            // Also match "Game started!" as a fallback for Day 1
            if (targetDay === 1 && l.message.toLowerCase().includes('game started')) {
                dayStartIdx = i;
                // Don't break — keep looking for a more specific "Day 1" marker
            }
        }

        // When dayStartIdx === -1 the DayStarted marker for targetDay hasn't
        // arrived yet. Previously this was a hard early-return that blocked ALL
        // downstream processing — including forced states (step 5) and full-log
        // fallback scans (steps 6-7). During the voting-results overlay this
        // caused "Waiting for events..." even when logs HAD the VOTING_RESULT.
        // Now: skip the day-scoped scan (steps 2-3) but let everything else run.
        if (dayStartIdx < 0) {
            console.warn('[GameLog] dayStartIdx=-1 for targetDay', targetDay,
                '| actualLoggedDay', actualLoggedDay, '| dayCount', dayCount,
                '| logsCount', logs.length, '| showVotingResults', showVotingResults,
                '| last 5:', logs.slice(-5).map(l => ({ et: l.eventType, msg: l.message.slice(0, 40), ed: l.eventData })));
        }

        // 2. Search BACKWARDS from dayStartIdx for NIGHT_RESULT.
        //    Night result occurs at the end of the previous night, before the
        //    current day starts. Search up to 15 entries back to handle
        //    interleaved PlayerEliminated / other logs.
        //    Skip when dayStartIdx === -1 (no anchor point to scan from).
        if (targetDay > 1 && dayStartIdx >= 0) {
            for (let i = dayStartIdx - 1; i >= Math.max(0, dayStartIdx - 30); i--) {
                const l = logs[i];
                // Structured path (server eventType)
                if (l.eventType === 'NIGHT_RESULT') {
                    if (l.eventData?.isSafe) nightResult = { type: 'safe' };
                    else if (l.eventData?.isEliminated) nightResult = { type: 'killed', playerName: resolveName(l.eventData.playerAddress, l.eventData.playerName) };
                    break;
                }
                // Text fallback (client log or old format)
                if (!l.eventType || !KNOWN_EVENT_TYPES.has(l.eventType)) {
                    const msg = l.message.toLowerCase();
                    if (msg.includes('night result: no one died')) {
                        nightResult = { type: 'safe' };
                        break;
                    }
                    if (msg.includes('night result:') && msg.includes('was killed')) {
                        const m = l.message.match(/Night Result: (.+?) was killed/i);
                        nightResult = { type: 'killed', playerName: m?.[1] || 'Unknown' };
                        break;
                    }
                }
                // Stop at previous day boundary
                if (l.eventType === 'DayStarted' || l.message.match(/Day\s+\d+\s+has begun/i)) break;
            }
        }

        // 3. Scan from dayStartIdx to end for current day events.
        //    Skip when dayStartIdx === -1 — fallback scans (steps 6-7) will
        //    still recover votingResult and nightResult from the full log array.
        for (let i = dayStartIdx; i >= 0 && i < logs.length; i++) {
            const log = logs[i];

            // ── Structured eventType path (PRIMARY — server is source of truth) ──
            if (log.eventType && KNOWN_EVENT_TYPES.has(log.eventType)) {
                switch (log.eventType) {
                    case 'NIGHT_RESULT':
                        // Can also appear after day start in sorted logs
                        if (log.eventData?.isSafe) nightResult = { type: 'safe' };
                        else if (log.eventData?.isEliminated) nightResult = { type: 'killed', playerName: resolveName(log.eventData.playerAddress, log.eventData.playerName) };
                        break;
                    case 'DISCUSSION_STARTED':
                        discussionStarted = true;
                        discussionFinished = false;
                        break;
                    case 'PLAYER_SPEAKING':
                        currentSpeaker = log.eventData?.playerName || null;
                        break;
                    case 'DISCUSSION_ENDED':
                        discussionFinished = true;
                        break;
                    case 'VOTING_STARTED':
                        votingStarted = true;
                        break;
                    case 'PLAYER_VOTED':
                        if (log.eventData?.playerName && log.eventData?.targetName) {
                            voteCasts.push({ voter: log.eventData.playerName, target: log.eventData.targetName });
                        }
                        break;
                    case 'VOTING_RESULT': {
                        // Defensive: eventData might be {} if server switch fell through
                        if (log.eventData?.isSafe) {
                            votingResult = { type: 'no_one' };
                        } else if (log.eventData?.isEliminated) {
                            votingResult = { type: 'eliminated', playerName: resolveName(log.eventData.playerAddress, log.eventData.playerName) };
                        } else {
                            // eventData is empty/malformed — derive from message text
                            const lower = log.message.toLowerCase();
                            if (lower.includes('no one was eliminated') || lower.includes('no one')) {
                                votingResult = { type: 'no_one' };
                            } else {
                                const vf = log.message.match(/Voting Finalized:\s*(.+?)\s+was eliminated/i);
                                votingResult = { type: 'eliminated', playerName: vf?.[1] || 'A player' };
                            }
                            console.warn('[GameLog] VOTING_RESULT had empty eventData, derived from text:', votingResult);
                        }
                        break;
                    }
                    case 'NIGHT_FALLS':
                        nightFallen = true;
                        break;
                }
                continue; // Skip text parsing for known eventTypes
            }

            // ── Text parsing path (SECONDARY — for client-side logs without eventType) ──
            const msg = log.message;
            const lower = msg.toLowerCase();
            if (lower.includes('night result: no one died')) nightResult = { type: 'safe' };
            else if (lower.includes('night result:') && lower.includes('was killed')) {
                const m = msg.match(/Night Result: (.+?) was killed/i);
                nightResult = { type: 'killed', playerName: m?.[1] || 'Unknown' };
            }
            if (lower.includes('discussion phase started') || lower.includes('discussion starting')) {
                discussionStarted = true;
                discussionFinished = false;
            }
            if (lower.includes('is now speaking')) {
                const m = msg.match(/(.+?) is now speaking/i);
                currentSpeaker = m?.[1] || null;
            }
            if (lower.includes('all players have spoken') ||
                lower.includes('starting vote') ||
                lower.includes('discussion concluded') ||
                lower.includes('proceeding to vote')) {
                discussionFinished = true;
            }
            if (lower.includes('voting phase started')) votingStarted = true;
            if (lower.includes('voted for')) {
                const m = msg.match(/(.+?) voted for (.+)/i);
                if (m) voteCasts.push({ voter: m[1], target: m[2] });
            }
            if (lower.includes('eliminated') && log.type === 'danger' && !lower.includes('night')) {
                const vf = msg.match(/Voting Finalized:\s*(.+?)\s+was eliminated/i);
                if (vf) votingResult = { type: 'eliminated', playerName: vf[1] };
            }
            if (lower.includes('no one was eliminated')) votingResult = { type: 'no_one' };
            if (lower.includes('night has fallen')) nightFallen = true;
        }

        // 4. Live discussion state from DayPhase polling (overrides log-based state)
        if (liveDiscussion?.active) {
            discussionStarted = true;
            discussionFinished = false;
            if (liveDiscussion.currentSpeakerName) currentSpeaker = liveDiscussion.currentSpeakerName;
        } else if (liveDiscussion?.finished) {
            discussionStarted = true;
            discussionFinished = true;
        }

        // 5. Forced states during voting results / post-voting phase.
        //    ALWAYS set these — no conditional on existing state.
        if (showVotingResults || hideActions || forceVotingActive) {
            discussionStarted = true;
            discussionFinished = true;
            votingStarted = true;
        }

        // 5b. Monotonic state enforcement — later events imply earlier ones completed.
        //     This prevents the 1-2s flicker where discussion disappears during
        //     the gap between log arrival and showVotingResults being set.
        if (nightFallen || votingResult) {
            discussionStarted = true;
            discussionFinished = true;
            votingStarted = true;
        }
        if (votingStarted) {
            discussionStarted = true;
            discussionFinished = true;
        }

        // 6. FALLBACK: if forward scan missed votingResult, scan the FULL log array.
        //    Runs UNCONDITIONALLY (not gated by showVotingResults) so it works even
        //    when VotingFinalized was historical and the overlay didn't appear.
        if (!votingResult) {
            for (let i = logs.length - 1; i >= 0; i--) {
                const l = logs[i];
                if (l.eventType === 'VOTING_RESULT') {
                    if (l.eventData?.isSafe) votingResult = { type: 'no_one' };
                    else if (l.eventData?.isEliminated) votingResult = { type: 'eliminated', playerName: resolveName(l.eventData.playerAddress, l.eventData.playerName) };
                    else {
                        // Defensive: derive from message if eventData is empty
                        const lower = l.message.toLowerCase();
                        if (lower.includes('no one')) votingResult = { type: 'no_one' };
                        else {
                            const vf = l.message.match(/Voting Finalized:\s*(.+?)\s+was eliminated/i);
                            votingResult = { type: 'eliminated', playerName: vf?.[1] || 'A player' };
                        }
                    }
                    console.log('[GameLog] VOTING_RESULT recovered via full-log fallback:', votingResult, 'eventData:', l.eventData);
                    break;
                }
                // Text fallback for logs without eventType
                const lower = l.message.toLowerCase();
                if (l.type === 'danger' && lower.includes('eliminated') && !lower.includes('night')) {
                    const vf = l.message.match(/Voting Finalized:\s*(.+?)\s+was eliminated/i);
                    if (vf) { votingResult = { type: 'eliminated', playerName: vf[1] }; break; }
                }
                if (lower.includes('no one was eliminated')) { votingResult = { type: 'no_one' }; break; }
                // Stop scanning past previous day boundary to avoid picking up wrong day's result
                if (l.eventType === 'DayStarted' || l.message.match(/Day\s+\d+\s+has begun/i)) break;
            }
            // Only warn when a result is genuinely missing: during the voting
            // results overlay (we *must* have the log by then) or after night
            // has fallen (voting should have concluded). Suppress during active
            // VOTING phase where votingStarted=true but no result yet is normal.
            if (!votingResult && votingStarted && (showVotingResults || nightFallen)) {
                console.warn('[GameLog] No VOTING_RESULT found after voting started!',
                    { logsCount: logs.length, targetDay, showVotingResults, nightFallen,
                      lastFewLogs: logs.slice(-5).map(l => ({ et: l.eventType, msg: l.message.slice(0, 50), ed: l.eventData })) });
            }
        }

        // 7. FALLBACK: if we're past Day 1 but nightResult is still null, scan wider.
        if (!nightResult && targetDay > 1) {
            for (let i = logs.length - 1; i >= 0; i--) {
                const l = logs[i];
                if (l.eventType === 'NIGHT_RESULT') {
                    if (l.eventData?.isSafe) nightResult = { type: 'safe' };
                    else if (l.eventData?.isEliminated) nightResult = { type: 'killed', playerName: resolveName(l.eventData.playerAddress, l.eventData.playerName) };
                    break;
                }
                const lower = l.message.toLowerCase();
                if (lower.includes('night result: no one died')) { nightResult = { type: 'safe' }; break; }
                if (lower.includes('night result:') && lower.includes('was killed')) {
                    const m = l.message.match(/Night Result: (.+?) was killed/i);
                    nightResult = { type: 'killed', playerName: m?.[1] || 'Unknown' };
                    break;
                }
            }
        }

        return {
            nightResult,
            discussionStarted,
            discussionFinished,
            currentSpeaker,
            votingStarted,
            voteCasts,
            votingResult,
            nightFallen,
        };
    }, [logs, targetDay, showVotingResults, liveDiscussion, forceVotingActive, hideActions, gameState.players]);

    const targetingDay = (showVotingResults && displayDay > 0) ? displayDay : dayCount;

    // Lock quorum per day at the moment we first observe VOTING phase — that's
    // strictly BEFORE finalizeVoting kills the executed player and decrements
    // aliveCount. Without this lock, the next polling cycle (after the kill)
    // recomputes Math.floor(alive/2)+1 with one fewer alive player, and the
    // already-typed "Voting phase started. Quorum: N" log entry visibly
    // rewrites itself to N-1 mid-render. The lock is keyed by dayCount so each
    // day's voting gets a fresh snapshot.
    const quorumLockRef = useRef<Map<number, number>>(new Map());
    useEffect(() => {
        if (phase !== GamePhase.VOTING) return;
        const day = dayCount || 1;
        if (quorumLockRef.current.has(day)) return;
        quorumLockRef.current.set(day, Math.floor(alivePlayers.length / 2) + 1);
    }, [phase, dayCount, alivePlayers.length]);

    const quorumData = useMemo(() => {
        const day = (showVotingResults && lockedVotingDayRef.current > 0)
            ? lockedVotingDayRef.current
            : (dayCount || 1);
        const locked = quorumLockRef.current.get(day);
        const needed = locked ?? (Math.floor(alivePlayers.length / 2) + 1);
        return { needed };
    }, [alivePlayers.length, dayCount, showVotingResults]);

    const [showNightFalls, setShowNightFalls] = useState(false);
    useEffect(() => {
        if (showVotingResults) {
            console.log('[GameLog Debug]', {
                targetDay,
                actualLoggedDay,
                logsCount: logs.length,
                nightResult: dayEvents.nightResult,
                discussionStarted: dayEvents.discussionStarted,
                votingResult: dayEvents.votingResult,
                nightFallen: dayEvents.nightFallen,
                displayDay, dayCount,
            });
            const timer = setTimeout(() => setShowNightFalls(true), 5000);
            return () => clearTimeout(timer);
        } else {
            setShowNightFalls(false);
        }
    }, [showVotingResults, dayEvents.nightResult, dayEvents.discussionStarted, dayEvents.votingResult,
        dayEvents.nightFallen, displayDay, dayCount, targetDay, actualLoggedDay, logs.length]);

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, scale: 0.95 },
    };

    const LABEL = "text-white/60 font-mono text-[11px] tracking-widest uppercase w-[120px] shrink-0 pt-0.5 select-none";
    const VAL_BASE = "text-white/80 font-mono text-[13px] leading-relaxed";

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [logs.length, dayEvents.votingResult, showNightFalls]);

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-center px-5 py-3 border-b border-white/5 bg-[#0A0A0A]">
                <h2 className="text-sm font-mono font-bold text-[#916A47] tracking-[0.3em] uppercase">
                    [ DAY {displayDay || targetDay} ]
                </h2>
            </div>

            <div ref={scrollRef} className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar bg-[#050505]/50">
                <div className="flex flex-col gap-5">
                    <AnimatePresence initial={false}>
                        {dayEvents.nightResult && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <TypewriterText text="> NIGHT_RESULT" className={LABEL} />
                                <span className={VAL_BASE}>
                                    {dayEvents.nightResult.type === 'safe' ? (
                                        <HighlightedTypewriterText parts={[
                                            { text: "NO ONE", className: "text-white font-bold" },
                                            { text: " was eliminated." }
                                        ]} speed={20} />
                                    ) : (
                                        <HighlightedTypewriterText parts={[
                                            { text: dayEvents.nightResult.playerName || 'A player', className: "text-white font-bold" },
                                            { text: " was " },
                                            { text: "eliminated", className: "text-red-500 font-bold" },
                                            { text: " last night." }
                                        ]} speed={20} />
                                    )}
                                </span>
                            </motion.div>
                        )}

                        {dayEvents.discussionStarted && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <TypewriterText text="> DISCUSSION" className={LABEL} />
                                <span className={VAL_BASE}>
                                    {dayEvents.discussionFinished ? (
                                        <TypewriterText text="Discussion concluded. All players have spoken." speed={20} />
                                    ) : dayEvents.currentSpeaker ? (
                                        <HighlightedTypewriterText parts={[
                                            { text: "Active speaker: " },
                                            { text: dayEvents.currentSpeaker, className: "text-white font-bold" }
                                        ]} speed={20} />
                                    ) : (
                                        <span className="animate-pulse">Waiting for discussion to start...</span>
                                    )}
                                </span>
                            </motion.div>
                        )}

                        {dayEvents.votingStarted && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <TypewriterText text="> VOTING" className={LABEL} />
                                <span className={VAL_BASE}>
                                    <TypewriterText text={`Voting phase started. Quorum: ${quorumData.needed}`} speed={20} />
                                </span>
                            </motion.div>
                        )}

                        {dayEvents.votingResult && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <TypewriterText text="> VOTING_RESULT" className={LABEL} />
                                <span className={VAL_BASE}>
                                    {dayEvents.votingResult.type === 'eliminated' ? (
                                        <HighlightedTypewriterText parts={[
                                            { text: dayEvents.votingResult.playerName || 'A player', className: "text-white font-bold" },
                                            { text: " " },
                                            { text: "eliminated", className: "text-[#916A47] font-bold" },
                                            { text: " by vote." }
                                        ]} speed={20} />
                                    ) : (
                                        <HighlightedTypewriterText parts={[
                                            { text: "NO ONE", className: "text-white font-bold" },
                                            { text: " was eliminated." }
                                        ]} speed={20} />
                                    )}
                                </span>
                            </motion.div>
                        )}

                        {(dayEvents.nightFallen || showNightFalls) && (!dayEvents.votingStarted || dayEvents.votingResult) && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 pt-2">
                                <TypewriterText text="> SYSTEM" className={LABEL} />
                                <TypewriterText text="NIGHT HAS FALLEN" className="font-mono text-[13px] font-bold uppercase tracking-[0.1em] text-[#916A47]" speed={30} />
                            </motion.div>
                        )}

                        {!dayEvents.nightResult && !dayEvents.discussionStarted && !dayEvents.votingStarted && !showNightFalls && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full items-center justify-center text-white/50 py-10">
                                <span className="text-[11px] font-mono uppercase tracking-widest animate-pulse">Waiting for events...</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
});

GameLog.displayName = 'GameLog';