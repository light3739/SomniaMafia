import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Role, GameState } from '../../types';
import { Skull, Shield, Search, Check, Clock, AlertCircle } from 'lucide-react';

interface NightState {
    hasCommitted: boolean;
    hasRevealed: boolean;
    commitHash: string | null;
    salt: string | null;
    investigationResult: Role | null;
    teammates: `0x${string}`[];
    committedTarget: `0x${string}` | null;
    mafiaCommitted: number;
    mafiaRevealed: number;
    mafiaConsensusTarget: `0x${string}` | null;
}

interface NightActionFeedbackProps {
    myRole: Role;
    nightState: NightState;
    gameState: GameState;
    aliveMafiaCount?: number; // Total alive mafia for consensus progress
}

export const NightActionFeedback: React.FC<NightActionFeedbackProps> = ({ myRole, nightState, gameState, aliveMafiaCount }) => {

    // Calculate if all mafia have committed/revealed
    const totalMafia = aliveMafiaCount || nightState.mafiaCommitted || 1;
    const allMafiaCommitted = nightState.mafiaCommitted >= totalMafia;
    const allMafiaRevealed = nightState.mafiaRevealed >= totalMafia;

    // Memoize player lookup to avoid recalculation on every render
    const targetName = useMemo(() => {
        if (!nightState.committedTarget) return 'Target';
        return gameState.players.find(p => p.address.toLowerCase() === nightState.committedTarget?.toLowerCase())?.name || 'Unknown';
    }, [gameState.players, nightState.committedTarget]);

    const consensusTargetName = useMemo(() => {
        if (!nightState.mafiaConsensusTarget) return 'Target';
        return gameState.players.find(p => p.address.toLowerCase() === nightState.mafiaConsensusTarget?.toLowerCase())?.name || 'Unknown';
    }, [gameState.players, nightState.mafiaConsensusTarget]);

    // Role-specific styles
    const getRoleStyles = () => {
        switch (myRole) {
            case Role.MAFIA:
                return {
                    bg: 'bg-[#8B0000]/10',
                    border: 'border-[#8B0000]/30',
                    text: 'text-[#8B0000]',
                    separator: 'bg-[#8B0000]/20',
                    iconBg: 'bg-[#8B0000]',
                    highlight: 'text-[#8B0000]'
                };
            case Role.DOCTOR:
                return {
                    bg: 'bg-teal-950/20',
                    border: 'border-teal-500/20',
                    text: 'text-teal-300',
                    separator: 'bg-teal-500/20',
                    iconBg: 'bg-teal-500',
                    highlight: 'text-teal-400'
                };
            case Role.DETECTIVE:
                return {
                    bg: 'bg-sky-950/20',
                    border: 'border-sky-500/20',
                    text: 'text-sky-300',
                    separator: 'bg-sky-500/20',
                    iconBg: 'bg-sky-500',
                    highlight: 'text-sky-400'
                };
            default:
                return {
                    bg: 'bg-gray-950/20',
                    border: 'border-gray-500/20',
                    text: 'text-gray-300',
                    separator: 'bg-gray-500/20',
                    iconBg: 'bg-gray-500',
                    highlight: 'text-gray-400'
                };
        }
    };

    const styles = getRoleStyles();

    return (
        <div className={`mb-4 p-4 ${styles.bg} rounded-2xl w-full`}>
            <div className="flex items-center gap-2 mb-1">
                <span className={`${styles.text} text-sm font-medium`}>
                    {myRole === Role.MAFIA ? 'Mafia Consensus' :
                        myRole === Role.DOCTOR ? 'Doctor Status' : 'Detective Status'}
                </span>
            </div>
            <div className={`h-px w-full ${styles.separator} mb-3`} />

            {/* MAFIA STATUS UI (GM Server flow) */}
            {myRole === Role.MAFIA && (
                <>
                    {nightState.mafiaConsensusTarget ? (
                        <div className="p-4 bg-[#8B0000]/20 rounded-xl">
                            <p className="text-xs uppercase tracking-wider mb-2 text-[#8B0000]">Kill Order Submitted</p>
                            <p className="text-xl font-bold text-[#8B0000] text-center">
                                {consensusTargetName} will be eliminated
                            </p>
                        </div>
                    ) : nightState.hasCommitted ? (
                        <div className="p-3 bg-[#8B0000]/10 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Check className="w-4 h-4 text-[#8B0000]" />
                                <span className="text-[#8B0000]/80 text-sm">
                                    Kill order sealed
                                </span>
                            </div>
                            <p className="text-white/20 text-xs mt-2">
                                The target will be eliminated at dawn unless protected.
                            </p>
                        </div>
                    ) : (
                        <div className="p-3 bg-[#8B0000]/5 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#8B0000] animate-pulse" />
                                <span className="text-[#8B0000]/70 text-sm">Waiting for action...</span>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* DOCTOR / DETECTIVE STATUS UI */}
            {(myRole === Role.DOCTOR || myRole === Role.DETECTIVE) && (
                <AnimatePresence mode="wait">
                    {!nightState.hasRevealed || (myRole === Role.DETECTIVE && nightState.investigationResult === null) ? (
                        <motion.div
                            key="waiting"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.3 }}
                            className={`p-3 ${myRole === Role.DOCTOR ? 'bg-teal-900/20' : 'bg-sky-900/20'} rounded-lg`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${styles.iconBg} animate-pulse`} />
                                <span className={`${styles.text} text-sm`}>
                                    {myRole === Role.DETECTIVE ? 'Verifying investigation...' : 'Confirming protection...'}
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full space-y-4"
                        >
                            {/* DOCTOR RESULT */}
                            {myRole === Role.DOCTOR && nightState.committedTarget && (
                                <div className="p-4 rounded-xl bg-teal-900/40 text-center">
                                    <p className="text-xs uppercase tracking-wider mb-2 text-teal-400/70">Protection Active</p>
                                    <p className="text-xl font-bold text-teal-200">
                                        {targetName} is protected
                                    </p>
                                </div>
                            )}

                            {/* DETECTIVE RESULT */}
                            {myRole === Role.DETECTIVE && nightState.investigationResult !== null && (
                                <div className="p-4 rounded-xl bg-sky-900/40 text-center">
                                    <p className="text-xs uppercase tracking-wider mb-2 text-sky-400/70">Investigation Result</p>
                                    <p className="text-xl font-bold text-white">
                                        {targetName} is{' '}
                                        <span className={nightState.investigationResult === Role.MAFIA ? 'text-[#8B0000]' : 'text-white/70'}>
                                            {nightState.investigationResult === Role.MAFIA ? 'MAFIA' : 'INNOCENT'}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
};
