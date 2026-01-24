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
}

export const NightActionFeedback: React.FC<NightActionFeedbackProps> = ({ myRole, nightState, gameState }) => {

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
                    bg: 'bg-rose-950/20',
                    border: 'border-rose-500/20',
                    text: 'text-rose-300',
                    separator: 'bg-rose-500/20',
                    iconBg: 'bg-rose-500',
                    highlight: 'text-rose-400'
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

            {/* MAFIA CONSENSUS UI */}
            {myRole === Role.MAFIA && (
                <>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-rose-200/60">Committed: {nightState.mafiaCommitted}</span>
                        <span className="text-rose-200/60">Revealed: {nightState.mafiaRevealed}</span>
                    </div>

                    {nightState.mafiaRevealed < nightState.mafiaCommitted && (
                        <div className="p-3 bg-rose-900/20 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-rose-300 text-sm">Waiting for other Mafia...</span>
                            </div>
                        </div>
                    )}

                    {nightState.mafiaRevealed > 0 && nightState.mafiaRevealed === nightState.mafiaCommitted && (
                        <div className="p-4 bg-rose-900/40 rounded-xl">
                            {nightState.mafiaConsensusTarget ? (
                                <>
                                    <p className="text-xs uppercase tracking-wider mb-2 text-rose-400">Kill Confirmed</p>
                                    <p className="text-xl font-bold text-rose-400 text-center">
                                        {consensusTargetName} will be eliminated
                                    </p>
                                </>
                            ) : (
                                <div className="text-left">
                                    <p className="text-xs uppercase tracking-wider mb-2 text-amber-400">Consensus Failed</p>
                                    <p className="text-lg font-bold text-amber-200 text-center">
                                        No one was killed tonight
                                    </p>
                                </div>
                            )}
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
                                        <span className={nightState.investigationResult === Role.MAFIA ? 'text-rose-500' : 'text-white/70'}>
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
