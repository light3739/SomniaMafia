// components/game/MockGameLayout.tsx
// Тестовый режим игры с моковыми данными для разработки и тестирования UI

import React, { useEffect } from 'react';
import { useGameContext } from '../../contexts/GameContext';
import { GameLayout } from './GameLayout';
import { MOCK_PLAYERS } from '../../services/mockData';
import { GamePhase, Role } from '../../types';
import { Button } from '../ui/Button';

export const MockGameLayout: React.FC = () => {
    const { gameState, setGameState } = useGameContext();

    // Загружаем моковые данные при монтировании
    useEffect(() => {
        if (gameState.players.length === 0) {
            setGameState(prev => ({
                ...prev,
                players: MOCK_PLAYERS.map((p, i) => ({ 
                    ...p, 
                    role: i === 0 ? Role.MAFIA : i === 1 ? Role.DOCTOR : i === 2 ? Role.DETECTIVE : Role.CIVILIAN 
                })),
                myPlayerId: MOCK_PLAYERS[0].address,
                dayCount: 1,
                phase: GamePhase.DAY
            }));
        }
    }, []);

    // Кнопки для переключения фаз (для тестирования)
    const PhaseControls = () => (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 bg-black/80 p-4 rounded-xl border border-white/10">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-2">🧪 Test Controls</p>
            <div className="flex flex-wrap gap-2">
                <Button 
                    onClick={() => setGameState(p => ({ ...p, phase: GamePhase.SHUFFLING }))}
                    className="text-xs px-3 py-1"
                    variant="secondary"
                >
                    Shuffle
                </Button>
                <Button 
                    onClick={() => setGameState(p => ({ ...p, phase: GamePhase.REVEAL }))}
                    className="text-xs px-3 py-1"
                    variant="secondary"
                >
                    Reveal
                </Button>
                <Button 
                    onClick={() => setGameState(p => ({ ...p, phase: GamePhase.DAY }))}
                    className="text-xs px-3 py-1"
                    variant="secondary"
                >
                    Day
                </Button>
                <Button 
                    onClick={() => setGameState(p => ({ ...p, phase: GamePhase.VOTING }))}
                    className="text-xs px-3 py-1"
                    variant="secondary"
                >
                    Voting
                </Button>
                <Button 
                    onClick={() => setGameState(p => ({ ...p, phase: GamePhase.NIGHT }))}
                    className="text-xs px-3 py-1"
                    variant="secondary"
                >
                    Night
                </Button>
                <Button 
                    onClick={() => setGameState(p => ({ ...p, phase: GamePhase.ENDED }))}
                    className="text-xs px-3 py-1"
                    variant="secondary"
                >
                    End
                </Button>
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
