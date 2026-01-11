import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GameLog } from './GameLog';
import { PlayerSpot } from './PlayerSpot';
import { PhaseIndicator } from './PhaseIndicator';
import { Button } from '../ui/Button';
import { GamePhase } from '../../types';
import { MOCK_PLAYERS } from '../../services/mockData';
import lobbyBg from '../../assets/game_background.png';
import { BackButton } from '../ui/BackButton';

export const GameLayout: React.FC = () => {
    const { gameState, setGameState, handleNextPhase, handlePlayerAction, canActOnPlayer, getActionLabel } = useGameContext();
    const players = gameState.players || [];

    // --- ЛОГИКА РАССАДКИ ---
    const { topRow, bottomRow, leftCol, rightCol } = useMemo(() => {
        const p = [...players];
        // Балансируем: 5 сверху, 5 снизу, остальные по бокам
        return {
            topRow: p.slice(0, 5),
            rightCol: p.slice(5, 8),
            bottomRow: p.slice(8, 13),
            leftCol: p.slice(13, 16)
        };
    }, [players]);

    const loadMockData = () => {
        setGameState(prev => ({
            ...prev,
            players: MOCK_PLAYERS,
            myPlayerId: 'p-0',
            dayCount: 1,
            phase: GamePhase.DAY
        }));
    };

    // --- FIX КНОПКИ ---
    const onNextPhaseClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleNextPhase();
    };

    if (players.length === 0) {
        return (
            <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
                <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${lobbyBg})` }} />
                <h2 className="text-2xl font-['Playfair_Display'] z-10">Game Session Not Found</h2>
                <Button onClick={loadMockData} className="z-10 px-8 pointer-events-auto">Load Mock Simulation</Button>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#050505] font-['Montserrat']">

            {/* 1. ФОН */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
                    style={{
                        backgroundImage: `url(${lobbyBg})`,
                        filter: gameState.phase === GamePhase.NIGHT
                            ? 'grayscale(100%) brightness(25%) contrast(120%)'
                            : 'grayscale(30%) brightness(40%)'
                    }}
                />
                {/* Стол */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] h-[88%] rounded-[80px] border border-white/5 bg-[#916A47]/[0.02] shadow-[0_0_150px_rgba(0,0,0,0.6)_inset]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)]" />
            </div>

            {/* 2. HEADER HUD */}
            <div className="absolute top-0 left-0 right-0 z-40 h-16 px-6 flex items-center justify-between pointer-events-none select-none">
                {/* Левая часть */}
                <div className="flex items-center gap-4 pointer-events-auto">
                    <BackButton to="/lobby" className="bg-black/40 p-2 rounded-full hover:bg-[#916A47]" label="" />
                    <div className="hidden md:block">
                        <h1 className="text-white font-['Playfair_Display'] text-lg tracking-wider">Somnia Mafia</h1>
                    </div>
                </div>

                {/* Центр: Индикатор фазы */}
                <div className="absolute left-1/2 -translate-x-1/2 top-3 pointer-events-auto">
                    <PhaseIndicator phase={gameState.phase} dayCount={gameState.dayCount} />
                </div>

                {/* Правая часть: Кнопка DEV */}
                <div className="pointer-events-auto flex items-center gap-2">
                    <Button
                        onClick={onNextPhaseClick}
                        variant="outline-gold"
                        className="h-8 text-[10px] px-4 bg-black/60 backdrop-blur border-[#916A47]/40 hover:bg-[#916A47] hover:text-black shadow-[0_0_20px_rgba(145,106,71,0.2)] active:scale-95 transition-all z-50"
                    >
                        NEXT PHASE (DEV)
                    </Button>
                </div>
            </div>

            {/* 3. MAIN ARENA GRID */}
            {/*
                GRID CONFIG:
                Columns: [260px] [1fr (auto)] [260px]  -> Бока фиксированы, центр резиновый
                Rows:    [130px] [1fr (auto)] [130px]  -> Верх/Низ фиксированы, центр резиновый
            */}
            <div className="relative z-10 w-full h-full pt-16 pb-2 px-2 md:px-6 container mx-auto flex flex-col md:grid md:grid-cols-[260px_minmax(0,1fr)_260px] md:grid-rows-[130px_minmax(0,1fr)_130px]">

                {/* --- TOP ROW (5 Players) --- */}
                {/* col-span-3 означает растянуться на всю ширину. z-20 чтобы быть над столом */}
                <div className="hidden md:flex col-span-3 row-start-1 justify-center items-start gap-4 lg:gap-12 z-20 pt-2">
                    {topRow.map(player => (
                        <div key={player.id} className="w-[130px] lg:w-[140px] flex justify-center">
                            <PlayerSpot
                                player={player}
                                isMe={player.id === gameState.myPlayerId}
                                onClick={() => handlePlayerAction(player.id)}
                                canAct={canActOnPlayer(player)}
                            />
                        </div>
                    ))}
                </div>

                {/* --- LEFT COLUMN (3 Players) --- */}
                <div className="hidden md:flex col-start-1 row-start-2 flex-col justify-center gap-4 lg:gap-8 items-start pl-2">
                    {leftCol.map(player => (
                        <div key={player.id} className="w-[180px]">
                            <PlayerSpot
                                player={player}
                                isMe={player.id === gameState.myPlayerId}
                                onClick={() => handlePlayerAction(player.id)}
                                canAct={canActOnPlayer(player)}
                            />
                        </div>
                    ))}
                </div>

                {/* --- CENTER LOG (The Feed) --- */}
                <div className="flex-1 col-start-2 row-start-2 flex flex-col justify-center items-center min-h-0 min-w-0 px-4 py-2 relative">

                    {/* Banner */}
                    <motion.div
                        key={gameState.phase}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 text-center pointer-events-none"
                    >
                        <span className="inline-block px-3 py-1 rounded-md bg-black/40 border border-[#916A47]/20 text-[#916A47] text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm">
                            {getActionLabel() === "VOTE" ? "Target Required" : "Live Feed"}
                        </span>
                    </motion.div>

                    {/* Log Container - Ограничен по высоте и ширине */}
                    <div className="w-full h-full max-h-[500px] max-w-3xl rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border border-white/5 relative bg-[#050505]/60 backdrop-blur-sm group">
                        <GameLog />
                    </div>
                </div>

                {/* --- RIGHT COLUMN (3 Players) --- */}
                <div className="hidden md:flex col-start-3 row-start-2 flex-col justify-center gap-4 lg:gap-8 items-end pr-2">
                    {rightCol.map(player => (
                        <div key={player.id} className="w-[180px] flex justify-end">
                            <div className="w-full">
                                <PlayerSpot
                                    player={player}
                                    isMe={player.id === gameState.myPlayerId}
                                    onClick={() => handlePlayerAction(player.id)}
                                    canAct={canActOnPlayer(player)}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* --- BOTTOM ROW (5 Players) --- */}
                <div className="hidden md:flex col-span-3 row-start-3 justify-center items-end gap-4 lg:gap-12 z-20 pb-2">
                    {bottomRow.map(player => (
                        <div key={player.id} className="w-[130px] lg:w-[140px] flex justify-center">
                            <PlayerSpot
                                player={player}
                                isMe={player.id === gameState.myPlayerId}
                                onClick={() => handlePlayerAction(player.id)}
                                canAct={canActOnPlayer(player)}
                            />
                        </div>
                    ))}
                </div>

                {/* --- MOBILE LAYOUT --- */}
                <div className="md:hidden flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex-1 min-h-0 mb-3 relative">
                        <GameLog />
                    </div>
                    {/* Горизонтальный скролл игроков */}
                    <div className="h-[130px] shrink-0 bg-[#0a0a0a]/50 backdrop-blur-md border-t border-white/5 -mx-4 px-4 py-2">
                        <div className="flex gap-3 overflow-x-auto h-full items-center snap-x no-scrollbar">
                            {players.map((player) => (
                                <div key={player.id} className="min-w-[110px] snap-center">
                                    <PlayerSpot
                                        player={player}
                                        isMe={player.id === gameState.myPlayerId}
                                        onClick={() => handlePlayerAction(player.id)}
                                        canAct={canActOnPlayer(player)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};