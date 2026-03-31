// components/game/GameLayout.tsx
"use client";

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount } from 'wagmi';
import { useGameContext } from '../../contexts/GameContext';
import { PlayerSpot } from './PlayerSpot';
import { VotingAnnouncement } from './VotingAnnouncement';
import { NightAnnouncement } from './NightAnnouncement';
import { MorningAnnouncement } from './MorningAnnouncement';
import { RoleCompositionAnnouncement } from './RoleCompositionAnnouncement';
import { useGameHints } from './GameHints';
import { BackButton } from '../ui/BackButton';
import { useSoundEffects } from '../ui/SoundEffects';
import { GamePhase, Role } from '../../types';

// Layout Components
import { GameBackground } from './layout/GameBackground';
import { ResponsiveGameContainer } from './layout/ResponsiveGameContainer';
import { getPlayerPositions } from './layout/playerLayoutUtils';
export { getPlayerPositions };

const ShuffleAndReveal = dynamic(() => import('./ShuffleAndReveal').then(m => m.ShuffleAndReveal), { ssr: false });
const DayPhase = dynamic(() => import('./DayPhase').then(m => m.DayPhase), { ssr: false });
const NightPhase = dynamic(() => import('./NightPhase').then(m => m.NightPhase), { ssr: false });
const GameOver = dynamic(() => import('./GameOver').then(m => m.GameOver), { ssr: false });
const PostVotingTransition = dynamic(() => import('./PostVotingTransition').then(m => m.PostVotingTransition), { ssr: false });

const dayBg = "/assets/game_background_light.png";
const nightBg = "/assets/game_background.png";

