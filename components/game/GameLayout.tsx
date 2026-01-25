"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { useGameContext } from '../../contexts/GameContext';
import { GameLog } from './GameLog';
import { PlayerSpot } from './PlayerSpot';
import { PhaseIndicator } from './PhaseIndicator';
import { VotingAnnouncement } from './VotingAnnouncement';
import { NightAnnouncement } from './NightAnnouncement';
import { MorningAnnouncement } from './MorningAnnouncement';
import { SessionKeyBanner } from './SessionKeyBanner';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import { useSoundEffects } from '../ui/SoundEffects';
import { GamePhase, Role } from '../../types';

// Dynamic imports for heavy components (code splitting)
const ShufflePhase = dynamic(() => import('./ShufflePhase').then(m => m.ShufflePhase), {
    loading: () => <div className="text-white/50 animate-pulse">Loading...</div>,
    ssr: false
});
const RoleReveal = dynamic(() => import('./RoleReveal').then(m => m.RoleReveal), {
    loading: () => <div className="text-white/50 animate-pulse">Loading...</div>,
    ssr: false
});
const DayPhase = dynamic(() => import('./DayPhase').then(m => m.DayPhase), {
    loading: () => <div className="text-white/50 animate-pulse">Loading...</div>,
    ssr: false
});
const NightPhase = dynamic(() => import('./NightPhase').then(m => m.NightPhase), {
    loading: () => <div className="text-white/50 animate-pulse">Loading...</div>,
    ssr: false
});
const NightPhaseTimer = dynamic(() => import('./NightPhase').then(m => m.NightPhaseTimer), {
    ssr: false
});
const GameOver = dynamic(() => import('./GameOver').then(m => m.GameOver), {
    loading: () => <div className="text-white/50 animate-pulse">Loading...</div>,
    ssr: false
});
const PostVotingTransition = dynamic(() => import('./PostVotingTransition').then(m => m.PostVotingTransition), {
    ssr: false
});

const dayBg = "/assets/game_background_light.webp";
const nightBg = "/assets/game_background.webp";

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

