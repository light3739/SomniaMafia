"use client";

import React, { useEffect, useCallback } from 'react';

// GLOBAL SINGLETON AudioContext
let globalAudioCtx: AudioContext | null = null;

const initCtx = () => {
    if (!globalAudioCtx) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
            globalAudioCtx = new AudioContextClass();
        }
    }
    return globalAudioCtx;
};

// Функция для создания резкого щелчка/шума (Western Sharpness)
const playSharpNoise = (ctx: AudioContext, t: number, params: { duration: number, vol: number, freq: number, type: BiquadFilterType }) => {
    const bufferSize = ctx.sampleRate * params.duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = params.type;
    filter.frequency.value = params.freq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(params.vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + params.duration);

    source.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    source.start(t);
    source.stop(t + params.duration);
};

// GLOBAL Cache for decoded audio buffers
const audioBufferCache: Record<string, AudioBuffer> = {};

// Helper to load buffer
const loadAudioBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer | null> => {
    if (audioBufferCache[url]) return audioBufferCache[url];

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        audioBufferCache[url] = audioBuffer;
        return audioBuffer;
    } catch (e) {
        console.error("Failed to load audio:", url, e);
        return null;
    }
};

// Вспомогательная функция для проигрывания MP3
const playAudioFile = async (url: string, duration: number = 5, fadeIn: number = 0.05, volume: number = 1.0, startOffset: number = 0, fadeOut?: number) => {
    const ctx = initCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
        try {
            await ctx.resume();
        } catch (e) {
            console.warn("AudioContext resume failed:", e);
        }
    }

    try {
        // Try to load from cache or fetch new
        const audioBuffer = await loadAudioBuffer(ctx, url);
        if (!audioBuffer) return; // Error handled in loadAudioBuffer

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = ctx.createGain();
        const t = ctx.currentTime;

        if (startOffset >= audioBuffer.duration) return;

        const remainingDuration = audioBuffer.duration - startOffset;
        const finalDuration = Math.min(duration, remainingDuration);

        // Быстрый Fade In/Out
        gainNode.gain.setValueAtTime(0, t);

        // Instant attack if fadeIn is very small (avoid click)
        if (fadeIn < 0.01) {
            gainNode.gain.setValueAtTime(volume, t);
        } else {
            gainNode.gain.linearRampToValueAtTime(volume, t + fadeIn);
        }

        // Use provided fadeOut or fallback to fadeIn
        const actualFadeOut = fadeOut !== undefined ? fadeOut : fadeIn;

        gainNode.gain.setValueAtTime(volume, t + finalDuration - actualFadeOut);
        gainNode.gain.linearRampToValueAtTime(0, t + finalDuration);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(t, startOffset, finalDuration);
        source.stop(t + finalDuration);
    } catch (e) {
        console.error("Failed to play sound:", url, e);
    }
};

