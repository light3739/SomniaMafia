// components/game/MockGameLayout.tsx
// Тестовый режим игры с моковыми данными для разработки и тестирования UI

import React, { useEffect, useRef } from 'react';
import { useGameContext } from '../../contexts/GameContext';
import { GameLayout } from './GameLayout';
import { MOCK_PLAYERS } from '../../services/mockData';
import { GamePhase, Role } from '../../types';
import { Button } from '../ui/Button';

export const MockGameLayout: React.FC = () => {
    const { gameState, setGameState, setIsTestMode, endGameZK, setCurrentRoomId } = useGameContext();
    const hasInitialized = useRef(false);

    useEffect(() => {
        setIsTestMode(true);
        // Force a mock roomId if none is set
        setCurrentRoomId(BigInt(1));

        return () => {
            setIsTestMode(false);
            setCurrentRoomId(null);
        };
    }, [setIsTestMode, setCurrentRoomId]);

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

    // Функция для смены роли игрока
    const setRole = (playerIndex: number, role: Role) => {
        setGameState(prev => ({
            ...prev,
            players: prev.players.map((p, i) => i === playerIndex ? { ...p, role } : p)
        }));
    };

    // Функция для переключения статуса жизни
    const toggleLife = (playerIndex: number) => {
        setGameState(prev => ({
            ...prev,
            players: prev.players.map((p, i) => i === playerIndex ? { ...p, isAlive: !p.isAlive } : p)
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
                    <Button
                        onClick={() => endGameZK()}
                        className="text-xs px-2 py-1 bg-purple-900/50 hover:bg-purple-800"
                        variant="secondary"
                    >
                        End via ZK
                    </Button>
                </div>
            </div>

            {/* Role & Life Controls */}
            <div>
                <p className="text-[10px] text-white/30 uppercase mb-1">Players Status</p>
                <div className="flex flex-col gap-2">
                    {gameState.players.map((p, i) => (
                        <div key={p.address} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
                            <span className="text-[10px] text-white/50 truncate w-20">{p.name}</span>
                            <div className="flex gap-1">
                                <Button
                                    onClick={() => toggleLife(i)}
                                    className={`text-[8px] px-1 py-0.5 ${!p.isAlive ? 'bg-red-900 text-white' : 'bg-green-900/30'}`}
                                    variant="secondary"
                                >
                                    {p.isAlive ? 'LIVE' : 'DEAD'}
                                </Button>
                                <select
                                    className="bg-black text-[8px] border border-white/10 rounded"
                                    value={p.role}
                                    onChange={(e) => setRole(i, e.target.value as Role)}
                                >
                                    {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>
                    ))}
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