export const GameLayout: React.FC<{ initialNightState?: any }> = ({ initialNightState }) => {
    const { gameState, setGameState, handlePlayerAction, canActOnPlayer, getActionLabel, myPlayer, currentRoomId, selectedTarget, kickStalledPlayerOnChain, claimVictory, endGameZK, isTxPending, addLog, playerMarks, setPlayerMark, showVotingResults } = useGameContext();
    const { playNightTransition, playMorningTransition } = useSoundEffects();
    const players = gameState.players || [];
    const [scale, setScale] = useState(1);

    // Deterministic shuffle based on roomId for randomized seating
    const visualPlayers = useMemo(() => {
        if (!players.length) return [];
        // Keep join order in Lobby, shuffle in other phases
        if (gameState.phase === GamePhase.LOBBY || !currentRoomId) return players;

        const shuffled = [...players];
        // Use currentRoomId as seed for Fisher-Yates shuffle
        const seed = Number(currentRoomId % 1000000n);
        let m = shuffled.length, t, i;
        let s = seed;

        const random = () => {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };

        while (m) {
            i = Math.floor(random() * m--);
            t = shuffled[m];
            shuffled[m] = shuffled[i];
            shuffled[i] = t;
        }
        return shuffled;
    }, [players, gameState.phase, currentRoomId]);

    // Handle window resize for scaling

    // Voting announcement state
    const [showVotingAnnouncement, setShowVotingAnnouncement] = useState(false);
    const [showMorningAnnouncement, setShowMorningAnnouncement] = useState(false);
    const [lastMorningDay, setLastMorningDay] = useState<number | null>(null);
    const [lastVotingDay, setLastVotingDay] = useState<number | null>(null);

    // Night announcement state
    const [showNightAnnouncement, setShowNightAnnouncement] = useState(false);
    const [lastNightDay, setLastNightDay] = useState<number | null>(null);
    const [lastPhase, setLastPhase] = useState<GamePhase | null>(null);
    const [nightTransitionDelay, setNightTransitionDelay] = useState<number | null>(null);

    // Trigger Morning Announcement (Day start)
    useEffect(() => {
        const isDayStart = gameState.phase === GamePhase.DAY || gameState.phase === GamePhase.VOTING;
        if (isDayStart && gameState.dayCount > 0 && gameState.dayCount !== lastMorningDay) {
            playMorningTransition();
            setShowMorningAnnouncement(true);
            setLastMorningDay(gameState.dayCount);
        }
    }, [gameState.phase, gameState.dayCount, lastMorningDay, playMorningTransition]);

    // Trigger Voting Announcement (Voting start)
    useEffect(() => {
        // Показываем анимацию если:
        // 1. Мы перешли в фазу VOTING
        // 2. И мы еще не показывали её для этого дня ИЛИ фаза только что изменилась с DAY на VOTING
        const isVoting = gameState.phase === GamePhase.VOTING;
        const phaseChangedToVoting = isVoting && lastPhase !== GamePhase.VOTING;
        const newDayVoting = isVoting && gameState.dayCount !== lastVotingDay;

        if (phaseChangedToVoting || newDayVoting) {
            // Если мы переходим из DAY в VOTING, показываем сразу. 
            // Если из NIGHT в VOTING (через рассвет), ждем завершения рассвета.
            const isTransitionFromDay = lastPhase === GamePhase.DAY;
            const delay = isTransitionFromDay ? 0 : (gameState.dayCount === lastMorningDay ? 2000 : 0);

            const timer = setTimeout(() => {
                setShowVotingAnnouncement(true);
            }, delay);

            setLastVotingDay(gameState.dayCount);
            setLastPhase(gameState.phase);
            return () => clearTimeout(timer);
        }

        if (gameState.phase !== lastPhase) {
            setLastPhase(gameState.phase);
        }
    }, [gameState.phase, gameState.dayCount, lastVotingDay, lastMorningDay, lastPhase]);

    const lastVotingDeadlineRef = useRef<number | null>(null);

    // Track Voting Deadline
    useEffect(() => {
        if (gameState.phase === GamePhase.VOTING && gameState.phaseDeadline) {
            lastVotingDeadlineRef.current = gameState.phaseDeadline;
        }
    }, [gameState.phase, gameState.phaseDeadline]);

    // Calculate last voting result from logs for the announcement
    const votingResult = useMemo(() => {
        if (gameState.phase !== GamePhase.NIGHT) return null;
        // Search for relevant voting outcome logs
        const reversedLogs = [...gameState.logs].reverse();
        const voteLog = reversedLogs.find(l =>
            (l.type === 'danger' && l.message.includes('eliminated')) ||
            (l.type === 'warning' && l.message.includes('No one was eliminated'))
        );
        return voteLog ? voteLog.message : null;
    }, [gameState.logs, gameState.phase]);

    // Trigger Night Announcement (Night Transition)
    useEffect(() => {
        if (gameState.phase === GamePhase.NIGHT && gameState.dayCount !== lastNightDay) {
            // Always start 10s delay to allow players to read voting results
            console.log("[NightTransition] Starting 10s post-voting delay.");
            setNightTransitionDelay(10);
            setLastNightDay(gameState.dayCount);
        }
    }, [gameState.phase, gameState.dayCount, lastNightDay]);

    // Handle Night Delay Countdown
    useEffect(() => {
        if (nightTransitionDelay !== null) {
            if (nightTransitionDelay > 0) {
                const timer = setTimeout(() => {
                    setNightTransitionDelay(prev => (prev !== null ? prev - 1 : null));
                }, 1000);
                return () => clearTimeout(timer);
            } else {
                // Delay finished -> Show Night Announcement
                setNightTransitionDelay(null);
                playNightTransition();
                setShowNightAnnouncement(true);
            }
        }
    }, [nightTransitionDelay, playNightTransition]);

    // Calculate last voting result from logs for the announcement


    const handleCloseNightAnnouncement = useCallback(() => setShowNightAnnouncement(false), []);
    const handleCloseMorningAnnouncement = useCallback(() => setShowMorningAnnouncement(false), []);
    const handleCloseVotingAnnouncement = useCallback(() => setShowVotingAnnouncement(false), []);

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
                return <NightPhase initialNightState={initialNightState} />;
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
                <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isNightPhase ? 'opacity-0' : 'opacity-100'}`}>
                    <Image
                        src={dayBg}
                        alt="Day Background"
                        fill
                        priority
                        className="object-cover"
                        style={{ filter: 'grayscale(30%) brightness(40%)' }}
                    />
                </div>

                {/* Night Background */}
                <div className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${isNightPhase ? 'opacity-100' : 'opacity-0'}`}>
                    <Image
                        src={nightBg}
                        alt="Night Background"
                        fill
                        priority
                        className="object-cover"
                        style={{ filter: 'grayscale(0%) brightness(25%) contrast(100%)' }}
                    />
                </div>

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,#000_100%)] z-10" />
            </div>

            {/* Overlays in order of priority (lower in code = higher z-index) */}
            {/* 1. Environment Transitions */}
            <NightAnnouncement
                show={showNightAnnouncement}
                onComplete={handleCloseNightAnnouncement}
            />
            <MorningAnnouncement
                show={showMorningAnnouncement}
                onComplete={handleCloseMorningAnnouncement}
            />

            {/* 2. Critical Game Events (Voting is more important than Morning bg) */}
            <VotingAnnouncement
                show={showVotingAnnouncement}
                onComplete={handleCloseVotingAnnouncement}
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
                    const player = visualPlayers[index];
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
                                onAction={handlePlayerAction}
                                canAct={canActOnPlayer(player)}
                                isSelected={selectedTarget?.toLowerCase() === player.address.toLowerCase()}
                                isNight={isNightPhase}
                                myRole={myPlayer?.role}
                                mark={playerMarks[player.address.toLowerCase()] || null}
                                onSetMark={setPlayerMark}
                            />
                        </div>
                    );
                })}


                {/* CENTER CONTENT (Day Phase, Vote, Logs etc) */}
                {/* CENTER CONTENT (Day/Night/Voting) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] flex items-center justify-center z-10">
                    {/* Voting Results Transition - High Priority */}
                    {showVotingResults && (
                        <div className="w-full h-full z-20">
                            <PostVotingTransition />
                        </div>
                    )}

                    {/* Day/Voting Phase Content */}
                    {!showVotingResults && !isOverlayPhase && (gameState.phase === GamePhase.DAY || gameState.phase === GamePhase.VOTING) && (
                        <div className="w-full h-full">
                            <DayPhase />
                        </div>
                    )}

                    {/* Night Phase Content */}
                    {!showVotingResults && !isOverlayPhase && gameState.phase === GamePhase.NIGHT && (
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
            {/* OVERLAYS (Shuffle, Reveal, GameOver) - Outside scalable container for full screen coverage */}
            {isOverlayPhase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    {renderPhaseContent()}
                </div>
            )}

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
                    {/* Centered Night Timer (only visible during Night) */}
                    {gameState.phase === GamePhase.NIGHT && (
                        <div className="absolute left-1/2 -translate-x-1/2 top-6">
                            <NightPhaseTimer isTxPending={isTxPending} />
                        </div>
                    )}

                    <PhaseIndicator phase={gameState.phase} dayCount={gameState.dayCount} />
                </div>
            </div>

            {/* Session Key Banner - Bottom Left */}
            {currentRoomId !== null && (
                <div className="fixed bottom-4 left-4 z-50">
                    <SessionKeyBanner roomId={Number(currentRoomId)} />
                </div>
            )}

            {/* Test Controls - Bottom Right */}
            {(window as any).isTestMode && (
                <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 p-4 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 text-white pointer-events-auto">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Dev Tools</div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline-gold"
                            className="h-8 px-3 text-[10px]"
                            onClick={() => {
                                setGameState(prev => ({
                                    ...prev,
                                    phase: GamePhase.ENDED,
                                    players: prev.players.map(p => {
                                        if (p.role === Role.MAFIA) return { ...p, isAlive: true };
                                        if (p.role === Role.CIVILIAN) return { ...p, isAlive: false };
                                        return p;
                                    })
                                }));
                                addLog("[Test] Simulating Mafia Victory", "danger");
                            }}
                        >
                            Win: Mafia
                        </Button>
                        <Button
                            variant="outline-gold"
                            className="h-8 px-3 text-[10px]"
                            onClick={() => {
                                setGameState(prev => ({
                                    ...prev,
                                    phase: GamePhase.ENDED,
                                    players: prev.players.map(p => {
                                        if (p.role === Role.MAFIA) return { ...p, isAlive: false };
                                        if (p.role === Role.CIVILIAN) return { ...p, isAlive: true };
                                        return p;
                                    })
                                }));
                                addLog("[Test] Simulating Town Victory", "success");
                            }}
                        >
                            Win: Town
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};