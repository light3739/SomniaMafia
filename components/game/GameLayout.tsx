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
import { GameUIOverlay } from './GameUIOverlay';
import { Button } from '../ui/Button';
import { BackButton } from '../ui/BackButton';
import { useSoundEffects } from '../ui/SoundEffects';
import { GamePhase, Role } from '../../types';

// Dynamic imports for heavy components (code splitting)
const ShufflePhase = dynamic(() => import('./ShufflePhase').then(m => m.ShufflePhase), {
    loading: () => null,
    ssr: false
});
const RoleReveal = dynamic(() => import('./RoleReveal').then(m => m.RoleReveal), {
    loading: () => null,
    ssr: false
});
const DayPhase = dynamic(() => import('./DayPhase').then(m => m.DayPhase), {
    loading: () => null,
    ssr: false
});
const NightPhase = dynamic(() => import('./NightPhase').then(m => m.NightPhase), {
    loading: () => null, // No visible loading to prevent flash
    ssr: false
});
const NightPhaseTimer = dynamic(() => import('./NightPhase').then(m => m.NightPhaseTimer), {
    ssr: false
});
const GameOver = dynamic(() => import('./GameOver').then(m => m.GameOver), {
    loading: () => null,
    ssr: false
});
const PostVotingTransition = dynamic(() => import('./PostVotingTransition').then(m => m.PostVotingTransition), {
    ssr: false
});

const dayBg = "/assets/game_background_light.png";
const nightBg = "/assets/game_background.png";

const BASE_WIDTH = 1488;
const BASE_HEIGHT = 1024;

