// components/game/NightPhase.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { ShuffleService } from '../../services/shuffleService';
import { Role, Player } from '../../types';
import { Button } from '../ui/Button';
import { Moon, Skull, Shield, Search, Eye, Check, Clock, User, Lock } from 'lucide-react';

// Night action types matching contract enum
enum NightActionType {
    NONE = 0,
    KILL = 1,
    HEAL = 2,
    CHECK = 3
}

interface NightState {
    selectedTarget: string | null;
    hasCommitted: boolean;
    hasRevealed: boolean;
    commitHash: string | null;
    salt: string | null;
}

const RoleActions: Record<Role, { action: NightActionType; label: string; icon: React.ReactNode; color: string }> = {
    [Role.MAFIA]: {
        action: NightActionType.KILL,
        label: 'Kill',
        icon: <Skull className="w-5 h-5" />,
        color: 'text-red-500'
    },
    [Role.DOCTOR]: {
        action: NightActionType.HEAL,
        label: 'Heal',
        icon: <Shield className="w-5 h-5" />,
        color: 'text-green-500'
    },
    [Role.DETECTIVE]: {
        action: NightActionType.CHECK,
        label: 'Investigate',
        icon: <Search className="w-5 h-5" />,
        color: 'text-blue-500'
    },
    [Role.CIVILIAN]: {
        action: NightActionType.NONE,
        label: 'Sleep',
        icon: <Moon className="w-5 h-5" />,
        color: 'text-gray-500'
    },
    [Role.UNKNOWN]: {
        action: NightActionType.NONE,
        label: 'Wait',
        icon: <Clock className="w-5 h-5" />,
        color: 'text-gray-500'
    }
};

