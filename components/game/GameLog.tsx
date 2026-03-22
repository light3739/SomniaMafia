import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';

interface GameLogProps {
    liveDiscussion?: {
        active?: boolean;
        finished?: boolean;
        currentSpeakerName?: string | null;
    };
    forceVotingActive?: boolean;
}

export const GameLog: React.FC<GameLogProps> = React.memo(({ liveDiscussion, forceVotingActive = false }) => {
    const { gameState, showVotingResults, addLog } = useGameContext();

    const dayCount = gameState.dayCount;
    const phase = gameState.phase;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const logs = gameState.logs;

    const injectedDayRef = useRef<number>(0);
    useEffect(() => {
        if (dayCount <= 1 || injectedDayRef.current >= dayCount) return;
        const hasCurrentDayMarker = logs.some(l => {
            const match = l.message.match(/Day (\d+) has begun/);
            return match && Number(match[1]) === dayCount;
        });
        if (!hasCurrentDayMarker && logs.length > 0) {
            injectedDayRef.current = dayCount;
            addLog(`Day ${dayCount} has begun`, "phase");
        }
    }, [dayCount, logs, addLog]);

    const todayLogs = useMemo(() => {
        let startIndex = 0;
        const dayPattern = /Day \d+ has begun/;
        for (let i = logs.length - 1; i >= 0; i--) {
            const msg = logs[i].message;
            if (dayPattern.test(msg) || msg.includes('Game started!')) {
                startIndex = i;
                if (i > 0 && logs[i - 1].message.includes('Night Result:')) {
                    startIndex = i - 1;
                }
                break;
            }
        }
        return logs.slice(startIndex);
    }, [logs, dayCount]);

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
            if (log.eventType) {
                switch (log.eventType) {
                    case 'NIGHT_RESULT':
                        if (log.eventData?.isSafe) {
                            nightResult = { type: 'safe' };
                        } else if (log.eventData?.isEliminated) {
                            nightResult = { type: 'killed', playerName: log.eventData.playerName };
                        }
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
                    case 'VOTING_RESULT':
                        if (log.eventData?.isSafe) {
                            votingResult = { type: 'no_one' };
                        } else if (log.eventData?.isEliminated) {
                            votingResult = { type: 'eliminated', playerName: log.eventData.playerName };
                        }
                        break;
                    case 'NIGHT_FALLS':
                        nightFallen = true;
                        break;
                }
            } else {
                const msg = log.message;
                if (msg.includes('Night Result: No one died')) {
                    nightResult = { type: 'safe' };
                } else if (msg.includes('Night Result:') && msg.includes('was killed')) {
                    const match = msg.match(/Night Result: (.+?) was killed/);
                    nightResult = { type: 'killed', playerName: match?.[1] || 'Unknown' };
                }
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
                if (msg === 'Voting Phase Started' || msg.includes('Voting Phase Started')) {
                    votingStarted = true;
                }
                if (msg.includes('voted for')) {
                    const match = msg.match(/(.+?) voted for (.+)/);
                    if (match) {
                        voteCasts.push({ voter: match[1], target: match[2] });
                    }
                }
                const votingFinalizedEliminatedMatch = msg.match(/^Voting Finalized:\s+(.+?)\s+was eliminated!?$/i);
                if (votingFinalizedEliminatedMatch) {
                    votingResult = { type: 'eliminated', playerName: votingFinalizedEliminatedMatch[1] };
                } else if (msg.includes('Voting Finalized: Player eliminated')) {
                    votingResult = { type: 'eliminated' };
                } else if (msg.includes('eliminated') && log.type === 'danger' && !msg.includes('Night') && !msg.includes('Voting Finalized')) {
                    const nameMatch = msg.match(/^(.+?) eliminated[:\s]/);
                    if (nameMatch) {
                        votingResult = { type: 'eliminated', playerName: nameMatch[1] };
                    }
                }
                if (msg.includes('Voting Finalized: No one was eliminated') || msg.includes('No one was eliminated')) {
                    votingResult = { type: 'no_one' };
                }
                if (msg === 'Night has fallen...' || msg.includes('Night has fallen')) {
                    nightFallen = true;
                }
            }
        }

        if (liveDiscussion?.active) {
            discussionStarted = true;
            discussionFinished = false;
            if (liveDiscussion.currentSpeakerName) {
                currentSpeaker = liveDiscussion.currentSpeakerName;
            }
        } else if (liveDiscussion?.finished) {
            discussionStarted = true;
            discussionFinished = true;
        } else if (!discussionStarted && phase === GamePhase.DAY) {
            discussionStarted = true;
        }
        if (!votingStarted && (phase === GamePhase.VOTING || showVotingResults || forceVotingActive)) {
            votingStarted = true;
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
    }, [todayLogs, phase, showVotingResults, liveDiscussion, forceVotingActive]);

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

    const [showNightFalls, setShowNightFalls] = useState(false);
    const nightFallsTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (showVotingResults) {
            nightFallsTimerRef.current = setTimeout(() => {
                setShowNightFalls(true);
            }, 5000);
            return () => {
                if (nightFallsTimerRef.current) clearTimeout(nightFallsTimerRef.current);
            };
        } else {
            setShowNightFalls(false);
        }
    }, [showVotingResults]);

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
    };

    // --- НУАРНЫЕ КЛАССЫ ПРОТОКОЛА ---
    const LABEL = "text-white/30 font-mono text-[11px] tracking-widest uppercase w-[120px] shrink-0 pt-0.5 select-none";
    const VAL_BASE = "text-white/80 font-mono text-[13px] leading-relaxed";
    const PLAYER_NAME = "text-white/90 font-bold font-sans"; // Имена выделяем обычным читаемым шрифтом
    const DANGER = "text-[#8B0000] font-bold";
    const GOLD = "text-[#916A47] font-bold";

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            {/* ── ШАПКА АРХИВА ────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center justify-center px-5 py-3 border-b border-white/5 bg-[#0A0A0A]">
                <motion.div
                    key={`day-${dayCount}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 w-full sm:w-auto justify-center"
                >
                    <h2 className="text-sm font-mono font-bold text-[#916A47] tracking-[0.3em] uppercase">
                        [ DAY {dayCount || 1} ]
                    </h2>
                </motion.div>
            </div>

            {/* ── СОБЫТИЯ ───────────────────────────────── */}
            <div className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar bg-[#050505]/50">
                <div className="flex flex-col gap-5">
                    <AnimatePresence initial={false}>
                        {/* 1. Ночной результат */}
                        {dayEvents.nightResult && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <span className={LABEL}>&gt; NIGHT_RESULT</span>
                                <span className={VAL_BASE}>
                                    {dayEvents.nightResult.type === 'safe'
                                        ? <>No one was eliminated.</>
                                        : <><span className={PLAYER_NAME}>{dayEvents.nightResult.playerName}</span> was <span className={DANGER}>eliminated</span> last night.</>
                                    }
                                </span>
                            </motion.div>
                        )}

                        {/* 2. Фаза обсуждения */}
                        {dayEvents.discussionStarted && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <span className={LABEL}>&gt; DISCUSSION</span>
                                <span className={VAL_BASE}>
                                    {dayEvents.discussionFinished ? (
                                        <span>Discussion concluded. All players have spoken.</span>
                                    ) : dayEvents.currentSpeaker ? (
                                        <>Active speaker: <span className={GOLD}>{dayEvents.currentSpeaker}</span></>
                                    ) : (
                                        <span className="animate-pulse">Waiting for discussion to start...</span>
                                    )}
                                </span>
                            </motion.div>
                        )}

                        {/* 3. Старт голосования и Кворум */}
                        {dayEvents.votingStarted && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <span className={LABEL}>&gt; VOTING</span>
                                <span className={`${VAL_BASE} flex items-center gap-2 flex-wrap`}>
                                    <span>Voting phase has started.</span>
                                    <span>Quorum —</span>
                                    <span className={`font-bold tabular-nums ${quorumData.current >= quorumData.needed ? 'text-[#8B0000]' : 'text-white/80'}`}>
                                        {quorumData.needed}
                                    </span>
                                </span>
                            </motion.div>
                        )}

                        {/* 4. Результат голосования */}
                        {dayEvents.votingResult && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <span className={LABEL}>&gt; VOTING_RESULT</span>
                                <span className={VAL_BASE}>
                                    {dayEvents.votingResult.type === 'eliminated'
                                        ? <><span className={PLAYER_NAME}>{dayEvents.votingResult.playerName || 'A player'}</span> was <span className={DANGER}>eliminated</span> by vote.</>
                                        : <><span className={PLAYER_NAME}>No one</span> was eliminated.</>
                                    }
                                </span>
                            </motion.div>
                        )}

                        {/* 5. Наступление ночи */}
                        {(dayEvents.nightFallen || showNightFalls) && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit" className="flex items-start gap-3 pt-2">
                                <span className={LABEL}>&gt; SYSTEM</span>
                                <span className="font-mono text-[13px] font-bold uppercase tracking-[0.1em] text-[#916A47] drop-shadow-[0_0_8px_rgba(145,106,71,0.4)]">
                                    NIGHT HAS FALLEN
                                </span>
                            </motion.div>
                        )}

                        {/* Пустое состояние */}
                        {!dayEvents.nightResult && !dayEvents.discussionStarted && !dayEvents.votingStarted && !dayEvents.votingResult && !dayEvents.nightFallen && !showNightFalls && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex w-full items-center justify-center text-white/20 py-10">
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