export const GameLayout: React.FC<{ initialNightState?: any; initialDiscussionState?: any }> = ({ initialNightState, initialDiscussionState }) => {
    const {
        gameState, myPlayer, currentRoomId, selectedTarget, handlePlayerAction,
        canActOnPlayer, playerMarks, setPlayerMark, showVotingResults, voteMap, 
        isTestMode, refreshPlayersList
    } = useGameContext();
    const { playNightTransition, playMorningTransition } = useSoundEffects();
    const { showHint } = useGameHints(currentRoomId?.toString());
    const { chainId } = useAccount();

    const [showVotingAnnouncement, setShowVotingAnnouncement] = useState(false);
    const [showMorningAnnouncement, setShowMorningAnnouncement] = useState(false);
    const [showRoleComposition, setShowRoleComposition] = useState(false);
    const [hasShownRoleComposition, setHasShownRoleComposition] = useState(false);
    const [showNightAnnouncement, setShowNightAnnouncement] = useState(false);
    const [discussionState, setDiscussionState] = useState<{ currentSpeakerAddress: string | null; timeRemaining: number } | null>(null);
    const [lastPhase, setLastPhase] = useState<GamePhase | null>(null);

    const lastMorningDayRef = useRef<number | null>(null);
    const lastVotingDayRef = useRef<number | null>(null);
    const lastNightDayRef = useRef<number | null>(null);
    const nightAnnouncementPendingRef = useRef(false);
    const prevShowVotingResultsRef = useRef(false);

    // --- Announcement Callbacks ---
    const handleMorningComplete = useCallback(() => {
        setShowMorningAnnouncement(false);
        showHint('discussion');
    }, [showHint]);

    const handleNightComplete = useCallback(() => {
        setShowNightAnnouncement(false);
        const hints: Record<string, any> = {
            [Role.MAFIA]: 'night_mafia',
            [Role.DOCTOR]: 'night_doctor',
            [Role.DETECTIVE]: 'night_detective'
        };
        showHint(hints[myPlayer?.role || ''] ?? 'night_civilian');
    }, [showHint, myPlayer?.role]);

    const handleRoleCompositionComplete = useCallback(() => {
        setShowRoleComposition(false);
        playMorningTransition();
        setShowMorningAnnouncement(true);
    }, [playMorningTransition]);

    const handleVotingComplete = useCallback(() => {
        setShowVotingAnnouncement(false);
        showHint('voting');
    }, [showHint]);

    // Randomized seating
    const visualPlayers = useMemo(() => {
        if (!gameState.players.length) return [];
        if (gameState.phase === GamePhase.LOBBY || !currentRoomId) return gameState.players;
        const shuffled = [...gameState.players];
        let s = Number(currentRoomId % 1000000n), m = shuffled.length, t, i;
        const random = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
        while (m) { i = Math.floor(random() * m--); t = shuffled[m]; shuffled[m] = shuffled[i]; shuffled[i] = t; }
        return shuffled;
    }, [gameState.players, gameState.phase, currentRoomId]);

    const playerPositions = useMemo(() => getPlayerPositions(visualPlayers.length), [visualPlayers.length]);

    // Poll discussion state
    useEffect(() => {
        if (gameState.phase !== GamePhase.DAY || !currentRoomId) { setDiscussionState(null); return; }
        const fetchState = async () => {
            try {
                const res = await fetch(`/api/game/discussion?roomId=${currentRoomId}&dayCount=${gameState.dayCount}&playerAddress=${myPlayer?.address || ''}&chainId=${chainId || ''}`, { cache: 'no-store' });
                const data = await res.json();
                setDiscussionState(data && data.active ? { currentSpeakerAddress: data.currentSpeakerAddress, timeRemaining: data.timeRemaining } : null);
            } catch (e) { console.error(e); }
        };
        fetchState();
        const iv = setInterval(() => { if (gameState.phase === GamePhase.DAY) fetchState(); }, 5000);
        return () => clearInterval(iv);
    }, [gameState.phase, currentRoomId, gameState.dayCount, myPlayer?.address, chainId]);

    // Announcements trigger logic
    useEffect(() => {
        if (gameState.phase === GamePhase.DAY || gameState.phase === GamePhase.VOTING) {
            if (gameState.dayCount > 0 && gameState.dayCount !== lastMorningDayRef.current) {
                lastMorningDayRef.current = gameState.dayCount;
                if (gameState.dayCount === 1 && !hasShownRoleComposition) { setShowRoleComposition(true); setHasShownRoleComposition(true); }
                else { playMorningTransition(); setShowMorningAnnouncement(true); }
            }
        }
    }, [gameState.phase, gameState.dayCount, playMorningTransition, hasShownRoleComposition]);

    useEffect(() => {
        const isVoting = gameState.phase === GamePhase.VOTING;
        if ((isVoting && lastPhase !== GamePhase.VOTING) || (isVoting && gameState.dayCount !== lastVotingDayRef.current)) {
            const delay = lastPhase === GamePhase.DAY ? 0 : (gameState.dayCount === lastMorningDayRef.current ? 2000 : 0);
            const t = setTimeout(() => setShowVotingAnnouncement(true), delay);
            lastVotingDayRef.current = gameState.dayCount; setLastPhase(gameState.phase);
            return () => clearTimeout(t);
        }
        if (gameState.phase !== lastPhase) setLastPhase(gameState.phase);
    }, [gameState.phase, gameState.dayCount, lastPhase]);

    useEffect(() => {
        const wasShowing = prevShowVotingResultsRef.current; prevShowVotingResultsRef.current = showVotingResults;
        const entry = (wasShowing && !showVotingResults && gameState.phase === GamePhase.NIGHT) || (!showVotingResults && !wasShowing && gameState.phase === GamePhase.NIGHT);
        if (entry && gameState.dayCount !== lastNightDayRef.current) {
            if (nightAnnouncementPendingRef.current) return;
            nightAnnouncementPendingRef.current = true; lastNightDayRef.current = gameState.dayCount;
            playNightTransition(); setShowNightAnnouncement(true);
            nightAnnouncementPendingRef.current = false;
        }
    }, [gameState.phase, gameState.dayCount, playNightTransition, showVotingResults]);
    
    // === EXPOSE REFRESH FOR FAILSAFE ===
    useEffect(() => {
        (window as any).refreshGame = () => {
             if (currentRoomId) {
                 console.log('[Manual Sync] Forcing Game Data Refresh...');
                 refreshPlayersList(currentRoomId);
             }
         };
         return () => { delete (window as any).refreshGame; };
    }, [currentRoomId, refreshPlayersList]);

    const isNightPhase = gameState.phase === GamePhase.NIGHT;
    const isOverlayPhase = [GamePhase.SHUFFLING, GamePhase.REVEAL, GamePhase.ENDED].includes(gameState.phase);

    if (gameState.players.length === 0 && !isTestMode) return (
        <div className="w-full h-screen bg-black flex flex-col items-center justify-center gap-4 text-white">
            <div className="fixed inset-0 z-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${dayBg})` }} />
            <h2 className="text-2xl font-['Cinzel'] z-10">Game Session Not Found</h2>
            <BackButton to="/setup" label="Back to Menu" />
        </div>
    );

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#050505] font-['Montserrat'] flex items-center justify-center">
            <GameBackground isNightPhase={isNightPhase} dayBg={dayBg} nightBg={nightBg} />
            

            <NightAnnouncement 
                show={showNightAnnouncement} 
                onComplete={handleNightComplete} 
            />
            <MorningAnnouncement 
                show={showMorningAnnouncement} 
                onComplete={handleMorningComplete} 
            />
            <RoleCompositionAnnouncement 
                show={showRoleComposition} 
                onComplete={handleRoleCompositionComplete} 
                playerCount={gameState.players.filter(p => p.isAlive).length} 
            />
            <VotingAnnouncement 
                show={showVotingAnnouncement} 
                onComplete={handleVotingComplete} 
            />

            <ResponsiveGameContainer>
                {playerPositions.map((pos, index) => {
                    const p = visualPlayers[index]; if (!p) return null;
                    const voters = Object.entries(voteMap).filter(([_, target]) => target === p.address.toLowerCase()).map(([v]) => gameState.players.find(pl => pl.address.toLowerCase() === v)).filter((pl): pl is any => !!pl);
                    return (
                        <div key={p.id} className={`absolute transition-all duration-500 ${isOverlayPhase ? 'opacity-20 pointer-events-none' : ''}`} style={{ left: pos.x, top: pos.y }}>
                            <PlayerSpot player={p} isMe={p.address.toLowerCase() === myPlayer?.address.toLowerCase()} onAction={handlePlayerAction} canAct={canActOnPlayer(p)} isSelected={selectedTarget?.toLowerCase() === p.address.toLowerCase()} isNight={isNightPhase} myRole={myPlayer?.role} mark={playerMarks[p.address.toLowerCase()] || null} onSetMark={setPlayerMark} isSpeaking={gameState.phase === GamePhase.DAY && discussionState?.currentSpeakerAddress?.toLowerCase() === p.address.toLowerCase()} speechTimeRemaining={gameState.phase === GamePhase.DAY && discussionState?.currentSpeakerAddress?.toLowerCase() === p.address.toLowerCase() ? discussionState.timeRemaining : 0} voters={voters} />
                        </div>
                    );
                })}

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] flex items-center justify-center z-10">
                    {!isOverlayPhase && (gameState.phase === GamePhase.DAY || gameState.phase === GamePhase.VOTING || showVotingResults) && (
                        <div className="w-full h-full"><DayPhase initialDiscussionState={initialDiscussionState} hideActions={showVotingResults} disablePolling={showVotingResults && gameState.phase === GamePhase.NIGHT} /></div>
                    )}
                    {showVotingResults && <PostVotingTransition />}
                    {!showVotingResults && !isOverlayPhase && gameState.phase === GamePhase.NIGHT && (<div className="w-full h-full"><NightPhase initialNightState={initialNightState} /></div>)}
                </div>
                {/* Network Status & Manual Sync Failsafe */}
                <div className="fixed bottom-4 right-4 z-[50] flex flex-col items-end gap-2">
                    <div className={`px-3 py-1 rounded-full border backdrop-blur-md flex items-center gap-2 transition-all duration-500 ${Number(chainId) === 43113 || Number(chainId) === 50312 ? 'bg-black/40 border-white/10' : 'bg-red-500/20 border-red-500/50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${Number(chainId) === 43113 || Number(chainId) === 50312 ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                        <span className="text-[10px] text-white/50 font-mono tracking-tighter">
                            {chainId === 43113 ? 'FUJI' : chainId === 50312 ? 'SOMNIA' : `CHAIN:${chainId || '??'}`}
                        </span>
                    </div>
                </div>
            </ResponsiveGameContainer>

            {/* Overlays for Shuffling, Reveal and Game Over */}
            <AnimatePresence>
                {isOverlayPhase && (gameState.phase === GamePhase.SHUFFLING || gameState.phase === GamePhase.REVEAL) && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }} 
                        className="fixed inset-0 z-[50]"
                    >
                        <ShuffleAndReveal key="shuffle-reveal" />
                    </motion.div>
                )}
                {gameState.phase === GamePhase.ENDED && (
                    <GameOver key="gameover" />
                )}
            </AnimatePresence>
        </div>
    );
};