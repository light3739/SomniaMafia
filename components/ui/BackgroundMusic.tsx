"use client";

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Volume2, VolumeX } from 'lucide-react';

export const BackgroundMusic: React.FC = () => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.15); // Default 15% volume
    const [isMuted, setIsMuted] = useState(false);
    const pathname = usePathname();

    // Routes where music should play (Menu/Lobby flow)
    const ALLOWED_ROUTES = ['/', '/setup', '/create', '/join', '/waiting', '/lobby'];

    // Check if we should be playing based on current route
    const shouldPlay = ALLOWED_ROUTES.includes(pathname);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        console.log(`[Music] Route: ${pathname}, Should Play: ${shouldPlay}`);

        const attemptPlay = () => {
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log("[Music] Playing successfully");
                    setIsPlaying(true);
                }).catch(error => {
                    console.warn("[Music] Autoplay blocked or failed:", error);
                    setIsPlaying(false);
                });
            }
        };

        if (shouldPlay) {
            attemptPlay();
        } else {
            audio.pause();
            setIsPlaying(false);
        }
    }, [shouldPlay, pathname]);

    // Add a global click listener to unlock audio context if needed
    useEffect(() => {
        const handleInteraction = () => {
            if (shouldPlay && !isPlaying && audioRef.current && audioRef.current.paused) {
                console.log("[Music] User interaction detected, attempting to play...");
                audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error(e));
            }
        };

        window.addEventListener('click', handleInteraction);
        window.addEventListener('keydown', handleInteraction);
        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [shouldPlay, isPlaying]);

    if (!shouldPlay) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[60] bg-black/40 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-2 group transition-all hover:bg-black/60 hover:pr-4">
            <audio
                ref={audioRef}
                src="/assets/Main_Music.mp3"
                loop
                crossOrigin="anonymous"
            />

            <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
            >
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            {/* Slider - hidden by default, shown on hover of the container */}
            <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 flex items-center">
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                        setVolume(parseFloat(e.target.value));
                        setIsMuted(false);
                    }}
                    className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-[#916A47] [&::-webkit-slider-thumb]:rounded-full"
                />
            </div>
        </div>
    );
};
