import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';

/**
 * GameLog — Day-based game feed (no scroll).
 * Shows a clean, structured summary for the current day:
 *   DAY N
 *   ─ Night result (who died / no one died)
 *   ─ Discussion phase status
 *   ─ Voting phase status + quorum
 *   ─ Voting result (who was kicked)
 *   ─ Night falls (3s before PostVotingTransition ends)
 *
 * Feed is cleared every new day (only shows current day events).
 * No boxes or emojis — clean text only.
 */
export const GameLog: React.FC = React.memo(() => {
    const { gameState, showVotingResults } = useGameContext();

    const dayCount = gameState.dayCount;
    const phase = gameState.phase;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const logs = gameState.logs;

    // ── Track day changes to clear feed ──────────────────────
    // When day changes, snapshot the log index so we only parse new logs from this day
    const prevDayRef = useRef(dayCount);
    const dayStartLogIndex = useRef(0);

    if (dayCount !== prevDayRef.current) {
        prevDayRef.current = dayCount;
        dayStartLogIndex.current = logs.length;
    }

    // Get only logs for the current day
    const todayLogs = useMemo(() => {
        return logs.slice(dayStartLogIndex.current);
    }, [logs, dayStartLogIndex.current]);

    // Parse structured events from log messages (current day only)
    const dayEvents = useMemo(() => {
        let nightResult: { type: 'safe' | 'killed'; playerName?: string } | null = null;
        let discussionStarted = false;
        let discussionFinished = false;
        let currentSpeaker: string | null = null;
        let votingStarted = false;
        let votingResult: { type: 'eliminated' | 'no_one'; playerName?: string } | null = null;
        let nightFallen = false;
        let voteCasts: { voter: string; target: string }[] = [];

        for (const log of todayLogs) {
            const msg = log.message;

            // Night results
            if (msg.includes('Night Result: No one died')) {
                nightResult = { type: 'safe' };
            } else if (msg.includes('Night Result:') && msg.includes('was killed')) {
                const match = msg.match(/Night Result: (.+?) was killed/);
                nightResult = { type: 'killed', playerName: match?.[1] || 'Unknown' };
            }

            // Discussion
            if (msg.includes('Discussion Phase started') || msg.includes('Discussion starting')) {
                discussionStarted = true;
                discussionFinished = false;
            }
            if (msg.includes('is now speaking')) {
                const match = msg.match(/(.+?) is now speaking/);
                currentSpeaker = match?.[1] || null;
            }
            if (msg.includes('All players have spoken') || msg.includes('Starting Vote')) {
                discussionFinished = true;
            }

            // Voting
            if (msg === 'Voting Phase Started' || msg.includes('Voting Phase Started')) {
                votingStarted = true;
            }

            // Individual votes
            if (msg.includes('voted for')) {
                const match = msg.match(/(.+?) voted for (.+)/);
                if (match) {
                    voteCasts.push({ voter: match[1], target: match[2] });
                }
            }

            // Voting result
            if (msg.includes('Voting Finalized: Player eliminated')) {
                votingResult = { type: 'eliminated' };
            } else if (msg.includes('eliminated') && log.type === 'danger' && !msg.includes('Night') && !msg.includes('Voting Finalized')) {
                const nameMatch = msg.match(/^(.+?) eliminated/);
                if (nameMatch) {
                    votingResult = {
                        type: 'eliminated',
                        playerName: nameMatch[1]
                    };
                }
            }
            if (msg.includes('Voting Finalized: No one was eliminated')) {
                votingResult = { type: 'no_one' };
            }

            // Night falls
            if (msg === 'Night has fallen...' || msg.includes('Night has fallen')) {
                nightFallen = true;
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
            nightFallen
        };
    }, [todayLogs]);

    // Compute quorum: max votes on any player / votes needed for elimination
    const quorumData = useMemo(() => {
        const needed = Math.floor(alivePlayers.length / 2) + 1;

        const voteCounts = new Map<string, number>();
        for (const vc of dayEvents.voteCasts) {
            voteCounts.set(vc.target, (voteCounts.get(vc.target) || 0) + 1);
        }
        let maxVotes = 0;
        for (const count of voteCounts.values()) {
            if (count > maxVotes) maxVotes = count;
        }

        return { current: maxVotes, needed };
    }, [alivePlayers.length, dayEvents.voteCasts]);

    // ── "Night falls" timed appearance during PostVotingTransition ──
    // Show "Night falls" 3 seconds before the 10s PostVotingTransition ends (i.e. at 7s)
    const [showNightFalls, setShowNightFalls] = useState(false);
    const nightFallsTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (showVotingResults && phase === GamePhase.NIGHT) {
            // PostVotingTransition lasts 10s, show "Night falls" after 7s
            nightFallsTimerRef.current = setTimeout(() => {
                setShowNightFalls(true);
            }, 7000);

            return () => {
                if (nightFallsTimerRef.current) clearTimeout(nightFallsTimerRef.current);
            };
        } else {
            setShowNightFalls(false);
        }
    }, [showVotingResults, phase]);


    // Animation variants
    const itemVariants = {
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0 },
    };

    // Shared styles
    const FONT = "font-['Montserrat']";
    const BASE_TEXT = `${FONT} text-white/70 text-[13px] font-normal`;
    const ACCENT = "text-[#916A47]"; // Gold accent for phase names
    const PLAYER_NAME = "text-white"; // Solid white for player names

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* ── DAY TITLE ────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center justify-center py-4 border-b border-white/5 bg-white/[0.02]">
                <motion.div
                    key={`day-${dayCount}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3"
                >
                    <div className="w-8 h-[1px] bg-gradient-to-r from-transparent to-[#916A47]/60" />
                    <h2 className={`text-base md:text-lg ${FONT} font-bold text-white tracking-wider uppercase`}>
                        Day {dayCount || 1}
                    </h2>
                    <div className="w-8 h-[1px] bg-gradient-to-l from-transparent to-[#916A47]/60" />
                </motion.div>
            </div>

            {/* ── EVENT FEED ───────────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 md:p-5 overflow-hidden">
                <div className="flex flex-col gap-3 text-center">
                    <AnimatePresence mode="popLayout">
                        {/* 1. Night Result */}
                        {dayEvents.nightResult && (
                            <motion.div
                                key="night-result"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className="flex flex-col items-center gap-3"
                            >
                                <span className={BASE_TEXT}>
                                    {dayEvents.nightResult.type === 'safe'
                                        ? 'No one died last night'
                                        : <><span className={`${PLAYER_NAME} font-[800]`}>{dayEvents.nightResult.playerName}</span> was killed by the Mafia</>
                                    }
                                </span>
                                {/* Divider line after night result */}
                                <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#916A47]/40 to-transparent" />
                            </motion.div>
                        )}

                        {/* 2. Discussion Phase */}
                        {dayEvents.discussionStarted && (
                            <motion.div
                                key="discussion"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.4, delay: 0.2 }}
                            >
                                <span className={BASE_TEXT}>
                                    {dayEvents.discussionFinished ? (
                                        <><span className={`${ACCENT} font-[900] uppercase text-[13px]`}>DISCUSSION PHASE</span> - All players have spoken</>
                                    ) : dayEvents.currentSpeaker ? (
                                        <><span className={`${ACCENT} font-[900] uppercase text-[13px]`}>DISCUSSION PHASE</span> - <span className={`${PLAYER_NAME} font-[800]`}>{dayEvents.currentSpeaker}</span> is speaking</>
                                    ) : (
                                        <><span className={`${ACCENT} font-[900] uppercase text-[13px]`}>DISCUSSION PHASE</span> - Waiting for speakers...</>
                                    )}
                                </span>
                            </motion.div>
                        )}

                        {/* 3. Voting Phase */}
                        {dayEvents.votingStarted && (
                            <motion.div
                                key="voting"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.4, delay: 0.3 }}
                            >
                                <span className={BASE_TEXT}>
                                    <span className={`${ACCENT} font-[900] uppercase text-[13px]`}>VOTING PHASE</span> has started
                                </span>
                            </motion.div>
                        )}

                        {/* 3b. Quorum Counter — always visible once voting starts (persists through results) */}
                        {dayEvents.votingStarted && (
                            <motion.div
                                key="quorum"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.5, delay: 0.35 }}
                            >
                                <span className={BASE_TEXT}>
                                    <span className={`${ACCENT} font-[900] uppercase text-[13px]`}>QUORUM</span>{' '}
                                    <span className={`font-mono font-[800] tabular-nums ${quorumData.current >= quorumData.needed ? 'text-red-400' : 'text-white/90'}`}>
                                        {quorumData.current}
                                    </span>
                                    <span className="text-white/30 font-mono">/</span>
                                    <span className="text-white/50 font-mono tabular-nums">
                                        {quorumData.needed}
                                    </span>
                                </span>
                            </motion.div>
                        )}

                        {/* 4. Voting Result (who was kicked) */}
                        {dayEvents.votingResult && (
                            <motion.div
                                key="vote-result"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.4, delay: 0.4 }}
                            >
                                <span className={BASE_TEXT}>
                                    {dayEvents.votingResult.type === 'eliminated'
                                        ? dayEvents.votingResult.playerName
                                            ? <><span className={`${PLAYER_NAME} font-[800]`}>{dayEvents.votingResult.playerName}</span> has been eliminated</>
                                            : 'A player has been eliminated'
                                        : 'No one was eliminated'
                                    }
                                </span>
                            </motion.div>
                        )}

                        {/* 5. Night Falls — shown 3s before PostVotingTransition ends, or from log */}
                        {(dayEvents.nightFallen || showNightFalls) && (
                            <motion.div
                                key="night-falls"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.6, delay: 0.5 }}
                            >
                                <span className={`${FONT} text-[15px] font-[900] uppercase tracking-[0.15em] text-[#5bb4ff] drop-shadow-[0_0_8px_rgba(91,180,255,0.4)]`}>
                                    NIGHT FALLS
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Empty state */}
                    {!dayEvents.nightResult && !dayEvents.discussionStarted && !dayEvents.votingStarted && !dayEvents.votingResult && !dayEvents.nightFallen && !showNightFalls && (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/20 italic py-6">
                            <span className={`text-[12px] ${FONT}`}>Waiting for events...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

GameLog.displayName = 'GameLog';