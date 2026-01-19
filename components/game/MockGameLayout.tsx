// components/game/MockGameLayout.tsx
// Тестовый режим игры с моковыми данными для разработки и тестирования UI

import React, { useEffect, useRef } from 'react';
import { useGameContext } from '../../contexts/GameContext';
import { GameLayout } from './GameLayout';
import { MOCK_PLAYERS } from '../../services/mockData';
import { GamePhase, Role } from '../../types';
import { Button } from '../ui/Button';

export const MockGameLayout: React.FC = () => {
    const { gameState, setGameState, setIsTestMode } = useGameContext();
    const hasInitialized = useRef(false);

    useEffect(() => {
        setIsTestMode(true);
        return () => setIsTestMode(false);
    }, [setIsTestMode]);

    // Загружаем моковые данные ТОЛЬКО один раз при первом монтировании
    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        setGameState(prev => ({
            ...prev,
            players: MOCK_PLAYERS.map((p, i) => ({
                ...p,
                role: i === 0 ? Role.MAFIA : i === 1 ? Role.DOCTOR : i === 2 ? Role.DETECTIVE : Role.CIVILIAN
            })),
            myPlayerId: MOCK_PLAYERS[0].address, // '0x1111111111111111111111111111111111111111'
            dayCount: 1,
            phase: GamePhase.DAY
        }));
    }, [setGameState]);

    // Функция для смены роли текущего игрока (первого в списке)
    const setMyRole = (role: Role) => {
        setGameState(prev => ({
            ...prev,
            players: prev.players.map((p, i) => i === 0 ? { ...p, role } : p)
        }));
    };

    // Кнопки для переключения фаз (для тестирования)
    const PhaseControls = () => (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-3 bg-black/80 p-4 rounded-xl border border-white/10 max-w-xs">
            <p className="text-xs text-white/50 uppercase tracking-wider">🧪 Test Controls</p>

            {/* Phase Controls */}
            <div>
                <p className="text-[10px] text-white/30 uppercase mb-1">Phase</p>
                <div className="flex flex-wrap gap-1">
                    <Button
                        onClick={() => setGameState(p => ({ ...p, phase: GamePhase.SHUFFLING }))}
                        className="text-xs px-2 py-1"
                        variant="secondary"
                    >
                        Shuffle
                    </Button>
                    <Button
                        onClick={() => setGameState(p => ({ ...p, phase: GamePhase.REVEAL }))}
                        className="text-xs px-2 py-1"
                        variant="secondary"
                    >
                        Reveal
                    </Button>
                    <Button
                        onClick={() => setGameState(p => ({ ...p, phase: GamePhase.DAY }))}
                        className="text-xs px-2 py-1"
                        variant="secondary"
                    >
                        Day
                    </Button>
                    <Button
                        onClick={() => setGameState(p => ({ ...p, phase: GamePhase.VOTING }))}
                        className="text-xs px-2 py-1"
                        variant="secondary"
                    >
                        Voting
                    </Button>
                    <Button
                        onClick={() => setGameState(p => ({ ...p, phase: GamePhase.NIGHT }))}
                        className="text-xs px-2 py-1"
                        variant="secondary"
                    >
                        Night
                    </Button>
                    <Button
                        onClick={() => setGameState(p => ({ ...p, phase: GamePhase.ENDED }))}
                        className="text-xs px-2 py-1"
                        variant="secondary"
                    >
                        End
                    </Button>
                </div>
            </div>

            {/* Role Controls */}
            <div>
                <p className="text-[10px] text-white/30 uppercase mb-1">Your Role</p>
                <div className="flex flex-wrap gap-1">
                    <Button
                        onClick={() => setMyRole(Role.MAFIA)}
                        className={`text-xs px-2 py-1 ${gameState.players[0]?.role === Role.MAFIA ? 'ring-2 ring-red-500' : ''}`}
                        variant="secondary"
                    >
                        🔪 Mafia
                    </Button>
                    <Button
                        onClick={() => setMyRole(Role.DOCTOR)}
                        className={`text-xs px-2 py-1 ${gameState.players[0]?.role === Role.DOCTOR ? 'ring-2 ring-green-500' : ''}`}
                        variant="secondary"
                    >
                        🩺 Doctor
                    </Button>
                    <Button
                        onClick={() => setMyRole(Role.DETECTIVE)}
                        className={`text-xs px-2 py-1 ${gameState.players[0]?.role === Role.DETECTIVE ? 'ring-2 ring-blue-500' : ''}`}
                        variant="secondary"
                    >
                        🔍 Detective
                    </Button>
                    <Button
                        onClick={() => setMyRole(Role.CIVILIAN)}
                        className={`text-xs px-2 py-1 ${gameState.players[0]?.role === Role.CIVILIAN ? 'ring-2 ring-gray-500' : ''}`}
                        variant="secondary"
                    >
                        👤 Civilian
                    </Button>
                </div>
            </div>

            {/* Current State Display */}
            <div className="text-[10px] text-white/40 border-t border-white/10 pt-2 mt-1">
                Phase: <span className="text-white/70">{gameState.phase}</span> |
                Role: <span className={`${gameState.players[0]?.role === Role.MAFIA ? 'text-red-400' :
                    gameState.players[0]?.role === Role.DOCTOR ? 'text-green-400' :
                        gameState.players[0]?.role === Role.DETECTIVE ? 'text-blue-400' :
                            'text-gray-400'
                    }`}>{gameState.players[0]?.role}</span>
            </div>
        </div>
    );

    return (
        <>
            <GameLayout />
            <PhaseControls />
        </>
    );
};
