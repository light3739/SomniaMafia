// components/game/GameLayout.tsx
"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useGameContext } from '../../contexts/GameContext';
import { PlayerSpot } from './PlayerSpot';
import { VotingAnnouncement } from './VotingAnnouncement';
import { NightAnnouncement } from './NightAnnouncement';
import { MorningAnnouncement } from './MorningAnnouncement';
import { RoleCompositionAnnouncement } from './RoleCompositionAnnouncement';
import { EliminationCeremony } from './EliminationCeremony';
import { GameStartCountdown } from './GameStartCountdown';
import { useGameHints } from './GameHints';
import { BackButton } from '../ui/BackButton';
import { useSoundEffects } from '../ui/SoundEffects';
import { GameUIOverlay } from './GameUIOverlay';
import { GamePhase, Role } from '../../types';

// Layout Components
import { GameBackground } from './layout/GameBackground';
import { ResponsiveGameContainer } from './layout/ResponsiveGameContainer';
import { getPlayerPositions } from './layout/playerLayoutUtils';
export { getPlayerPositions };

const ShuffleAndReveal = dynamic(() => import('./ShuffleAndReveal').then(m => m.ShuffleAndReveal), { ssr: false });
const DayPhase = dynamic(() => import('./DayPhase').then(m => m.DayPhase), { ssr: false });
const NightPhase = dynamic(() => import('./NightPhase').then(m => m.NightPhase), { ssr: false });
const GameOver = dynamic(() => import('./GameOver').then(m => m.GameOver), { ssr: false });
const PostVotingTransition = dynamic(() => import('./PostVotingTransition').then(m => m.PostVotingTransition), { ssr: false });

const dayBg = "/images/day.png";
const nightBg = "/images/night.png";

