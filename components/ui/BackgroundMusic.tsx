"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import {
    Volume2,
    VolumeX,
    Square,
    Play,
    Settings,
    Music,
    Zap,
    ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioSettings } from '@/contexts/AudioContext';
import ElasticSlider from './ElasticSlider';

interface BackgroundMusicProps {
    additionalButtons?: React.ReactNode;
}

export const BackgroundMusic: React.FC<BackgroundMusicProps> = ({ additionalButtons }) => {
    const { masterVolume, setMasterVolume } = useAudioSettings();
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const pathname = usePathname();

    // Routes where general background music should play (Menu/Lobby flow)
    const MUSIC_ROUTES = ['/', '/setup', '/create', '/join', '/lobby', '/waiting'];

    // Update internal audio volume based on context and local mute
    useEffect(() => {
        if (audioRef.current) {
            // Background music uses its calibrated peak (0.02) scaled by master volume
            audioRef.current.volume = isMuted ? 0 : (0.02 * masterVolume);
        }
    }, [masterVolume, isMuted]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateState = () => setIsPlaying(!audio.paused);
        audio.addEventListener('play', updateState);
        audio.addEventListener('pause', updateState);
        return () => {
            audio.removeEventListener('play', updateState);
            audio.removeEventListener('pause', updateState);
        };
    }, []);

    const playMusic = useCallback(async () => {
        if (!audioRef.current) return;
        try {
            await audioRef.current.play();
            setIsPlaying(true);
        } catch (e) {
            setIsPlaying(false);
        }
    }, []);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const shouldPlayNow = MUSIC_ROUTES.includes(pathname) && !isStopped;

        if (shouldPlayNow) {
            playMusic();
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    }, [pathname, isStopped, playMusic]);

    useEffect(() => {
        const handleInteraction = () => {
            const shouldPlayNow = MUSIC_ROUTES.includes(pathname) && !isStopped;
            if (shouldPlayNow && audioRef.current && audioRef.current.paused) {
                playMusic();
            }
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [pathname, isStopped, playMusic]);

    const handleStop = () => {
        setIsStopped(true);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const handlePlay = () => {
        setIsStopped(false);
        setIsMuted(false);
    };

    const isMusicRoute = MUSIC_ROUTES.includes(pathname);

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3 pointer-events-none">
            <audio ref={audioRef} src="/assets/Main_Music.mp3" loop />

            {/* Expanded Settings Panel */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="pointer-events-auto mb-2 p-5 bg-black/80 backdrop-blur-2xl border border-[#916A47]/30 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-64"
                    >
                        <h3 className="text-[#916A47] text-xs font-bold uppercase tracking-widest mb-5 flex items-center gap-2">
                            <Settings className="w-3 h-3" />
                            Audio Settings
                        </h3>

                        <div className="space-y-4">
                            {/* Master Volume */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2 text-white/50">
                                        <Volume2 className="w-3 h-3" />
                                        <span>Master Volume</span>
                                    </div>
                                    <span className="text-[#916A47] font-mono">{Math.round(masterVolume * 100)}%</span>
                                </div>
                            </div>
                            <div className="px-1 py-1">
                                <ElasticSlider
                                    startingValue={masterVolume}
                                    onChange={setMasterVolume}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                />
                            </div>
                        </div>
                    </div>
                    </motion.div>
                )}
        </AnimatePresence>

            {/* Horizontal row: Sound controls (left) + Chat button (right) */ }
    <div className="flex items-center gap-3">
        {/* Main Control Bar - Sound controls only */}
        <div className="pointer-events-auto flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-xl border-2 border-white/20 rounded-full shadow-2xl group transition-all hover:bg-black/80 hover:border-[#916A47]/60">

            {/* Main Music Control (only if on music route) */}
            {isMusicRoute && (
                <>
                    {isPlaying ? (
                        <button
                            onClick={handleStop}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
                            title="Stop Background Music"
                        >
                            <Square size={14} fill="currentColor" />
                        </button>
                    ) : (
                        <button
                            onClick={handlePlay}
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#916A47]/20 text-[#916A47] hover:bg-[#916A47]/40 transition-all active:scale-95"
                            title="Play Background Music"
                        >
                            <Play size={16} fill="currentColor" className="ml-0.5" />
                        </button>
                    )}
                    <div className="w-[1px] h-6 bg-white/10 mx-1" />
                </>
            )}

            {/* Settings Toggle Button */}
            <button
                onClick={() => setShowSettings(!showSettings)}
                className={`
                            w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90
                            ${showSettings ? 'bg-[#916A47] text-white' : 'text-white/60 hover:text-white hover:bg-white/5'}
                        `}
                title="Audio Settings"
            >
                {showSettings ? <ChevronUp size={20} /> : <Volume2 size={20} />}
            </button>
        </div>

        {/* Chat Button - Separate element on the right */}
        {additionalButtons && (
            <div className="pointer-events-auto">
                {additionalButtons}
            </div>
        )}
    </div>
        </div >
    );
};