// ═══════════════════════════════════════════════════════════════
// Hand-tuned positions for 9–16 players (rectangular-ish shape).
// Symmetrized: LR mirror → x' = 1238 - x.  TB mirror (even N) → y' = 894 - y.
// Based on user's drag-and-drop constructor coordinates.
// ═══════════════════════════════════════════════════════════════
const HAND_TUNED: Record<number, { x: number; y: number }[]> = {
    9: [ // odd: 1 top, 4 right, 4 left (LR symmetric, rectangular)
        { x: 619, y: 38 },     // p1  top-center
        { x: 1058, y: 103 },   // p2  upper-right
        { x: 1229, y: 376 },   // p3  right-upper
        { x: 1181, y: 677 },   // p4  right-lower
        { x: 831, y: 831 },    // p5  lower-right
        { x: 407, y: 831 },    // p6  lower-left
        { x: 57, y: 677 },     // p7  left-lower
        { x: 9, y: 376 },      // p8  left-upper
        { x: 180, y: 103 },    // p9  upper-left
    ],
    10: [ // even: fully LR + TB symmetric (rectangular)
        { x: 810, y: 58 },     // p1  top-right
        { x: 1160, y: 177 },   // p2  right-upper
        { x: 1238, y: 447 },   // p3  right-center
        { x: 1160, y: 717 },   // p4  right-lower
        { x: 810, y: 836 },    // p5  bottom-right
        { x: 428, y: 836 },    // p6  bottom-left
        { x: 78, y: 717 },     // p7  left-lower
        { x: 0, y: 447 },      // p8  left-center
        { x: 78, y: 177 },     // p9  left-upper
        { x: 428, y: 58 },     // p10 top-left
    ],
    11: [ // odd: 1 top, 5 right, 5 left (LR symmetric, rectangular)
        { x: 619, y: 38 },     // p1  top-center
        { x: 990, y: 78 },     // p2  upper-right
        { x: 1207, y: 262 },   // p3  right-upper
        { x: 1232, y: 505 },   // p4  right-center
        { x: 1128, y: 741 },   // p5  right-lower
        { x: 793, y: 839 },    // p6  lower-right
        { x: 445, y: 839 },    // p7  lower-left
        { x: 110, y: 741 },    // p8  left-lower
        { x: 6, y: 505 },      // p9  left-center
        { x: 31, y: 262 },     // p10 left-upper
        { x: 248, y: 78 },     // p11 upper-left
    ],
    12: [ // even: fully LR + TB symmetric (rectangular)
        { x: 779, y: 52 },     // p1  top-right
        { x: 1102, y: 125 },   // p2  upper-right
        { x: 1217, y: 341 },   // p3  right-upper
        { x: 1217, y: 553 },   // p4  right-lower
        { x: 1102, y: 769 },   // p5  lower-right
        { x: 779, y: 842 },    // p6  bottom-right
        { x: 459, y: 842 },    // p7  bottom-left
        { x: 136, y: 769 },    // p8  lower-left
        { x: 21, y: 553 },     // p9  left-lower
        { x: 21, y: 341 },     // p10 left-upper
        { x: 136, y: 125 },    // p11 upper-left
        { x: 459, y: 52 },     // p12 top-left
    ],
    13: [ // odd: 1 top + 1 bottom, 5 right, 5 left (rectangular)
        { x: 619, y: 38 },     // p1  top-center
        { x: 1000, y: 58 },    // p2  upper-right
        { x: 1210, y: 230 },   // p3  right-upper
        { x: 1230, y: 447 },   // p4  right-center
        { x: 1210, y: 664 },   // p5  right-lower
        { x: 1000, y: 836 },   // p6  lower-right
        { x: 619, y: 856 },    // p7  bottom-center
        { x: 238, y: 836 },    // p8  lower-left
        { x: 28, y: 664 },     // p9  left-lower
        { x: 8, y: 447 },      // p10 left-center
        { x: 28, y: 230 },     // p11 left-upper
        { x: 238, y: 58 },     // p12 upper-left
    ],
    14: [ // even: fully LR + TB symmetric (rectangular)
        { x: 778, y: 46 },     // p1  top-right
        { x: 1104, y: 76 },    // p2  upper-right
        { x: 1212, y: 267 },   // p3  right-upper
        { x: 1238, y: 447 },   // p4  right-center
        { x: 1212, y: 627 },   // p5  right-lower
        { x: 1104, y: 818 },   // p6  lower-right
        { x: 778, y: 848 },    // p7  bottom-right
        { x: 460, y: 848 },    // p8  bottom-left
        { x: 134, y: 818 },    // p9  lower-left
        { x: 26, y: 627 },     // p10 left-lower
        { x: 0, y: 447 },      // p11 left-center
        { x: 26, y: 267 },     // p12 left-upper
        { x: 134, y: 76 },     // p13 upper-left
        { x: 460, y: 46 },     // p14 top-left
    ],
    15: [ // odd: 1 top, 7 right, 7 left (LR symmetric, rectangular)
        { x: 619, y: 36 },     // p1  top-center
        { x: 909, y: 37 },     // p2  upper-right
        { x: 1187, y: 170 },   // p3  right-upper-1
        { x: 1233, y: 347 },   // p4  right-upper-2
        { x: 1232, y: 512 },   // p5  right-center
        { x: 1200, y: 688 },   // p6  right-lower
        { x: 1053, y: 848 },   // p7  lower-right
        { x: 759, y: 860 },    // p8  bottom-right
        { x: 479, y: 860 },    // p9  bottom-left
        { x: 185, y: 848 },    // p10 lower-left
        { x: 38, y: 688 },     // p11 left-lower
        { x: 6, y: 512 },      // p12 left-center
        { x: 5, y: 347 },      // p13 left-upper-2
        { x: 51, y: 170 },     // p14 left-upper-1
        { x: 329, y: 37 },     // p15 upper-left
    ],
    16: [ // rectangular 5-3-5-3 layout (user's original design)
        { x: 51, y: 89 },      // p1  TL corner
        { x: 335, y: 38 },     // p2  top-2
        { x: 619, y: 38 },     // p3  top-center
        { x: 903, y: 38 },     // p4  top-4
        { x: 1187, y: 89 },    // p5  TR corner
        { x: 1238, y: 256 },   // p6  right-1
        { x: 1238, y: 443 },   // p7  right-center
        { x: 1238, y: 630 },   // p8  right-3
        { x: 1187, y: 804 },   // p9  BR corner
        { x: 903, y: 855 },    // p10 bottom-4
        { x: 619, y: 855 },    // p11 bottom-center
        { x: 335, y: 855 },    // p12 bottom-2
        { x: 51, y: 804 },     // p13 BL corner
        { x: 0, y: 630 },      // p14 left-3
        { x: 0, y: 443 },      // p15 left-center
        { x: 0, y: 256 },      // p16 left-1
    ],
};

/**
 * Player layout:
 * - 9–16: hand-tuned rectangular positions (from drag-and-drop constructor, symmetrized)
 * - 2–8 & 17+: regular N-gon on ellipse (flat-top for even N)
 */