export const GameLayout: React.FC<{ initialNightState?: any; initialDiscussionState?: any }> = ({ initialNightState, initialDiscussionState }) => {
    const {
        gameState, myPlayer, currentRoomId, selectedTarget, handlePlayerAction,
        canActOnPlayer, playerMarks, setPlayerMark, showVotingResults, voteMap,
        isTestMode, refreshPlayersList, discussionState, setDiscussionState, smoothDiscussionTimeRemaining
    } = useGameContext();
    const { playNightTransition, playMorningTransition } = useSoundEffects();
    const { showHint } = useGameHints(currentRoomId?.toString());
    const { chainId } = useAccount();

    const [showVotingAnnouncement, setShowVotingAnnouncement] = useState(false);
    const [showMorningAnnouncement, setShowMorningAnnouncement] = useState(false);
    const [showRoleComposition, setShowRoleComposition] = useState(false);
    const [hasShownRoleComposition, setHasShownRoleComposition] = useState(false);
    const [showNightAnnouncement, setShowNightAnnouncement] = useState(false);
    const [lastPhase, setLastPhase] = useState<GamePhase | null>(null);

    // Elimination ceremony
    const [eliminationData, setEliminationData] = useState<{ name: string; role: string } | null>(null);
    const lastEliminationDayRef = useRef<number>(0);

    // Game start countdown — read flag set by WaitingRoom on phase transition
    const [showStartCountdown, setShowStartCountdown] = useState(false);
    useEffect(() => {
        try {
            if (sessionStorage.getItem('mafia_show_start_countdown') === '1') {
                sessionStorage.removeItem('mafia_show_start_countdown');
                setShowStartCountdown(true);
            }
        } catch { /* ignore */ }
    }, []);

    const [activePhase, setActivePhase] = useState(gameState.phase);

    useEffect(() => {
        if (gameState.phase !== activePhase) {
            if ((activePhase === GamePhase.REVEAL || activePhase === GamePhase.SHUFFLING) && gameState.phase === GamePhase.NIGHT) {
                const t = setTimeout(() => setActivePhase(gameState.phase), 4500); // Wait 4.5s so players can see their roles!
                return () => clearTimeout(t);
            } else if (activePhase === GamePhase.VOTING && gameState.phase === GamePhase.NIGHT) {
                if (showVotingResults) {
                    // Do nothing while overlay is active. Wait for it to finish.
                    return;
                } else if (prevShowVotingResultsRef.current) {
                    // Instantly transition if the results phase just finished.
                    setActivePhase(gameState.phase);
                } else {
                    // Failsafe: if showVotingResults hasn't fired yet (RPC lag), give it 12 seconds before forcing the night transition
                    const t = setTimeout(() => {
                        if (!showVotingResults) setActivePhase(gameState.phase);
                    }, 12000);
                    return () => clearTimeout(t);
                }
            } else if (activePhase === GamePhase.NIGHT && gameState.phase === GamePhase.DAY) {
                // Guarantee minimum cinematic display time (5s from commit).
                // If a player committed last and night resolved immediately,
                // they'd otherwise see the cinematic for <1s before it vanishes.
                const MIN_CINEMATIC_MS = 8000;
                const BASE_DELAY = 2500;
                const commitTs = Number(sessionStorage.getItem('mafia_cinematic_commit_ts') || '0');
                const elapsed = commitTs > 0 ? Date.now() - commitTs : Infinity;
                const delay = Math.max(BASE_DELAY, MIN_CINEMATIC_MS - elapsed);

                const t = setTimeout(() => {
                    sessionStorage.removeItem('mafia_cinematic_commit_ts');
                    // Pre-trigger the morning announcement BEFORE swapping the
                    // active phase. Without this, setActivePhase fires first,
                    // NightPhase unmounts, DayPhase mounts, and only then the
                    // separate announcement effect runs and fades the morning
                    // overlay in — leaving 1-2 frames where the bare game
                    // table is visible. Triggering both state updates inside
                    // the same callback lets React batch them so the morning
                    // overlay paints together with the day phase swap.
                    if (gameState.dayCount > 0 && gameState.dayCount !== lastMorningDayRef.current) {
                        lastMorningDayRef.current = gameState.dayCount;
                        triggerMorningAnnouncement();
                    }
                    setActivePhase(gameState.phase);
                }, delay);
                return () => clearTimeout(t);
            } else {
                setActivePhase(gameState.phase);
            }
        }
    }, [gameState.phase, activePhase, showVotingResults]);

    const lastMorningDayRef = useRef<number | null>(null);
    const lastVotingDayRef = useRef<number | null>(null);
    const lastNightDayRef = useRef<number | null>(null);
    const nightAnnouncementPendingRef = useRef(false);
    const prevShowVotingResultsRef = useRef(false);

    // Day lock for the voter-avatars overlay. We latch the day number at the
    // moment showVotingResults flips true, so the log scan below uses THIS
    // round's PLAYER_VOTED entries even if the contract advances dayCount
    // (very fast on Somnia with 100ms blocks) while the 8s overlay is still
    // playing. Without the lock, a mid-overlay DayStarted(N+1) would cause
    // the scan to target Day N+1, finding zero votes and showing no voters.
    // Refs are mutated during render here on purpose — same pattern used by
    // GameLog's lockedVotingDayRef for the discussion timer / typewriter.
    const votersLockedDayRef = useRef<number>(0);
    const prevShowForVotersLockRef = useRef<boolean>(false);
    if (showVotingResults && !prevShowForVotersLockRef.current) {
        votersLockedDayRef.current = gameState.dayCount;
    } else if (!showVotingResults) {
        votersLockedDayRef.current = 0;
    }
    prevShowForVotersLockRef.current = showVotingResults;

    // --- Announcement Callbacks ---
    const handleMorningComplete = useCallback(() => {
        setShowMorningAnnouncement(false);
        showHint('discussion');
    }, [showHint]);

    const handleNightComplete = useCallback(() => {
        setShowNightAnnouncement(false);
        const hints: Record<string, any> = {
            [Role.MAFIA]: 'night_mafia',
            [Role.DOCTOR]: 'night_doctor',
            [Role.DETECTIVE]: 'night_detective'
        };
        showHint(hints[myPlayer?.role || ''] ?? 'night_civilian');
    }, [showHint, myPlayer?.role]);

    // Detect elimination from voting results logs.
    // IMPORTANT: scope the scan to the CURRENT day via the last DayStarted
    // marker. Previously this loop walked the entire log buffer and latched
    // onto whatever the most recent `VOTING_RESULT && isEliminated` entry was
    // — so a peaceful vote on Day N would still re-fire the ceremony using
    // the stale Day N-1 elimination (often with a wallet-prefix fallback
    // name, surfacing as "0x1234 eliminated" on a day nobody was voted out).
    useEffect(() => {
        if (!showVotingResults || lastEliminationDayRef.current === gameState.dayCount) return;

        // Find the current day's start index so we only consider today's result.
        let dayStartIdx = -1;
        for (let i = gameState.logs.length - 1; i >= 0; i--) {
            const l = gameState.logs[i];
            if (l.eventType === 'DayStarted' || l.message.match(/Day\s+\d+\s+has begun/i)) {
                dayStartIdx = i;
                break;
            }
        }
        const dayLogs = dayStartIdx >= 0 ? gameState.logs.slice(dayStartIdx) : gameState.logs;

        for (let i = dayLogs.length - 1; i >= 0; i--) {
            const l = dayLogs[i];
            if (l.eventType !== 'VOTING_RESULT') continue;

            // Mark the day as processed regardless of outcome so we don't rescan
            // on every subsequent re-render of the same voting-results overlay.
            lastEliminationDayRef.current = gameState.dayCount;

            if (l.eventData?.isEliminated) {
                // Prefer address-based lookup so the ceremony shows the current
                // canonical nickname even if the log itself stored a wallet-prefix
                // fallback. Fall back to name matching for legacy logs.
                const addr = l.eventData.playerAddress?.toLowerCase();
                const eliminated = addr
                    ? gameState.players.find(p => p.address.toLowerCase() === addr)
                    : gameState.players.find(p => p.name === l.eventData!.playerName);
                const displayName = eliminated?.name || l.eventData.playerName || 'A player';
                setEliminationData({
                    name: displayName,
                    role: eliminated?.role || 'UNKNOWN',
                });
            }
            // isSafe → peaceful day, no ceremony. Mark handled and exit.
            break;
        }
    }, [showVotingResults, gameState.logs, gameState.dayCount, gameState.players]);

    const handleRoleCompositionComplete = useCallback(() => {
        setShowRoleComposition(false);
        playMorningTransition();
        setShowMorningAnnouncement(true);
    }, [playMorningTransition]);

    // Triggers for old ambient announcements (replace dramatic overlay)
    const triggerNightAnnouncement = useCallback(() => {
        playNightTransition();
        setShowNightAnnouncement(true);
    }, [playNightTransition]);

    const triggerMorningAnnouncement = useCallback(() => {
        playMorningTransition();
        setShowMorningAnnouncement(true);
    }, [playMorningTransition]);

    const triggerVotingAnnouncement = useCallback(() => {
        setShowVotingAnnouncement(true);
    }, []);

    const handleVotingComplete = useCallback(() => {
        setShowVotingAnnouncement(false);
        showHint('voting');
    }, [showHint]);

    // Randomized seating
    const visualPlayers = useMemo(() => {
        if (!gameState.players.length) return [];
        if (activePhase === GamePhase.LOBBY || !currentRoomId) return gameState.players;
        const shuffled = [...gameState.players];
        let s = Number(currentRoomId % 1000000n), m = shuffled.length, t, i;
        const random = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        while (m) { i = Math.floor(random() * m--); t = shuffled[m]; shuffled[m] = shuffled[i]; shuffled[i] = t; }
        return shuffled;
    }, [gameState.players, activePhase, currentRoomId]);

    const playerPositions = useMemo(() => getPlayerPositions(visualPlayers.length), [visualPlayers.length]);

    // Announcements trigger logic
    useEffect(() => {
        if (activePhase === GamePhase.DAY || activePhase === GamePhase.VOTING) {
            if (gameState.dayCount > 0 && gameState.dayCount !== lastMorningDayRef.current) {
                lastMorningDayRef.current = gameState.dayCount;
                if (gameState.dayCount === 1 && !hasShownRoleComposition) { setShowRoleComposition(true); setHasShownRoleComposition(true); }
                else {
                    triggerMorningAnnouncement();
                }
            }
        }
    }, [activePhase, gameState.dayCount, hasShownRoleComposition]);

    useEffect(() => {
        const isVoting = activePhase === GamePhase.VOTING;
        if ((isVoting && lastPhase !== GamePhase.VOTING) || (isVoting && gameState.dayCount !== lastVotingDayRef.current)) {
            const delay = lastPhase === GamePhase.DAY ? 0 : (gameState.dayCount === lastMorningDayRef.current ? 2000 : 0);
            const t = setTimeout(() => { triggerVotingAnnouncement(); }, delay);
            lastVotingDayRef.current = gameState.dayCount; setLastPhase(activePhase);
            return () => clearTimeout(t);
        }
        if (activePhase !== lastPhase) setLastPhase(activePhase);
    }, [activePhase, gameState.dayCount, lastPhase]);

    useEffect(() => {
        const wasShowing = prevShowVotingResultsRef.current; prevShowVotingResultsRef.current = showVotingResults;
        const entry = (wasShowing && !showVotingResults && activePhase === GamePhase.NIGHT) || (!showVotingResults && !wasShowing && activePhase === GamePhase.NIGHT);
        if (entry && gameState.phase === GamePhase.NIGHT && gameState.dayCount !== lastNightDayRef.current) {
            if (nightAnnouncementPendingRef.current) return;
            nightAnnouncementPendingRef.current = true; lastNightDayRef.current = gameState.dayCount;
            triggerNightAnnouncement();
            nightAnnouncementPendingRef.current = false;
        }
    }, [activePhase, gameState.phase, gameState.dayCount, triggerNightAnnouncement, showVotingResults]);

    // === EXPOSE REFRESH FOR FAILSAFE ===
    useEffect(() => {
        (window as any).refreshGame = () => {
            if (currentRoomId) {
                console.log('[Manual Sync] Forcing Game Data Refresh...');
                refreshPlayersList(currentRoomId);
            }
        };
        return () => { delete (window as any).refreshGame; };
    }, [currentRoomId, refreshPlayersList]);

    const isNightPhase = activePhase === GamePhase.NIGHT && !showVotingResults;
    const isOverlayPhase = [GamePhase.SHUFFLING, GamePhase.REVEAL, GamePhase.ENDED].includes(activePhase);

    if (gameState.players.length === 0 && !isTestMode) return (
        <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
            <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${dayBg})` }} />
            <h2 className="text-2xl font-['Cinzel'] z-10">Game Session Not Found</h2>
            <BackButton to="/setup" label="Back to Menu" />
        </div>
    );

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#050505] font-['Montserrat'] flex items-center justify-center">
            <GameBackground isNightPhase={isNightPhase} dayBg={dayBg} nightBg={nightBg} />
            <GameUIOverlay />


            {/* Ambient phase announcements (restored from older cinematic style) */}
            <NightAnnouncement show={showNightAnnouncement} onComplete={handleNightComplete} />
            <MorningAnnouncement show={showMorningAnnouncement} onComplete={handleMorningComplete} />
            <VotingAnnouncement show={showVotingAnnouncement} onComplete={handleVotingComplete} />

            {/* Elimination ceremony */}
            <EliminationCeremony
                show={!!eliminationData}
                playerName={eliminationData?.name || ''}
                playerRole={eliminationData?.role || 'UNKNOWN'}
                onComplete={() => setEliminationData(null)}
            />

            {/* Game start countdown — non-blocking, plays over the loading game */}
            <GameStartCountdown
                show={showStartCountdown}
                onComplete={() => setShowStartCountdown(false)}
            />

            {/* Day 1 role composition (kept — special intro) */}
            <RoleCompositionAnnouncement
                show={showRoleComposition}
                onComplete={handleRoleCompositionComplete}
                playerCount={gameState.players.filter(p => p.isAlive).length}
            />

            <ResponsiveGameContainer>
                {playerPositions.map((pos, index) => {
                    const p = visualPlayers[index]; if (!p) return null;
                    
                    // Build voters who voted FOR player `p` in the current
                    // voting round. Data sources, in order of trust:
                    //
                    //   1. gameState.logs PLAYER_VOTED entries — the only source
                    //      that is BOTH day-scoped (located between DayStarted
                    //      markers) AND cross-client consistent (Redis on the
                    //      GM server is the canonical store, identical payloads
                    //      reach every connected WS client). This is primary.
                    //
                    //   2. voteMap[myAddress] — self-optimistic fallback for the
                    //      current player, used only until my own PLAYER_VOTED
                    //      log lands in state. Never used for other players.
                    //
                    // voteMap is intentionally NOT used for other voters here.
                    // It's populated by pollEvents' 10k-block backfill on first
                    // mount plus LiveKit OPTIMISTIC_VOTE pushes, with no day
                    // attribution — a voter who voted on Day N-1 but not yet on
                    // Day N has their N-1 target sitting in voteMap, and we
                    // can't tell the entry is stale without a day marker.
                    // Trusting voteMap was the core cause of "some clients see
                    // votes lagging by a day, some see them correctly" — each
                    // client's voteMap converges on different data depending on
                    // LiveKit / WS / pollEvents timing.
                    let voters: any[] = [];
                    if (showVotingResults) {
                        const resolvedVoteMap: Record<string, string> = {};

                        // Locate the DayStarted marker for the locked day,
                        // then scan forward until the next DayStarted (or end).
                        // Using the locked day rather than "last DayStarted"
                        // protects against mid-overlay dayCount advances.
                        const lockedDay = votersLockedDayRef.current;
                        let dayStartIdx = -1;
                        if (lockedDay > 0) {
                            for (let i = 0; i < gameState.logs.length; i++) {
                                const l = gameState.logs[i];
                                if (l.eventType === 'DayStarted' && Number(l.eventData?.dayNumber) === lockedDay) {
                                    dayStartIdx = i;
                                    break;
                                }
                            }
                        }
                        // Fallback: if the locked day marker hasn't arrived in
                        // state yet (rare timing gap), use the last DayStarted.
                        if (dayStartIdx < 0) {
                            for (let i = gameState.logs.length - 1; i >= 0; i--) {
                                const l = gameState.logs[i];
                                if (l.eventType === 'DayStarted' || l.message.includes('has begun')) {
                                    dayStartIdx = i;
                                    break;
                                }
                            }
                        }

                        if (dayStartIdx >= 0) {
                            for (let i = dayStartIdx + 1; i < gameState.logs.length; i++) {
                                const l = gameState.logs[i];
                                // Stop at the next day boundary so we never
                                // leak votes from a later round.
                                if (l.eventType === 'DayStarted' || l.message.match(/Day\s+\d+\s+has begun/i)) break;
                                if (l.eventType !== 'PLAYER_VOTED' || !l.eventData) continue;

                                // Prefer raw addresses when present (written
                                // by client pollEvents and by GM server after
                                // the 9ec3c00 logListener commit). Fall back
                                // to unique name match for legacy logs only.
                                let voterAddr = l.eventData.voterAddress?.toLowerCase();
                                let targetAddr = l.eventData.targetAddress?.toLowerCase();
                                if (!voterAddr || !targetAddr) {
                                    const vName = l.eventData.playerName;
                                    const tName = l.eventData.targetName;
                                    if (!vName || !tName) continue;
                                    const vMatches = gameState.players.filter(pl => pl.name === vName);
                                    const tMatches = gameState.players.filter(pl => pl.name === tName);
                                    if (vMatches.length !== 1 || tMatches.length !== 1) continue; // ambiguous — drop
                                    voterAddr = vMatches[0].address.toLowerCase();
                                    targetAddr = tMatches[0].address.toLowerCase();
                                }
                                // Later log for the same voter wins (vote change).
                                resolvedVoteMap[voterAddr] = targetAddr;
                            }
                        }

                        // Self-optimistic: if I've voted but my PLAYER_VOTED log
                        // hasn't reached state yet (LiveKit / WS race), surface
                        // my own vote from voteMap. Only for myself — never for
                        // other players (see long comment above).
                        const myAddr = myPlayer?.address?.toLowerCase();
                        if (myAddr && voteMap[myAddr] && !resolvedVoteMap[myAddr]) {
                            resolvedVoteMap[myAddr] = voteMap[myAddr].toLowerCase();
                        }

                        voters = Object.entries(resolvedVoteMap)
                            .filter(([_, target]) => target === p.address.toLowerCase())
                            .map(([v]) => gameState.players.find(pl => pl.address.toLowerCase() === v))
                            .filter((pl): pl is any => !!pl);
                    }

                    return (
                        <div key={p.id} className={`absolute transition-all duration-500 ${isOverlayPhase ? 'opacity-20 pointer-events-none' : ''}`} style={{ left: pos.x, top: pos.y }}>
                            <PlayerSpot player={p} isMe={p.address.toLowerCase() === myPlayer?.address.toLowerCase()} onAction={handlePlayerAction} canAct={canActOnPlayer(p)} isSelected={selectedTarget?.toLowerCase() === p.address.toLowerCase()} isNight={isNightPhase} myRole={myPlayer?.role} mark={playerMarks[p.address.toLowerCase()] || null} onSetMark={setPlayerMark} isSpeaking={activePhase === GamePhase.DAY && discussionState?.currentSpeakerAddress?.toLowerCase() === p.address.toLowerCase()} speechTimeRemaining={activePhase === GamePhase.DAY && discussionState?.currentSpeakerAddress?.toLowerCase() === p.address.toLowerCase() ? smoothDiscussionTimeRemaining : 0} voters={voters} />
                        </div>
                    );
                })}

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] flex items-center justify-center z-10">
                    {!isOverlayPhase && (activePhase === GamePhase.DAY || activePhase === GamePhase.VOTING || showVotingResults) && (
                        <div className="w-full h-full"><DayPhase initialDiscussionState={initialDiscussionState} hideActions={showVotingResults} disablePolling={showVotingResults && activePhase === GamePhase.NIGHT} /></div>
                    )}
                    {showVotingResults && <PostVotingTransition />}
                    {!showVotingResults && !isOverlayPhase && activePhase === GamePhase.NIGHT && (<div className="w-full h-full"><NightPhase initialNightState={initialNightState} /></div>)}
                </div>

            </ResponsiveGameContainer>

            {/* Overlays for Shuffling, Reveal and Game Over */}
            <AnimatePresence>
                {isOverlayPhase && (activePhase === GamePhase.SHUFFLING || activePhase === GamePhase.REVEAL) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[50]"
                    >
                        <ShuffleAndReveal key="shuffle-reveal" />
                    </motion.div>
                )}
                {activePhase === GamePhase.ENDED && (
                    <GameOver key="gameover" />
                )}
            </AnimatePresence>
        </div>
    );
};