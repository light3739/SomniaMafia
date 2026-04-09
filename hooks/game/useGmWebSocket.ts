/**
 * hooks/game/useGmWebSocket.ts — React hook for GM WebSocket push events.
 *
 * Connects to the GM server WebSocket when a roomId is available,
 * subscribes to events, and exposes connection state for fallback polling.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { gmWs, type ServerEventType, type EventHandler } from '../../services/gmWebSocket';

interface UseGmWebSocketOptions {
  /** Current room ID (null/undefined = don't connect) */
  roomId: number | bigint | null | undefined;
  /** Chain ID */
  chainId: number;
  /** Player wallet address */
  playerAddress: string | null | undefined;
  /** Event handlers — subscribe to push events from GM server */
  handlers?: Partial<Record<ServerEventType, EventHandler>>;
}

/**
 * Hook that manages the GM WebSocket lifecycle.
 * Returns `wsConnected` — use it to toggle fallback polling on/off.
 *
 * Usage:
 * ```ts
 * const { wsConnected } = useGmWebSocket({
 *   roomId: currentRoomId,
 *   chainId: runtimeChain.id,
 *   playerAddress: walletAddress,
 *   handlers: {
 *     'log': (data) => addLog(data as GameLogEntry),
 *     'phase-change': () => fetchGameData(),
 *     'player-update': () => fetchGameData(),
 *   },
 * });
 * ```
 */
export function useGmWebSocket({ roomId, chainId, playerAddress, handlers }: UseGmWebSocketOptions) {
  const [wsConnected, setWsConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  // Track connection state
  useEffect(() => {
    const unsub = gmWs.onStateChange((state) => {
      setWsConnected(state === 'connected');
    });
    return unsub;
  }, []);

  // Connect/disconnect based on roomId
  useEffect(() => {
    if (!roomId || !playerAddress) {
      gmWs.disconnect();
      return;
    }

    const numRoomId = typeof roomId === 'bigint' ? Number(roomId) : roomId;
    gmWs.join(numRoomId, chainId, playerAddress);

    return () => {
      // Don't disconnect on cleanup — let the singleton persist across
      // re-renders. Only disconnect when roomId becomes null (unmount/leave).
    };
  }, [roomId, chainId, playerAddress]);

  // Subscribe to event handlers
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    if (handlersRef.current) {
      for (const [event, handler] of Object.entries(handlersRef.current)) {
        if (handler) {
          unsubs.push(gmWs.on(event as ServerEventType, handler));
        }
      }
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
    // Re-subscribe when handlers object identity changes
  }, [handlers]);

  // Imperative disconnect (e.g. on page leave)
  const disconnect = useCallback(() => {
    gmWs.disconnect();
  }, []);

  return { wsConnected, disconnect };
}