export const playSound = (type: 'button' | 'keyboard' | 'vote' | 'protect' | 'kill' | 'investigate' | 'propose' | 'approve' | 'reject') => {
    // ... существующий код playSound ...
    const ctx = initCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const t = ctx.currentTime;

    const createOsc = (freq: number, oscType: OscillatorType = 'sine', duration: number = 0.1, vol: number = 0.2, fadeStart = 0) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, t + fadeStart);
        g.gain.setValueAtTime(vol, t + fadeStart);
        g.gain.exponentialRampToValueAtTime(0.001, t + fadeStart + duration);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t + fadeStart);
        osc.stop(t + fadeStart + duration);
        return { osc, g };
    };

    switch (type) {
        case 'button':
            playAudioFile('/assets/default_sound.mp3', 1, 0.01, 0.25);
            break;

        case 'keyboard':
            createOsc(600, 'sine', 0.03, 0.05);
            playSharpNoise(ctx, t, { duration: 0.02, vol: 0.05, freq: 3000, type: 'highpass' });
            break;

        case 'vote':
            // Ставим печать (уверенно и звонко)
            createOsc(200, 'sine', 0.1, 0.4);
            playSharpNoise(ctx, t, { duration: 0.05, vol: 0.2, freq: 5000, type: 'highpass' });
            break;

        case 'protect':
            playAudioFile('/assets/protect.mp3', 2, 0.05, 0.2);
            break;

        case 'kill':
            playAudioFile('/assets/kill.wav', 2, 0.05, 0.12);
            break;

        case 'investigate':
            playAudioFile('/assets/investigate.mp3', 2, 0.05, 0.4);
            break;

        case 'propose':
            // Громкий свисток
            const oscP = ctx.createOscillator();
            const gP = ctx.createGain();
            oscP.frequency.setValueAtTime(900, t);
            oscP.frequency.exponentialRampToValueAtTime(1400, t + 0.2);
            gP.gain.setValueAtTime(0.12, t);
            gP.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            oscP.connect(gP); gP.connect(ctx.destination);
            oscP.start(t); oscP.stop(t + 0.2);
            break;

        case 'approve':
            createOsc(3000, 'sine', 0.2, 0.15);
            createOsc(3500, 'sine', 0.15, 0.1);
            break;

        case 'reject':
            playSharpNoise(ctx, t, { duration: 0.04, vol: 0.2, freq: 3000, type: 'highpass' });
            setTimeout(() => {
                const ctx2 = initCtx(); if (!ctx2) return;
                playSharpNoise(ctx2, ctx2.currentTime, { duration: 0.03, vol: 0.15, freq: 2500, type: 'highpass' });
            }, 30);
            break;
    }
};

export const useSoundEffects = () => {
    return React.useMemo(() => ({
        playClickSound: () => playSound('button'),
        playTypeSound: () => playSound('keyboard'),
        playVoteSound: () => playSound('vote'), // Звук "печати" при голосовании за кого-то
        playProtectSound: () => playSound('protect'),
        playKillSound: () => playSound('kill'),
        playInvestigateSound: () => playSound('investigate'),
        playProposeSound: () => playSound('propose'),
        playApproveSound: () => playSound('approve'),
        playRejectSound: () => playSound('reject'),
        playMarkSound: () => playAudioFile('/assets/note_tick.wav', 1, 0, 0.55),

        // Переход в ночь: длительность 5s, offset 5s, fadeOut 1s
        playNightTransition: () => playAudioFile('/assets/night_sound2.mp3', 5, 0.1, 0.45, 5, 1.0),

        // Переход в день
        playMorningTransition: () => playAudioFile('/assets/morning_sound.mp3', 5, 1, 0.15),

        // Переход к голосованию: offset 0 (играем с начала)
        playVotingStart: () => playAudioFile('/assets/Voting_sound.mp3', 4, 0.1, 0.25, 0),
    }), []);
};

export const SoundEffects: React.FC = () => {
    useEffect(() => {
        // PRELOAD ALL CRITICAL SOUNDS
        const preload = async () => {
            const ctx = initCtx();
            if (ctx) {
                const sounds = [
                    '/assets/default_sound.mp3',
                    '/assets/note_tick.wav',
                    '/assets/Voting_sound.mp3',
                    '/assets/night_sound2.mp3',
                    '/assets/morning_sound.mp3',
                    '/assets/protect.mp3',
                    '/assets/kill.wav',
                    '/assets/investigate.mp3'
                ];
                // Load sequentially or parallel
                sounds.forEach(url => loadAudioBuffer(ctx, url));
            }
        };
        preload();

        const handleButtonClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const btn = target.closest('button');
            if (btn) {
                if (btn.hasAttribute('data-custom-sound')) return;
                const txt = btn.innerText.toLowerCase();
                if (txt.includes('vote')) playSound('vote');
                else if (txt.includes('protect') || txt.includes('save')) playSound('protect');
                else if (txt.includes('kill') || txt.includes('attack')) playSound('kill');
                else if (txt.includes('investigate') || txt.includes('check')) playSound('investigate');
                else playSound('button');
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.repeat) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') playSound('keyboard');
        };
        window.addEventListener('mousedown', handleButtonClick);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('mousedown', handleButtonClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);
    return null;
};
