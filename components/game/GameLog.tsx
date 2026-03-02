import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';
import { Moon, Sun, Vote, Skull, Shield, MessageCircle } from 'lucide-react';

/**
 * GameLog — Day-based game feed (no scroll).
 * Shows a clean, structured summary for the current day:
 *   DAY N
 *   ─ Night result (who died / no one died)
 *   ─ Discussion phase status
 *   ─ Voting phase status + quorum
 *   ─ Voting result
 *   ─ Night falls
 */
export const GameLog: React.FC = React.memo(() => {
    const { gameState } = useGameContext();

    // ── Derive current-day events from logs ──────────────────────
    // We parse the existing log entries to figure out what to display
    // for the CURRENT day.

    const dayCount = gameState.dayCount;
    const phase = gameState.phase;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const logs = gameState.logs;

    // Parse structured events from log messages
    const dayEvents = useMemo(() => {
        // Night result: look for "Night Result:" logs
        let nightResult: { type: 'safe' | 'killed'; playerName?: string } | null = null;
        let discussionStarted = false;
        let discussionFinished = false;
        let currentSpeaker: string | null = null;
        let votingStarted = false;
        let votingResult: { type: 'eliminated' | 'no_one'; playerName?: string } | null = null;
        let nightFallen = false;
        let voteCasts: { voter: string; target: string }[] = [];

        // Scan logs in order
        for (const log of logs) {
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
                // Generic format — no player name yet (will be updated by PlayerEliminated event)
                votingResult = { type: 'eliminated' };
            } else if (msg.includes('eliminated') && log.type === 'danger' && !msg.includes('Night') && !msg.includes('Voting Finalized')) {
                // PlayerEliminated event: "Charlie eliminated: Kicked by vote"
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
    }, [logs]);

    // Compute quorum: max votes on any player / votes needed for elimination
    const quorumData = useMemo(() => {
        const needed = Math.floor(alivePlayers.length / 2) + 1;

        // Count votes from voteCasts
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

    // Animation variants
    const itemVariants = {
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0 },
    };

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
                    <h2 className="text-lg md:text-xl font-['Playfair_Display'] font-bold text-white tracking-wider uppercase">
                        Day {dayCount || 1}
                    </h2>
                    <div className="w-8 h-[1px] bg-gradient-to-l from-transparent to-[#916A47]/60" />
                </motion.div>
            </div>

            {/* ── EVENT FEED ───────────────────────────────── */}
            <div className="flex-1 flex flex-col p-4 md:p-5 gap-2 overflow-hidden">
                <div className="flex flex-col gap-3">
                    <AnimatePresence mode="popLayout">
                        {/* 1. Night Result */}
                        {dayEvents.nightResult && (
                            <motion.div
                                key="night-result"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.4, delay: 0.1 }}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${dayEvents.nightResult.type === 'safe'
                                    ? 'bg-emerald-500/8 border border-emerald-500/20'
                                    : 'bg-red-500/8 border border-red-500/20'
                                    }`}
                            >
                                {dayEvents.nightResult.type === 'safe' ? (
                                    <Shield className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                ) : (
                                    <Skull className="w-4 h-4 text-red-400 flex-shrink-0" />
                                )}
                                <span className={`text-sm font-medium ${dayEvents.nightResult.type === 'safe'
                                    ? 'text-emerald-300'
                                    : 'text-red-300'
                                    }`}>
                                    {dayEvents.nightResult.type === 'safe'
                                        ? 'No one died last night.'
                                        : `${dayEvents.nightResult.playerName} was killed by the Mafia.`
                                    }
                                </span>
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
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#916A47]/8 border border-[#916A47]/20"
                            >
                                <MessageCircle className="w-4 h-4 text-[#916A47] flex-shrink-0" />
                                <span className="text-sm font-medium text-[#c4a882]">
                                    {dayEvents.discussionFinished ? (
                                        'Discussion Phase — All players have spoken.'
                                    ) : dayEvents.currentSpeaker ? (
                                        <>Discussion Phase — <span className="text-white font-semibold">{dayEvents.currentSpeaker}</span> is speaking.</>
                                    ) : (
                                        'Discussion Phase — Waiting for speakers...'
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
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20"
                            >
                                <Vote className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <span className="text-sm font-medium text-amber-300">
                                    Voting Phase has started.
                                </span>
                            </motion.div>
                        )}

                        {/* 3b. Quorum Counter (right below Voting Phase) */}
                        {dayEvents.votingStarted && !dayEvents.votingResult && phase === GamePhase.VOTING && (
                            <motion.div
                                key="quorum"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.5, delay: 0.35 }}
                                className="flex justify-center"
                            >
                                <div className="flex items-center gap-3 px-5 py-2.5 bg-black/50 border border-[#916A47]/30 rounded-full backdrop-blur-sm">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#916A47]/70">
                                        Quorum
                                    </span>
                                    <div className="w-[1px] h-4 bg-white/10" />
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-bold font-mono tabular-nums ${quorumData.current >= quorumData.needed
                                            ? 'text-red-400'
                                            : 'text-white'
                                            }`}>
                                            {quorumData.current}
                                        </span>
                                        <span className="text-white/30 text-lg font-mono">/</span>
                                        <span className="text-white/50 text-lg font-mono tabular-nums">
                                            {quorumData.needed}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* 4. Voting Result */}
                        {dayEvents.votingResult && (
                            <motion.div
                                key="vote-result"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.4, delay: 0.4 }}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${dayEvents.votingResult.type === 'eliminated'
                                    ? 'bg-red-500/8 border border-red-500/20'
                                    : 'bg-white/5 border border-white/10'
                                    }`}
                            >
                                <Skull className={`w-4 h-4 flex-shrink-0 ${dayEvents.votingResult.type === 'eliminated'
                                    ? 'text-red-400'
                                    : 'text-white/40'
                                    }`} />
                                <span className={`text-sm font-medium ${dayEvents.votingResult.type === 'eliminated'
                                    ? 'text-red-300'
                                    : 'text-white/50'
                                    }`}>
                                    {dayEvents.votingResult.type === 'eliminated'
                                        ? dayEvents.votingResult.playerName
                                            ? `${dayEvents.votingResult.playerName} has been eliminated.`
                                            : 'A player has been eliminated.'
                                        : 'No one was eliminated.'
                                    }
                                </span>
                            </motion.div>
                        )}

                        {/* 5. Night Falls */}
                        {dayEvents.nightFallen && (
                            <motion.div
                                key="night-falls"
                                variants={itemVariants}
                                initial="hidden"
                                animate="visible"
                                transition={{ duration: 0.6, delay: 0.5 }}
                                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/20"
                            >
                                <Moon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <span className="text-sm font-semibold text-blue-300 uppercase tracking-wide">
                                    Night falls.
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Empty state */}
                    {!dayEvents.nightResult && !dayEvents.discussionStarted && !dayEvents.votingStarted && !dayEvents.votingResult && !dayEvents.nightFallen && (
                        <div className="flex-1 flex flex-col items-center justify-center text-white/20 italic py-6">
                            <Sun className="w-5 h-5 mb-2 text-[#916A47]/30" />
                            <span className="text-sm">Waiting for events...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

GameLog.displayName = 'GameLog';