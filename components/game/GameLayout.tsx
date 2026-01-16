import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GameLog } from './GameLog';
import { PlayerSpot } from './PlayerSpot';
import { PhaseIndicator } from './PhaseIndicator';
import { ShufflePhase } from './ShufflePhase';
import { RoleReveal } from './RoleReveal';
import { DayPhase } from './DayPhase';
import { NightPhase } from './NightPhase';
import { GameOver } from './GameOver';
import { VotingAnnouncement } from './VotingAnnouncement';
import { NightAnnouncement } from './NightAnnouncement';
import { SessionKeyBanner } from './SessionKeyBanner';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import { GamePhase, Role } from '../../types';
import dayBg from '../../assets/game_background_light.png';
import nightBg from '../../assets/game_background.png';

// Coordinates for 14 players, clockwise starting from Top-Left
const PLAYER_POSITIONS = [
    // Top Row (Left to Right)
    { id: 'p1', x: 176, y: 89 },
    { id: 'p2', x: 472, y: 89 },
    { id: 'p3', x: 767, y: 89 },
    { id: 'p4', x: 1062, y: 89 },

    // Right Col (Top to Bottom)
    { id: 'p5', x: 1187, y: 256 },
    { id: 'p6', x: 1187, y: 443 },
    { id: 'p7', x: 1187, y: 630 },

    // Bottom Row (Right to Left)
    { id: 'p8', x: 1062, y: 804 },
    { id: 'p9', x: 767, y: 804 },
    { id: 'p10', x: 459, y: 804 },
    { id: 'p11', x: 176, y: 804 },

    // Left Col (Bottom to Top)
    { id: 'p12', x: 51, y: 630 },
    { id: 'p13', x: 51, y: 443 },
    { id: 'p14', x: 51, y: 256 }
];

const BASE_WIDTH = 1488;
const BASE_HEIGHT = 1024;

