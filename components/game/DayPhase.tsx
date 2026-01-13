// components/game/DayPhase.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { usePublicClient } from 'wagmi';
import { MAFIA_CONTRACT_ADDRESS, MAFIA_ABI } from '../../contracts/config';
import { GamePhase, Player } from '../../types';
import { Button } from '../ui/Button';
import { Sun, Vote, Check, Clock, User, Skull } from 'lucide-react';

interface VoteState {
    myVote: string | null;
    voteCounts: Map<string, number>;
    hasVoted: boolean;
}

export const DayPhase: React.FC = () => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        startVotingOnChain,
        voteOnChain,
        finalizeVotingOnChain,
        addLog,
        isTxPending
    } = useGameContext();

    const publicClient = usePublicClient();
    const [voteState, setVoteState] = useState<VoteState>({
        myVote: null,
        voteCounts: new Map(),
        hasVoted: false
    });
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const isVotingPhase = gameState.phase === GamePhase.VOTING;
    const isDayPhase = gameState.phase === GamePhase.DAY;

    // Первый игрок (хост) может управлять фазами
    const isHost = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();

    // Живые игроки
    const alivePlayers = gameState.players.filter(p => p.isAlive);

    // Получить количество голосов из контракта
    const fetchVoteCounts = useCallback(async () => {
        if (!publicClient || !currentRoomId) return;

        try {
            const counts = new Map<string, number>();

            for (const player of gameState.players) {
                if (!player.isAlive) continue;

                const count = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'voteCounts',
                    args: [currentRoomId, player.address],
                }) as bigint;

                counts.set(player.address.toLowerCase(), Number(count));
            }

            // Проверить мой голос
            if (myPlayer) {
                const myVote = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'votes',
                    args: [currentRoomId, myPlayer.address],
                }) as string;

                setVoteState(prev => ({
                    ...prev,
                    voteCounts: counts,
                    myVote: myVote !== '0x0000000000000000000000000000000000000000' ? myVote : null,
                    hasVoted: myVote !== '0x0000000000000000000000000000000000000000'
                }));
            }
        } catch (e) {
            console.error("Failed to fetch votes:", e);
        }
    }, [publicClient, currentRoomId, gameState.players, myPlayer]);

    // Polling
    useEffect(() => {
        if (isVotingPhase) {
            fetchVoteCounts();
            const interval = setInterval(fetchVoteCounts, 3000);
            return () => clearInterval(interval);
        }
    }, [fetchVoteCounts, isVotingPhase]);

    // Начать голосование
    const handleStartVoting = async () => {
        setIsProcessing(true);
        try {
            await startVotingOnChain();
        } finally {
            setIsProcessing(false);
        }
    };

    // Проголосовать
    const handleVote = async () => {
        if (!selectedTarget) return;

        setIsProcessing(true);
        try {
            await voteOnChain(selectedTarget);
            setVoteState(prev => ({ ...prev, hasVoted: true, myVote: selectedTarget }));
            setSelectedTarget(null);
        } finally {
            setIsProcessing(false);
        }
    };

    // Завершить голосование
    const handleFinalizeVoting = async () => {
        setIsProcessing(true);
        try {
            await finalizeVotingOnChain();
        } finally {
            setIsProcessing(false);
        }
    };

    // Посчитать общее количество голосов
    const totalVotes = Array.from(voteState.voteCounts.values()).reduce((a, b) => a + b, 0);
    const quorumNeeded = Math.floor(alivePlayers.length / 2) + 1;

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl w-full"
            >
                {/* Header */}
                <div className="text-center mb-6">


                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        {isVotingPhase ? 'Choose who to eliminate' : 'Discussion Phase'}
                    </h2>
                    <p className="text-white/50 text-sm">
                        {isVotingPhase
                            ? `${totalVotes} votes cast. Quorum: ${quorumNeeded} votes needed.`
                            : 'Discuss and find the mafia among you'
                        }
                    </p>
                </div>

                {/* Player Grid */}
                <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {gameState.players.map(player => {
                            const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();
                            const voteCount = voteState.voteCounts.get(player.address.toLowerCase()) || 0;
                            const isSelected = selectedTarget === player.address;
                            const isMyVote = voteState.myVote?.toLowerCase() === player.address.toLowerCase();
                            const isDead = !player.isAlive;

                            return (
                                <motion.button
                                    key={player.address}
                                    onClick={() => {
                                        if (!isDead && !isMe && isVotingPhase && !isProcessing) {
                                            setSelectedTarget(isSelected ? null : player.address);
                                        }
                                    }}
                                    disabled={isDead || isMe || !isVotingPhase || isProcessing}
                                    whileHover={!isDead && !isMe && isVotingPhase ? { scale: 1.02 } : {}}
                                    whileTap={!isDead && !isMe && isVotingPhase ? { scale: 0.98 } : {}}
                                    className={`
                                        relative p-4 rounded-2xl border transition-all text-left
                                        ${isDead
                                            ? 'bg-gray-900/50 border-gray-800 opacity-50 cursor-not-allowed'
                                            : isSelected
                                                ? 'bg-red-900/30 border-red-500/50 ring-2 ring-red-500/30'
                                                : isMyVote
                                                    ? 'bg-[#916A47]/20 border-[#916A47]/50'
                                                    : isMe
                                                        ? 'bg-[#916A47]/10 border-[#916A47]/30 cursor-default'
                                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                        }
                                    `}
                                >
                                    {/* Dead overlay */}
                                    {isDead && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Skull className="w-8 h-8 text-red-500/50" />
                                        </div>
                                    )}

                                    {/* Player info */}
                                    <div className={`flex items-center gap-3 ${isDead ? 'opacity-30' : ''}`}>
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center
                                            ${isMe ? 'bg-[#916A47]' : 'bg-white/10'}
                                        `}>
                                            <User className={`w-5 h-5 ${isMe ? 'text-black' : 'text-white/60'}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                {player.name} {isMe && '(You)'}
                                            </p>
                                            <p className="text-xs text-white/30 font-mono">
                                                {player.address.slice(0, 6)}...
                                            </p>
                                        </div>
                                    </div>

                                    {/* Vote count badge */}
                                    {isVotingPhase && voteCount > 0 && !isDead && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg"
                                        >
                                            {voteCount}
                                        </motion.div>
                                    )}

                                    {/* My vote indicator */}
                                    {isMyVote && (
                                        <div className="absolute top-2 right-2">
                                            <Check className="w-4 h-4 text-[#916A47]" />
                                        </div>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <AnimatePresence mode="wait">
                        {isDayPhase && (
                            <motion.div
                                key="day-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <Button
                                    onClick={handleStartVoting}
                                    isLoading={isProcessing || isTxPending}
                                    disabled={isProcessing || isTxPending}
                                    className="w-full"
                                >
                                    <Vote className="w-5 h-10 mr-2" />
                                    Start Voting
                                </Button>
                                <p className="text-center text-white/30 text-xs mt-2">
                                    When ready, start the voting to eliminate a suspect
                                </p>
                            </motion.div>
                        )}

                        {isVotingPhase && (
                            <motion.div
                                key="voting-actions"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-3"
                            >
                                {/* Vote button */}
                                <Button
                                    onClick={handleVote}
                                    isLoading={isProcessing || isTxPending}
                                    disabled={!selectedTarget || isProcessing || isTxPending}
                                    variant={selectedTarget ? 'primary' : 'outline-gold'}
                                    className="w-full"
                                >
                                    {selectedTarget ? (
                                        <>
                                            <Vote className="w-5 h-10 mr-2" />
                                            Vote for {gameState.players.find(p => p.address === selectedTarget)?.name}
                                        </>
                                    ) : voteState.hasVoted ? (
                                        <>
                                            <Check className="w-5 h-10 mr-2" />
                                            Vote Cast (tap player to change)
                                        </>
                                    ) : (
                                        'Select a player to vote'
                                    )}
                                </Button>

                                {/* Finalize voting (host only or when quorum reached) */}
                                {(isHost || totalVotes >= alivePlayers.length) && (
                                    <Button
                                        onClick={handleFinalizeVoting}
                                        isLoading={isProcessing || isTxPending}
                                        disabled={isProcessing || isTxPending || totalVotes === 0}
                                        variant="outline-gold"
                                        className="w-full"
                                    >
                                        Finalize Voting ({totalVotes}/{alivePlayers.length} voted)
                                    </Button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Info */}
                <div className="mt-6 text-center">
                    <p className="text-white/20 text-xs">
                        {isVotingPhase
                            ? 'The player with the most votes (and quorum) will be eliminated'
                            : 'Talk with other players to identify the mafia'
                        }
                    </p>
                </div>
            </motion.div>
        </div>
    );
};
