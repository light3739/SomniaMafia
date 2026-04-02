import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GamePhase } from '../../types';

// ── TypewriterText ────────────────────────────────────────────────────────
const TypewriterText: React.FC<{ text: string; speed?: number; className?: string }> = ({
    text,
    speed = 28,
    className,
}) => {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        setDisplayed('');
        setDone(false);
        let i = 0;
        const interval = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(interval);
                setDone(true);
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

interface GameLogProps {
    liveDiscussion?: {
        active?: boolean;
        finished?: boolean;
        currentSpeakerName?: string | null;
    };
    forceVotingActive?: boolean;
    hideActions?: boolean;
}

export const GameLog: React.FC<GameLogProps> = React.memo(({ liveDiscussion, forceVotingActive = false, hideActions = false }) => {
    const { gameState, showVotingResults } = useGameContext();
    const votingResultsDayRef = React.useRef<number>(0);

    const dayCount = gameState.dayCount;
    const phase = gameState.phase;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const logs = gameState.logs;

    const [displayDay, setDisplayDay] = useState<number>(0);

    // Determine the actual current day based on logs, not smart contract dayCount which might be ahead.
    const actualLoggedDay = useMemo(() => {
        for (let i = logs.length - 1; i >= 0; i--) {
            const msg = logs[i].message;
            const match = msg.match(/Day (\d+) has begun/);
            if (match) return Number(match[1]);
        }
        return 1;
    }, [logs]);

    // Track which day to display when voting results are shown.
    useEffect(() => {
        if (showVotingResults && votingResultsDayRef.current === 0) {
            votingResultsDayRef.current = actualLoggedDay;
            setDisplayDay(actualLoggedDay);
        } else if (!showVotingResults) {
            votingResultsDayRef.current = 0;
            setDisplayDay(0);
        }
    }, [showVotingResults, actualLoggedDay]);

    const todayLogs = useMemo(() => {
        if (!logs.length) return [];

        const targetDay = (showVotingResults && votingResultsDayRef.current > 0)
            ? votingResultsDayRef.current
            : actualLoggedDay;

        let startIndex = 0;
        let foundExact = false;
        let fallbackIndex = -1;

        for (let i = logs.length - 1; i >= 0; i--) {
            const msg = logs[i].message;
            const dayMatch = msg.match(/Day (\d+) has begun/);
            if (dayMatch) {
                const logDay = Number(dayMatch[1]);
                if (logDay === targetDay) {
                    startIndex = i;
                    if (i > 0 && logs[i - 1].message.includes('Night Result:')) {
                        startIndex = i - 1;
                    }
                    foundExact = true;
                    break;
                }
                if (logDay === targetDay - 1 && fallbackIndex === -1) {
                    fallbackIndex = i;
                }
            } else if (msg.includes('Game started!')) {
                startIndex = i;
                foundExact = true;
                break;
            }
        }

        if (!foundExact && fallbackIndex !== -1) {
            startIndex = fallbackIndex;
            if (startIndex > 0 && logs[startIndex - 1].message.includes('Night Result:')) {
                startIndex = startIndex - 1;
            }
        }

        return logs.slice(startIndex);
    }, [logs, actualLoggedDay, showVotingResults]);

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
                        if (log.eventData?.isSafe) nightResult = { type: 'safe' };
                        else if (log.eventData?.isEliminated) nightResult = { type: 'killed', playerName: log.eventData.playerName };
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
                        if (log.eventData?.isSafe) votingResult = { type: 'no_one' };
                        else if (log.eventData?.isEliminated) votingResult = { type: 'eliminated', playerName: log.eventData.playerName };
                        break;
                    case 'NIGHT_FALLS':
                        nightFallen = true;
                        break;
                }
            } else {
                const msg = log.message;
                if (msg.includes('Night Result: No one died')) nightResult = { type: 'safe' };
                else if (msg.includes('Night Result:') && msg.includes('was killed')) {
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
                if (msg.includes('All players have spoken') || msg.includes('Starting Vote')) discussionFinished = true;
                if (msg.includes('Voting Phase Started')) votingStarted = true;
                if (msg.includes('voted for')) {
                    const match = msg.match(/(.+?) voted for (.+)/);
                    if (match) voteCasts.push({ voter: match[1], target: match[2] });
                }
                if (msg.includes('eliminated') && log.type === 'danger' && !msg.includes('Night')) {
                    const nameMatch = msg.match(/^(.+?) eliminated/);
                    if (nameMatch) votingResult = { type: 'eliminated', playerName: nameMatch[1] };
                }
                if (msg.includes('No one was eliminated')) votingResult = { type: 'no_one' };
                if (msg.includes('Night has fallen')) nightFallen = true;
            }
        }

        if (liveDiscussion?.active) {
            discussionStarted = true;
            discussionFinished = false;
            if (liveDiscussion.currentSpeakerName) currentSpeaker = liveDiscussion.currentSpeakerName;
        } else if (liveDiscussion?.finished) {
            discussionStarted = true;
            discussionFinished = true;
        }

        if ((forceVotingActive || showVotingResults || hideActions) && !discussionStarted) {
            discussionStarted = true;
            discussionFinished = true;
        } else if (showVotingResults || hideActions) {
            discussionFinished = true;
        }

        if (forceVotingActive || showVotingResults || hideActions) {
            votingStarted = true;
        }

        const voteEntries = todayLogs.filter(l => 
            l.eventType === 'PLAYER_VOTED' || 
            (l.message.includes('voted for') && !l.eventType)
        );

        return {
            nightResult,
            discussionStarted,
            discussionFinished,
            currentSpeaker,
            votingStarted,
            voteCasts,
            votingResult,
            nightFallen,
            voteEntries
        };
    }, [todayLogs, phase, showVotingResults, liveDiscussion, forceVotingActive, hideActions]);

    const quorumData = useMemo(() => {
        const needed = Math.floor(alivePlayers.length / 2) + 1;
        return { needed };
    }, [alivePlayers.length]);

    const [showNightFalls, setShowNightFalls] = useState(false);
    useEffect(() => {
        if (showVotingResults) {
            console.log('[GameLog Debug]', { 
                targetDay: votingResultsDayRef.current, 
                todayLogs: todayLogs.length, 
                voteEntries: dayEvents.voteEntries.length,
                displayDay, dayCount 
            });
            const timer = setTimeout(() => setShowNightFalls(true), 5000);
            return () => clearTimeout(timer);
        } else {
            setShowNightFalls(false);
        }
    }, [showVotingResults, displayDay, dayCount, todayLogs.length, dayEvents.voteEntries.length]);

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 },
        exit: { opacity: 0, scale: 0.95 },
    };

    const LABEL = "text-white/30 font-mono text-[11px] tracking-widest uppercase w-[120px] shrink-0 pt-0.5 select-none";
    const VAL_BASE = "text-white/80 font-mono text-[13px] leading-relaxed";

    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [todayLogs, dayEvents.voteEntries.length]);

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-center px-5 py-3 border-b border-white/5 bg-[#0A0A0A]">
                <h2 className="text-sm font-mono font-bold text-[#916A47] tracking-[0.3em] uppercase">
                    [ DAY {displayDay || dayCount || 1} ]
                </h2>
            </div>

            <div ref={scrollRef} className="flex-1 flex flex-col p-5 overflow-y-auto custom-scrollbar bg-[#050505]/50">
                <div className="flex flex-col gap-5">
                    <AnimatePresence initial={false}>
                        {dayEvents.nightResult && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <TypewriterText text="> NIGHT_RESULT" className={LABEL} />
                                <span className={VAL_BASE}>
                                    <TypewriterText text={dayEvents.nightResult.type === 'safe' ? "No one was eliminated." : `${dayEvents.nightResult.playerName} was eliminated last night.`} speed={20} />
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
                                        <TypewriterText text={`Active speaker: ${dayEvents.currentSpeaker}`} speed={20} />
                                    ) : (
                                        <span className="animate-pulse">Waiting for discussion to start...</span>
                                    )}
                                </span>
                            </motion.div>
                        )}

                        {dayEvents.votingStarted && (
                            <div className="flex flex-col gap-3 pb-4 border-b border-dashed border-white/5">
                                <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3">
                                    <TypewriterText text="> VOTING" className={LABEL} />
                                    <span className={VAL_BASE}>
                                        <TypewriterText text={`Voting phase started. Quorum: ${quorumData.needed}`} speed={20} />
                                    </span>
                                </motion.div>
                                {dayEvents.voteEntries.map((log) => (
                                    <motion.div key={log.id} variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 pl-[120px] opacity-70 scale-95 origin-left">
                                        <div className="text-[10px] font-mono text-white/20 pt-1 w-12 flex-shrink-0">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                        <span className="text-[12px] font-mono text-white/60">
                                            <span className="text-white/40 mr-2">»</span>
                                            {log.message}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {dayEvents.votingResult && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 border-b border-dashed border-white/5 pb-4">
                                <TypewriterText text="> VOTING_RESULT" className={LABEL} />
                                <span className={VAL_BASE}>
                                    <TypewriterText text={dayEvents.votingResult.type === 'eliminated' ? `${dayEvents.votingResult.playerName || 'A player'} eliminated by vote.` : "No one was eliminated."} speed={20} />
                                </span>
                            </motion.div>
                        )}

                        {(dayEvents.nightFallen || showNightFalls) && (
                            <motion.div variants={itemVariants} initial="hidden" animate="visible" className="flex items-start gap-3 pt-2">
                                <TypewriterText text="> SYSTEM" className={LABEL} />
                                <TypewriterText text="NIGHT HAS FALLEN" className="font-mono text-[13px] font-bold uppercase tracking-[0.1em] text-[#916A47]" speed={30} />
                            </motion.div>
                        )}

                        {!dayEvents.nightResult && !dayEvents.discussionStarted && !dayEvents.votingStarted && !showNightFalls && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-full items-center justify-center text-white/20 py-10">
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