export const GameLayout: React.FC = () => {
    const { gameState, setGameState, handlePlayerAction, canActOnPlayer, getActionLabel, myPlayer, currentRoomId, selectedTarget, kickStalledPlayerOnChain } = useGameContext();
    const players = gameState.players || [];

    // Handle window resize for scaling
    const [scale, setScale] = useState(1);

    // Voting announcement state
    const [showVotingAnnouncement, setShowVotingAnnouncement] = useState(false);
    const [lastVotingDay, setLastVotingDay] = useState<number | null>(null);

    // Night announcement state
    const [showNightAnnouncement, setShowNightAnnouncement] = useState(false);
    const [lastNightDay, setLastNightDay] = useState<number | null>(null);

    // Trigger Voting Announcement
    useEffect(() => {
        if (gameState.phase === GamePhase.VOTING && gameState.dayCount !== lastVotingDay) {
            setShowVotingAnnouncement(true);
            setLastVotingDay(gameState.dayCount);
        }
    }, [gameState.phase, gameState.dayCount, lastVotingDay]);

    // Trigger Night Announcement
    useEffect(() => {
        if (gameState.phase === GamePhase.NIGHT && gameState.dayCount !== lastNightDay) {
            setShowNightAnnouncement(true);
            setLastNightDay(gameState.dayCount);
        }
    }, [gameState.phase, gameState.dayCount, lastNightDay]);

    useEffect(() => {
        const handleResize = () => {
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            // Calculate scale to fit both width and height with some padding
            const scaleX = windowWidth / BASE_WIDTH;
            const scaleY = windowHeight / BASE_HEIGHT;

            // Choose the smaller scale to fit entirely, or maybe cover? 
            // "contain" behavior is usually safer for game boards so nothing gets cut off.
            // But if it's too small on mobile, we might need a different strategy. 
            // For now, let's try to fill the screen as much as possible while maintaining aspect ratio.
            const newScale = Math.min(scaleX, scaleY);

            // On very small screens, exact fit might make things tiny. 
            // But user asked for this exact layout.
            setScale(newScale);
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Render phase-specific content
    const renderPhaseContent = () => {
        switch (gameState.phase) {
            case GamePhase.SHUFFLING:
                return <ShufflePhase />;
            case GamePhase.REVEAL:
                return <RoleReveal />;
            case GamePhase.DAY:
            case GamePhase.VOTING:
                return <DayPhase />;
            case GamePhase.NIGHT:
                return <NightPhase />;
            case GamePhase.ENDED:
                return <GameOver />;
            default:
                return null;
        }
    };

    // For Shuffle/Reveal phases, show full-screen overlay (NIGHT is NOT overlay - side cards are clickable)
    const isOverlayPhase = [
        GamePhase.SHUFFLING,
        GamePhase.REVEAL,
        GamePhase.ENDED
    ].includes(gameState.phase);

    // Determine which background to use
    const isNightPhase = gameState.phase === GamePhase.NIGHT;
    const currentBg = isNightPhase ? nightBg : dayBg;

    if (players.length === 0) {
        return (
            <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
                <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${dayBg})` }} />
                <h2 className="text-2xl font-['Playfair_Display'] z-10">Game Session Not Found</h2>
                <p className="text-white/50 z-10">Join or create a lobby to start playing</p>
                <BackButton to="/setup" label="Back to Menu" />
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#050505] font-['Montserrat'] flex items-center justify-center">

            {/* 1. ФОН (Fixed Background) - Smooth transition between day/night */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Day Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
                    style={{
                        backgroundImage: `url(${dayBg})`,
                        opacity: isNightPhase ? 0 : 1,
                        filter: 'grayscale(30%) brightness(40%)'
                    }}
                />
                {/* Night Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
                    style={{
                        backgroundImage: `url(${nightBg})`,
                        opacity: isNightPhase ? 1 : 0,
                        filter: 'grayscale(100%) brightness(25%) contrast(120%)'
                    }}
                />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)]" />
            </div>

            {/* Voting Announcement Overlay */}
            <VotingAnnouncement
                show={showVotingAnnouncement}
                onComplete={() => setShowVotingAnnouncement(false)}
            />

            {/* Night Announcement Overlay */}
            <NightAnnouncement
                show={showNightAnnouncement}
                onComplete={() => setShowNightAnnouncement(false)}
            />

            {/* 2. SCALABLE GAME CONTAINER */}
            <div
                className="relative transform-gpu transition-transform duration-200 ease-out"
                style={{
                    width: BASE_WIDTH,
                    height: BASE_HEIGHT,
                    transform: `scale(${scale})`,
                    // We render it at full size then scale it down/up
                    flexShrink: 0
                }}
            >
                {/* Board Background/Table Area - matching user's "relative" container bg for visualization? 
                    User code had: background: '#FFF2E2' and overflow: 'hidden'. 
                    But usually we want transparent to see the rich game background. 
                    I'll keep it transparent but maintain the layout structure. 
                */}

                {/* Table Graphic (Optional - can be added here if needed to match the 'table' feel) */}



                {/* HEADER HUD INSIDE SCALED CONTAINER? 
                    Usually HUD is fixed to screen edges. But if we want it part of the "board layout" it goes here.
                    Let's keep Header fixed to viewport for better UX on small screens, OR scaled?
                    If we scale everything, the text might get too small.
                    Let's keep the main HUD elements FIXED to the screen (outside this container) for usability,
                    AND put the PLAYERS inside this container.
                */}

                {/* Players */}
                {PLAYER_POSITIONS.map((pos, index) => {
                    const player = players[index];
                    if (!player) return null; // Slot empty

                    return (
                        <div
                            key={player.id}
                            className={`absolute transition-all duration-500 ${isOverlayPhase ? 'opacity-20 pointer-events-none' : ''}`}
                            style={{
                                left: pos.x,
                                top: pos.y,
                                // PlayerSpot components are fixed size 250x130, so we just position them
                            }}
                        >
                            <PlayerSpot
                                player={player}
                                isMe={player.address.toLowerCase() === myPlayer?.address.toLowerCase()}
                                onClick={() => handlePlayerAction(player.address)}
                                canAct={canActOnPlayer(player)}
                                isSelected={selectedTarget?.toLowerCase() === player.address.toLowerCase()}
                                isNight={isNightPhase}
                                myRole={myPlayer?.role}
                            />
                        </div>
                    );
                })}


                {/* CENTER CONTENT (Day Phase, Vote, Logs etc) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] flex items-center justify-center z-10">
                    {/* Overlay Phases (Shuffle, Reveal, GameOver) */}
                    {isOverlayPhase && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center">
                            <div> {/* Removed scale-150 to prevent oversized UI */}
                                {renderPhaseContent()}
                            </div>
                        </div>
                    )}

                    {/* Day/Voting Phase Content */}
                    {!isOverlayPhase && (gameState.phase === GamePhase.DAY || gameState.phase === GamePhase.VOTING) && (
                        <div className="w-full h-full">
                            <DayPhase />
                        </div>
                    )}

                    {/* Night Phase Content */}
                    {!isOverlayPhase && gameState.phase === GamePhase.NIGHT && (
                        <div className="w-full h-full">
                            <NightPhase />
                        </div>
                    )}

                    {/* Lobby Phase - Show Log */}
                    {!isOverlayPhase && gameState.phase === GamePhase.LOBBY && (
                        <div className="w-full h-full max-h-[400px]">
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-3 text-center pointer-events-none"
                            >
                                <span className="inline-block px-3 py-1 rounded-md bg-black/40 border border-[#916A47]/20 text-[#916A47] text-[10px] font-bold tracking-widest uppercase backdrop-blur-sm">
                                    Live Feed
                                </span>
                            </motion.div>
                            <div className="w-full h-full rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden border border-white/5 relative bg-[#050505]/60 backdrop-blur-sm">
                                <GameLog />
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* UI OVERLAYS (Fixed to Screen, ignoring scale) */}
            <div className="fixed top-0 left-0 right-0 z-40 h-16 px-6 flex items-center justify-between pointer-events-none select-none">
                {/* Left */}
                <div className="flex items-center gap-4 pointer-events-auto">
                    <BackButton to="/lobby" className="bg-black/40 p-2 rounded-full hover:bg-[#916A47]" label="" />
                    <div className="hidden md:block">
                        <h1 className="text-white font-['Playfair_Display'] text-lg tracking-wider">Somnia Mafia</h1>
                    </div>
                </div>



                {/* Right: Phase & Role */}
                <div className="pointer-events-auto flex items-center gap-4">
                    {/* Stall/Kick Button - V4 safety mechanism */}
                    <Button
                        onClick={() => kickStalledPlayerOnChain()}
                        variant="secondary"
                        className="text-[10px] h-8 px-2 font-bold bg-red-900/20 text-red-500 border border-red-500/30 hover:bg-red-900/40"
                        title="Force game to advance if someone is AFK"
                    >
                        Kick AFK
                    </Button>

                    <PhaseIndicator phase={gameState.phase} dayCount={gameState.dayCount} />

                    {myPlayer?.role && myPlayer.role !== Role.UNKNOWN && (
                        <div className={`
                            px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                            ${myPlayer.role === Role.MAFIA
                                ? 'bg-red-900/50 text-red-400 border border-red-500/30'
                                : myPlayer.role === Role.DOCTOR
                                    ? 'bg-green-900/50 text-green-400 border border-green-500/30'
                                    : myPlayer.role === Role.DETECTIVE
                                        ? 'bg-blue-900/50 text-blue-400 border border-blue-500/30'
                                        : 'bg-amber-900/50 text-amber-400 border border-amber-500/30'
                            }
                        `}>
                            {myPlayer.role}
                        </div>
                    )}
                </div>
            </div>

            {/* Session Key Banner */}
            {currentRoomId !== null && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
                    <SessionKeyBanner roomId={Number(currentRoomId)} />
                </div>
            )}

            {/* Mobile Fallback/Warning? 
                The scaled view should work on mobile in landscape. In portrait it will be very small. 
                We might want to force landscape or just let it be small.
            */}
        </div>
    );
};