export const NightPhase: React.FC = () => {
    const {
        gameState,
        currentRoomId,
        myPlayer,
        commitNightActionOnChain,
        revealNightActionOnChain,
        addLog,
        isTxPending
    } = useGameContext();

    const [nightState, setNightState] = useState<NightState>({
        selectedTarget: null,
        hasCommitted: false,
        hasRevealed: false,
        commitHash: null,
        salt: null
    });
    const [isProcessing, setIsProcessing] = useState(false);

    // Моя роль
    const myRole = myPlayer?.role || Role.UNKNOWN;
    const roleConfig = RoleActions[myRole];
    const canAct = roleConfig.action !== NightActionType.NONE;

    // Живые игроки (исключая себя для некоторых ролей)
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const validTargets = alivePlayers.filter(p => {
        // Доктор может лечить себя, остальные — только других
        if (myRole === Role.DOCTOR) return true;
        return p.address.toLowerCase() !== myPlayer?.address.toLowerCase();
    });

    // Первый игрок может финализировать ночь
    const isHost = gameState.players[0]?.address.toLowerCase() === myPlayer?.address.toLowerCase();

    // Commit action
    const handleCommit = async () => {
        if (!nightState.selectedTarget || nightState.hasCommitted) return;

        setIsProcessing(true);
        try {
            // Генерируем соль
            const salt = ShuffleService.generateSalt();

            // Создаём хэш: keccak256(abi.encodePacked(action, target, salt))
            const hash = ShuffleService.createCommitHash(
                roleConfig.action,
                nightState.selectedTarget,
                salt
            );

            // Сохраняем локально для reveal
            setNightState(prev => ({
                ...prev,
                commitHash: hash,
                salt: salt,
                hasCommitted: true
            }));

            // Отправляем хэш в контракт
            await commitNightActionOnChain(hash);
            addLog("Night action committed!", "success");
        } catch (e: any) {
            console.error("Commit failed:", e);
            addLog(e.message || "Commit failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // Reveal action
    const handleReveal = async () => {
        if (!nightState.selectedTarget || !nightState.salt || nightState.hasRevealed) return;

        setIsProcessing(true);
        try {
            await revealNightActionOnChain(
                roleConfig.action,
                nightState.selectedTarget,
                nightState.salt
            );

            setNightState(prev => ({ ...prev, hasRevealed: true }));
            addLog("Night action revealed!", "success");
        } catch (e: any) {
            console.error("Reveal failed:", e);
            addLog(e.message || "Reveal failed", "danger");
        } finally {
            setIsProcessing(false);
        }
    };

    // V3: Night auto-finalizes when all players have revealed

    // Civilians just wait - show blocked UI
    if (!canAct) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-indigo-950/30 backdrop-blur-xl rounded-3xl border border-indigo-500/20 p-8 text-center"
                >
                    {/* Lock Icon */}
                    <motion.div
                        animate={{
                            scale: [1, 1.1, 1],
                            opacity: [0.5, 1, 0.5],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="relative mx-auto mb-6"
                    >
                        <Moon className="w-16 h-16 text-indigo-400" />
                        <div className="absolute -bottom-1 -right-1 bg-indigo-900/80 rounded-full p-1">
                            <Lock className="w-5 h-5 text-indigo-300" />
                        </div>
                    </motion.div>

                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        Actions Locked
                    </h2>
                    <p className="text-white/50 text-sm mb-4">
                        You are a <span className="text-indigo-300 font-medium">{myRole}</span>.
                        You have no night abilities.
                    </p>

                    {/* Blocked message */}
                    <div className="bg-indigo-900/30 rounded-xl p-4 border border-indigo-500/20 mb-4">
                        <div className="flex items-center justify-center gap-2 text-indigo-300 mb-2">
                            <Lock className="w-4 h-4" />
                            <span className="text-sm font-medium">Player cards are disabled</span>
                        </div>
                        <p className="text-indigo-200/50 text-xs">
                            Close your eyes and wait for dawn
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-indigo-300">
                        <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-sm">Others are making their moves...</span>
                    </div>

                    {/* V3: Auto-finalize info */}
                    <div className="mt-6 text-center text-indigo-300/60 text-sm">
                        Night will end automatically when all actions are revealed
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 md:p-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-xl w-full"
            >
                {/* Header */}
                <div className="text-center mb-6">


                    <h2 className="text-2xl font-['Playfair_Display'] text-white mb-2">
                        Your Role: <span className={roleConfig.color}>{myRole}</span>
                    </h2>
                    <p className="text-white/50 text-sm">
                        {myRole === Role.MAFIA && 'Choose your target to eliminate'}
                        {myRole === Role.DOCTOR && 'Choose a player to protect tonight'}
                        {myRole === Role.DETECTIVE && 'Choose a player to investigate'}
                    </p>
                </div>

                {/* Target Selection */}
                <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-white/10 p-6 mb-6">
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-4">Select Target</p>
                    <div className="grid grid-cols-2 gap-3">
                        {validTargets.map(player => {
                            const isSelected = nightState.selectedTarget === player.address;
                            const isMe = player.address.toLowerCase() === myPlayer?.address.toLowerCase();

                            return (
                                <motion.button
                                    key={player.address}
                                    onClick={() => {
                                        if (!nightState.hasCommitted && !isProcessing) {
                                            setNightState(prev => ({
                                                ...prev,
                                                selectedTarget: isSelected ? null : player.address
                                            }));
                                        }
                                    }}
                                    disabled={nightState.hasCommitted || isProcessing}
                                    whileHover={!nightState.hasCommitted ? { scale: 1.02 } : {}}
                                    whileTap={!nightState.hasCommitted ? { scale: 0.98 } : {}}
                                    className={`
                                        p-4 rounded-2xl border transition-all text-left
                                        ${nightState.hasCommitted
                                            ? 'opacity-50 cursor-not-allowed'
                                            : ''
                                        }
                                        ${isSelected
                                            ? `${roleConfig.color === 'text-red-500'
                                                ? 'bg-red-900/30 border-red-500/50 ring-2 ring-red-500/30'
                                                : roleConfig.color === 'text-green-500'
                                                    ? 'bg-green-900/30 border-green-500/50 ring-2 ring-green-500/30'
                                                    : 'bg-blue-900/30 border-blue-500/50 ring-2 ring-blue-500/30'
                                            }`
                                            : isMe
                                                ? 'bg-[#916A47]/10 border-[#916A47]/30'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center
                                            ${isMe ? 'bg-[#916A47]' : isSelected ? 'bg-white/20' : 'bg-white/10'}
                                        `}>
                                            <User className={`w-5 h-5 ${isMe ? 'text-black' : 'text-white/60'}`} />
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isMe ? 'text-[#916A47]' : 'text-white'}`}>
                                                {player.name} {isMe && '(You)'}
                                            </p>
                                            <p className="text-xs text-white/30">
                                                {player.address.slice(0, 6)}...
                                            </p>
                                        </div>
                                    </div>
                                    {isSelected && (
                                        <div className="mt-2 flex items-center gap-1 text-xs">
                                            {roleConfig.icon}
                                            <span className={roleConfig.color}>{roleConfig.label} target</span>
                                        </div>
                                    )}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* Action Steps */}
                <div className="space-y-3">
                    {/* Step 1: Commit */}
                    <AnimatePresence mode="wait">
                        {!nightState.hasCommitted ? (
                            <motion.div
                                key="commit"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <Button
                                    onClick={handleCommit}
                                    isLoading={isProcessing || isTxPending}
                                    disabled={!nightState.selectedTarget || isProcessing || isTxPending}
                                    className="w-full"
                                >
                                    <Lock className="w-5 h-5 mr-2" />
                                    {nightState.selectedTarget
                                        ? `Commit: ${roleConfig.label} ${gameState.players.find(p => p.address === nightState.selectedTarget)?.name}`
                                        : 'Select a target first'
                                    }
                                </Button>
                                <p className="text-center text-white/30 text-xs mt-2">
                                    Step 1: Lock in your choice (encrypted)
                                </p>
                            </motion.div>
                        ) : !nightState.hasRevealed ? (
                            <motion.div
                                key="reveal"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div className="flex items-center justify-center gap-2 text-green-400 mb-3 py-2">
                                    <Check className="w-5 h-5" />
                                    <span>Committed!</span>
                                </div>
                                <Button
                                    onClick={handleReveal}
                                    isLoading={isProcessing || isTxPending}
                                    disabled={isProcessing || isTxPending}
                                    variant="outline-gold"
                                    className="w-full"
                                >
                                    <Eye className="w-5 h-5 mr-2" />
                                    Reveal Action
                                </Button>
                                <p className="text-center text-white/30 text-xs mt-2">
                                    Step 2: Reveal your action to execute it
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="done"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-center py-4"
                            >
                                <div className="flex items-center justify-center gap-2 text-green-400 mb-2">
                                    <Check className="w-5 h-5" />
                                    <span className="font-medium">Action Completed!</span>
                                </div>
                                <p className="text-white/40 text-sm">
                                    Night will end automatically when all reveal
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};
