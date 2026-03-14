import { GameSignal } from '../hooks/useGameSignaling';

/**
 * Signal Bus — a global event-based communication layer.
 * Decouples game logic components from the LiveKit signaling bridge.
 */

export const emitGameSignal = (signal: GameSignal) => {
    if (typeof window === 'undefined') return;
    
    console.debug(`[SignalBus] 📢 Emitting: ${signal.type}`);
    window.dispatchEvent(new CustomEvent('send-game-signal', { detail: signal }));
};
