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

// Вспомогательная функция для проигрывания MP3
const playAudioFile = async (url: string, duration: number = 5, fadeIn: number = 0.05) => {
    // В Vite/React активы из папки public доступны по прямому пути от корня
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
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;

        const gainNode = ctx.createGain();
        const t = ctx.currentTime;

        const finalDuration = Math.min(duration, audioBuffer.duration);

        // Быстрый Fade In/Out
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(1.0, t + fadeIn); // Громкость на максимум для MP3
        gainNode.gain.setValueAtTime(1.0, t + finalDuration - fadeIn);
        gainNode.gain.linearRampToValueAtTime(0, t + finalDuration);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(t);
        source.stop(t + finalDuration);
    } catch (e) {
        console.error("Failed to play sound:", url, e);
        // Fallback: если файл не загрузился, пикнем синусоидой, чтобы пользователь хоть что-то слышал
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    }
};

export const playSound = (type: 'button' | 'keyboard' | 'vote' | 'protect' | 'kill' | 'investigate' | 'propose' | 'approve' | 'reject') => {
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
            // Используем загруженный mp3 для дефолтного звука кнопок
            playAudioFile('/assets/default_sound.mp3', 1);
            break;

        case 'keyboard':
            createOsc(600, 'sine', 0.03, 0.1);
            playSharpNoise(ctx, t, { duration: 0.02, vol: 0.1, freq: 3000, type: 'highpass' });
            break;

        case 'vote':
            // Ставим печать (уверенно и звонко)
            createOsc(200, 'sine', 0.1, 0.4);
            playSharpNoise(ctx, t, { duration: 0.05, vol: 0.2, freq: 5000, type: 'highpass' });
            break;

        case 'protect':
            // Используем загруженный mp3 для доктора
            playAudioFile('/assets/protect.mp3', 2);
            break;

        case 'kill':
            // Используем загруженный wav для мафии
            playAudioFile('/assets/kill.wav', 2);
            break;

        case 'investigate':
            // Используем загруженный mp3 для шерифа
            playAudioFile('/assets/investigate.mp3', 2);
            break;

        case 'propose':
            // Громкий свисток
            const oscP = ctx.createOscillator();
            const gP = ctx.createGain();
            oscP.frequency.setValueAtTime(900, t);
            oscP.frequency.exponentialRampToValueAtTime(1400, t + 0.2);
            gP.gain.setValueAtTime(0.2, t);
            gP.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            oscP.connect(gP); gP.connect(ctx.destination);
            oscP.start(t); oscP.stop(t + 0.2);
            break;

        case 'approve':
            // Звонкая золотая монета
            createOsc(3000, 'sine', 0.2, 0.3);
            createOsc(3500, 'sine', 0.15, 0.2);
            break;

        case 'reject':
            // ВЗВОД КУРКА (Металлический щелчок вместо барабана)
            playSharpNoise(ctx, t, { duration: 0.04, vol: 0.4, freq: 3000, type: 'highpass' });
            setTimeout(() => {
                const ctx2 = initCtx(); if (!ctx2) return;
                playSharpNoise(ctx2, ctx2.currentTime, { duration: 0.03, vol: 0.3, freq: 2500, type: 'highpass' });
            }, 30);
            break;
    }
};

export const useSoundEffects = () => {
    return {
        playClickSound: () => playSound('button'),
        playTypeSound: () => playSound('keyboard'),
        playVoteSound: () => playSound('vote'),
        playProtectSound: () => playSound('protect'),
        playKillSound: () => playSound('kill'),
        playInvestigateSound: () => playSound('investigate'),
        playProposeSound: () => playSound('propose'),
        playApproveSound: () => playSound('approve'),
        playRejectSound: () => playSound('reject'),
        playNightTransition: () => playAudioFile('/assets/night_sound.mp3', 5, 1),
        playMorningTransition: () => playAudioFile('/assets/morning_sound.mp3', 5, 1),
    };
};

export const SoundEffects: React.FC = () => {
    useEffect(() => {
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
