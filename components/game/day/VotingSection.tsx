import React from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { Button } from '../../ui/Button';
import { MicButton } from '../MicButton';
import { VotingTimer } from './VotingTimer';

interface VotingSectionProps {
    isVotingPhase: boolean;
    isNightTransition: boolean;
    delaySeconds: number | undefined;
    currentRoomId: any;
    myPlayer: any;
    isProcessing: boolean;
    isTxPending: boolean;
    voteState: any;
    selectedTarget: string | null;
    gameState: any;
    onVote: () => void;
}

export const VotingSection: React.FC<VotingSectionProps> = ({
    isVotingPhase, isNightTransition, delaySeconds, currentRoomId, myPlayer, isProcessing, isTxPending, voteState, selectedTarget, gameState, onVote
}) => {
    if (isNightTransition) {
        return (
            <motion.div
                key="transition-timer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full py-2 text-center bg-[#0A0A0A] rounded-md border border-[#916A47]/30 shadow-[0_5px_15px_rgba(0,0,0,0.8)] mt-2"
            >
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4 text-[#916A47]" />
                        <span className="text-2xl font-bold text-white tabular-nums">
                            {delaySeconds}s
                        </span>
                        <span className="text-[#916A47] text-[10px] uppercase font-bold tracking-widest ml-2">
                            Voting Results
                        </span>
                    </div>
                    <div className="text-[10px] text-white/30 font-mono mt-1 pt-1 border-t border-[#916A47]/30 animate-pulse uppercase tracking-widest px-4">
                        Review the logs above...
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            key="voting-actions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
        >
            <div className="relative">
                <VotingTimer />
                {currentRoomId && myPlayer && (
                    <div className="absolute right-[-70px] top-1/2 -translate-y-1/2">
                        <MicButton
                            roomId={`${currentRoomId}-vote`}
                            userName={myPlayer.name}
                            isMyTurn={false}
                            freeTalk={true}
                        />
                    </div>
                )}
            </div>

            <Button
                onClick={onVote}
                data-custom-sound
                isLoading={isProcessing || isTxPending}
                disabled={!selectedTarget || isProcessing || isTxPending || voteState.hasVoted}
                variant="outline-gold"
                className={`w-full h-[50px] text-base tracking-[0.08em] uppercase font-['Cinzel'] text-[13px] disabled:!brightness-100 ${voteState.hasVoted
                    ? 'disabled:!opacity-100 !bg-[#1A1510] !border-[#916A47]/30 !text-[#B88A5E] cursor-default'
                    : selectedTarget
                        ? ''
                        : 'disabled:!opacity-100 disabled:!brightness-[0.9] !bg-[#1A1612] !border-[#916A47]/30 !text-[#916A47]/40'
                    }`}
            >
                {voteState.hasVoted ? (
                    <>✓ Vote Committed</>
                ) : selectedTarget ? (
                    <>Vote for {gameState.players.find((p: any) => p.address.toLowerCase() === selectedTarget.toLowerCase())?.name}</>
                ) : (
                    'Select a target on the board'
                )}
            </Button>
        </motion.div>
    );
};
VotingSection.displayName = 'VotingSection';
