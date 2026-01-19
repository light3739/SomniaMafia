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
        addLog,
        isTxPending,
        selectedTarget,
        setSelectedTarget,
    } = useGameContext();

    const publicClient = usePublicClient();
    const [voteState, setVoteState] = useState<VoteState>({
        myVote: null,
        voteCounts: new Map(),
        hasVoted: false
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const isVotingPhase = gameState.phase === GamePhase.VOTING;
    const isDayPhase = gameState.phase === GamePhase.DAY;

    // Восстановление состояния из блокчейна после рефреша
    useEffect(() => {
        // Если блокчейн говорит, что мы проголосовали, а локально мы "не в курсе"
        if (myPlayer?.hasVoted && !voteState.hasVoted) {
            console.log("Recovering vote state: Already voted on-chain");
            setVoteState(prev => ({
                ...prev,
                hasVoted: true,
                // Мы не знаем за кого голосовали (контракт не отдает это просто так),
                // но знаем ЧТО голосовали - UI заблокирует кнопку
            }));
        }
    }, [myPlayer?.hasVoted, voteState.hasVoted]);

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
                }) as number;

                counts.set(player.address.toLowerCase(), count);
            }

            // Если мы в процессе отправки голоса - не затираем Optimistic UI старыми данными с чейна
            if (isProcessing || isTxPending) {
                console.log('[DayPhase] Skipping vote sync: transaction in progress');
                return;
            }

            // Проверить мой голос
            if (myPlayer) {
                const myVote = await publicClient.readContract({
                    address: MAFIA_CONTRACT_ADDRESS,
                    abi: MAFIA_ABI,
                    functionName: 'votes',
                    args: [currentRoomId, myPlayer.address],
                }) as string;

                const hasVoted = myVote !== '0x0000000000000000000000000000000000000000';

                setVoteState(prev => ({
                    ...prev,
                    voteCounts: counts,
                    // Sticky true: keep local vote if chain lags
                    myVote: (hasVoted ? myVote : null) || prev.myVote,
                    hasVoted: prev.hasVoted || hasVoted
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

    // Проголосовать (Optimistic UI - мгновенное обновление с rollback при ошибке)
    const handleVote = async () => {
        if (!selectedTarget) return;

        // Сохраняем предыдущее состояние для rollback
        const previousVote = voteState.myVote;
        const previousHasVoted = voteState.hasVoted;
        const votedTarget = selectedTarget;

        // Optimistic: обновляем UI сразу
        setVoteState(prev => ({ ...prev, hasVoted: true, myVote: votedTarget }));
        setSelectedTarget(null);
        setIsProcessing(true);

        try {
            await voteOnChain(votedTarget);
            // Успех - UI уже обновлён
        } catch (e: any) {
            // Rollback при ошибке
            setVoteState(prev => ({ ...prev, hasVoted: previousHasVoted, myVote: previousVote }));
            addLog(e.shortMessage || "Vote failed, please try again", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // V3: Voting auto-finalizes when all players have voted

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
                                    className="w-full h-[50px]"
                                >
                                    <Vote className="w-5 h-5 mr-2" />
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
                                    className="w-full h-[50px]"
                                >
                                    {selectedTarget ? (
                                        <>
                                            <Vote className="w-5 h-5 mr-2" />
                                            Vote for {gameState.players.find(p => p.address.toLowerCase() === selectedTarget.toLowerCase())?.name}
                                        </>
                                    ) : voteState.hasVoted ? (
                                        <>
                                            <Check className="w-5 h-5 mr-2" />
                                            Vote Cast (tap player to change)
                                        </>
                                    ) : (
                                        'Select a player to vote'
                                    )}
                                </Button>

                                {/* V3: Auto-finalize info */}
                                <div className="text-center text-white/40 text-sm">
                                    {totalVotes}/{alivePlayers.length} voted • Auto-finalize when all vote
                                </div>
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
