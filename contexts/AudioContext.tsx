'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AudioSettings {
    musicVolume: number;
    sfxVolume: number;
}

interface AudioContextType extends AudioSettings {
    setMusicVolume: (v: number) => void;
    setSfxVolume: (v: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default values
    const [musicVolume, setMusicVolume] = useState(0.5); // Default 50% slider
    const [sfxVolume, setSfxVolume] = useState(0.7);   // Default 70% slider

    // Load from localStorage on mount
    useEffect(() => {
        const savedMusic = localStorage.getItem('mafia_music_vol');
        const savedSfx = localStorage.getItem('mafia_sfx_vol');
        if (savedMusic !== null) setMusicVolume(parseFloat(savedMusic));
        if (savedSfx !== null) setSfxVolume(parseFloat(savedSfx));
    }, []);

    // Save to localStorage
    const handleSetMusic = (v: number) => {
        const value = Math.max(0, Math.min(1, v));
        setMusicVolume(value);
        localStorage.setItem('mafia_music_vol', value.toString());
    };

    const handleSetSfx = (v: number) => {
        const value = Math.max(0, Math.min(1, v));
        setSfxVolume(value);
        localStorage.setItem('mafia_sfx_vol', value.toString());
    };

    return (
        <AudioContext.Provider value={{
            musicVolume,
            sfxVolume,
            setMusicVolume: handleSetMusic,
            setSfxVolume: handleSetSfx
        }}>
            {children}
        </AudioContext.Provider>
    );
};

export const useAudioSettings = () => {
    const context = useContext(AudioContext);
    if (!context) throw new Error('useAudioSettings must be used within AudioProvider');
    return context;
};
