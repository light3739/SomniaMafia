'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AudioSettings {
    masterVolume: number;
}

interface AudioContextType extends AudioSettings {
    setMasterVolume: (v: number) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Default master value (50% of the balanced presets we made)
    const [masterVolume, setMasterVolume] = useState(0.5);

    // Load from localStorage on mount
    useEffect(() => {
        const savedVol = localStorage.getItem('mafia_master_vol');
        if (savedVol !== null) setMasterVolume(parseFloat(savedVol));
    }, []);

    // Save to localStorage
    const handleSetMaster = (v: number) => {
        const value = Math.max(0, Math.min(1, v));
        setMasterVolume(value);
        localStorage.setItem('mafia_master_vol', value.toString());
    };

    return (
        <AudioContext.Provider value={{
            masterVolume,
            setMasterVolume: handleSetMaster
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
