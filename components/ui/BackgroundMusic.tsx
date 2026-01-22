"use client";

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Volume2, VolumeX, Square, Play } from 'lucide-react';
export const BackgroundMusic: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.05);
    const [isMuted, setIsMuted] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const pathname = usePathname();

    // Routes where music should play (Menu/Lobby flow)
    const ALLOWED_ROUTES = ['/', '/setup', '/create', '/join', '/lobby', '/waiting'];

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

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

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const shouldPlayNow = ALLOWED_ROUTES.includes(pathname) && !isStopped;

        if (shouldPlayNow) {
            audio.play().then(() => {
                setIsPlaying(true);
            }).catch(() => {
                // Autoplay blocked or failed
                setIsPlaying(false);
            });
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    }, [pathname, isStopped]);

    useEffect(() => {
        const handleInteraction = () => {
            const shouldPlayNow = ALLOWED_ROUTES.includes(pathname) && !isStopped;
            if (shouldPlayNow && audioRef.current && audioRef.current.paused) {
                audioRef.current.play()
                    .then(() => setIsPlaying(true))
                    .catch(e => console.error("Interaction play failed:", e));
            }
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [pathname, isStopped]);

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

    if (!ALLOWED_ROUTES.includes(pathname)) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex items-center gap-3">
            <audio ref={audioRef} src="/assets/Main_Music.mp3" loop />

            <div className="bg-black/60 backdrop-blur-xl border border-[#916A47]/40 rounded-full p-2 flex items-center gap-2 shadow-2xl group transition-all hover:bg-black/80 hover:pr-4">

                {/* Play/Stop Button */}
                {isPlaying ? (
                    <button
                        onClick={handleStop}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                        title="Stop"
                    >
                        <Square size={16} fill="currentColor" />
                    </button>
                ) : (
                    <button
                        onClick={handlePlay}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-[#916A47] text-white hover:scale-105 transition-transform"
                        title="Play"
                    >
                        <Play size={18} fill="currentColor" />
                    </button>
                )}

                {/* Mute Button */}
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/70"
                >
                    {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                <div className="w-0 overflow-hidden group-hover:w-28 transition-all duration-300 flex items-center pl-1">
                    <input
                        type="range"
                        min="0" max="1" step="0.01"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => {
                            setVolume(parseFloat(e.target.value));
                            setIsMuted(false);
                        }}
                        className="
                            w-24 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none
                            [&::-webkit-slider-thumb]:w-5
                            [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:bg-[#916A47]
                            [&::-webkit-slider-thumb]:rounded-full
                            [&::-webkit-slider-thumb]:border-2
                            [&::-webkit-slider-thumb]:border-white/20
                            [&::-webkit-slider-thumb]:shadow-lg
                        "
                    />
                </div>
            </div>
        </div>
    );
};