export function getPlayerPositions(count: number): { id: string; x: number; y: number }[] {
    if (count === 0) return [];

    // Hand-tuned lookup
    const tuned = HAND_TUNED[count];
    if (tuned) {
        return tuned.map((p, i) => ({ id: `p${i + 1}`, x: p.x, y: p.y }));
    }

    // Ellipse fallback
    const CARD_W = 250, CARD_H = 130;
    const centerX = BASE_WIDTH / 2;
    const centerY = BASE_HEIGHT / 2;
    const rx = centerX - CARD_W / 2;
    const ry = centerY - CARD_H / 2 - 38;
    const offset = count % 2 === 0 ? Math.PI / count : 0;

    const positions: { id: string; x: number; y: number }[] = [];
    for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + offset + (2 * Math.PI * i / count);
        const x = Math.round(centerX + rx * Math.cos(angle) - CARD_W / 2);
        const y = Math.round(centerY + ry * Math.sin(angle) - CARD_H / 2);
        positions.push({ id: `p${i + 1}`, x, y });
    }
    return positions;
}

export const GameLayout: React.FC<{ initialNightState?: any; initialDiscussionState?: any }> = ({ initialNightState, initialDiscussionState }) => {
    const { gameState, setGameState, handlePlayerAction, canActOnPlayer, getActionLabel, myPlayer, currentRoomId, selectedTarget, kickStalledPlayerOnChain, claimVictory, endGameZK, isTxPending, addLog, playerMarks, setPlayerMark, showVotingResults, voteMap } = useGameContext();
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

    // Dynamic positions based on actual player count
    const playerPositions = useMemo(() => getPlayerPositions(visualPlayers.length), [visualPlayers.length]);

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

    // Discussion state for tracking current speaker (for player card glow effect)
    const [discussionState, setDiscussionState] = useState<{
        currentSpeakerAddress: string | null;
        timeRemaining: number;
    } | null>(null);

    // Fetch discussion state for player card highlighting
    const fetchDiscussionState = useCallback(async () => {
        if (!currentRoomId || gameState.phase !== GamePhase.DAY) return;
        try {
            const response = await fetch(
                `/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${myPlayer?.address || ''}`
            );
            const data = await response.json();
            if (data && data.active) {
                setDiscussionState({
                    currentSpeakerAddress: data.currentSpeakerAddress,
                    timeRemaining: data.timeRemaining
                });
            } else {
                setDiscussionState(null);
            }
        } catch (e) {
            console.error("GameLayout: Failed to fetch discussion state:", e);
        }
    }, [currentRoomId, gameState.phase, gameState.dayCount, myPlayer?.address]);

    // Poll discussion state during DAY phase
    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY || !currentRoomId) {
            setDiscussionState(null);
            return;
        }

        fetchDiscussionState();
        const interval = setInterval(fetchDiscussionState, 1000); // Poll every second for accurate time

        return () => clearInterval(interval);
    }, [gameState.phase, currentRoomId, fetchDiscussionState]);

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
                {playerPositions.map((pos, index) => {
                    const player = visualPlayers[index];
                    if (!player) return null; // Slot empty

                    // Compute voters: players who voted for this player
                    const voters = Object.entries(voteMap)
                        .filter(([_, target]) => target === player.address.toLowerCase())
                        .map(([voterAddr]) => players.find(p => p.address.toLowerCase() === voterAddr))
                        .filter((p): p is typeof players[0] => !!p);

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
                                isSpeaking={gameState.phase === GamePhase.DAY && discussionState?.currentSpeakerAddress?.toLowerCase() === player.address.toLowerCase()}
                                speechTimeRemaining={gameState.phase === GamePhase.DAY && discussionState?.currentSpeakerAddress?.toLowerCase() === player.address.toLowerCase() ? discussionState.timeRemaining : 0}
                                voters={gameState.phase === GamePhase.VOTING ? voters : []}
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
                            <DayPhase initialDiscussionState={initialDiscussionState} />
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
            {typeof window !== 'undefined' && (window as any).isTestMode && (
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
                                }))
                                addLog("[Test] Simulating Town Victory", "success");
                            }}
                        >
                            Win: Town
                        </Button>
                    </div>
                </div>
            )}

            {/* Game UI Overlay (Chat + Sound buttons) */}
            <GameUIOverlay />
        </div>
    );
};