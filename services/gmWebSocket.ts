/**
 * services/gmWebSocket.ts — Singleton WebSocket client for GM server push events.
 *
 * Replaces HTTP polling with real-time push for:
 *  - Game logs
 *  - Phase changes (on-chain events relayed by GM)
 *  - Night resolution results
 *  - Discussion state (speaker changes)
 *  - Role readiness notifications
 *  - Win detection
 *  - Player state updates
 *  - Role reveals (endgame)
 */

import { GM_SERVER_URL } from '../contracts/config';
import { signRequest } from './requestSigning';

// ── Event types (must match gm-server/src/ws/wsManager.ts) ──────────────

export type ServerEventType =
  | 'log'
  | 'phase-change'
  | 'night-resolved'
  | 'discussion-update'
  | 'role-ready'
  | 'win-detected'
  | 'player-update'
  | 'roles-revealed'
  | 'mafia-chat'
  | 'game-signal'
  | 'pong'
  | 'joined'
  | 'error';

export interface ServerEvent {
  type: ServerEventType;
  data?: unknown;
}

export type EventHandler = (data: unknown) => void;

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

// ── Singleton class ─────────────────────────────────────────────────────

class GmWebSocket {
  private ws: WebSocket | null = null;
  private handlers = new Map<ServerEventType, Set<EventHandler>>();
  private stateHandlers = new Set<(state: ConnectionState) => void>();
  private _state: ConnectionState = 'disconnected';

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempt = 0;
  private maxReconnectDelay = 30_000;
  private intentionalClose = false;

  // Current subscription info (for reconnect)
  private currentRoom: { roomId: number; chainId: number; playerAddress: string } | null = null;

  // ── Public API ──────────────────────────────────────────────────────

  get state(): ConnectionState {
    return this._state;
  }

  get isConnected(): boolean {
    return this._state === 'connected';
  }

  /**
   * Connect to GM WS and join a room.
   * Safe to call multiple times — reconnects if params change.
   */
  join(roomId: number, chainId: number, playerAddress: string) {
    // If already connected to same room, skip
    if (
      this.currentRoom &&
      this.currentRoom.roomId === roomId &&
      this.currentRoom.chainId === chainId &&
      this.currentRoom.playerAddress.toLowerCase() === playerAddress.toLowerCase() &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    this.currentRoom = { roomId, chainId, playerAddress };
    this.intentionalClose = false;
    this.reconnectAttempt = 0;
    this.connect();
  }

  /**
   * Disconnect and stop reconnecting.
   */
  disconnect() {
    this.intentionalClose = true;
    this.currentRoom = null;
    this.clearTimers();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.setState('disconnected');
  }

  /**
   * Subscribe to a specific event type.
   * Returns unsubscribe function.
   */
  on(event: ServerEventType, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  /**
   * Subscribe to connection state changes.
   * Returns unsubscribe function.
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateHandlers.add(handler);
    // Immediately fire with current state
    handler(this._state);
    return () => {
      this.stateHandlers.delete(handler);
    };
  }

  /**
   * Send a relay message — broadcasts an event to all OTHER players in the room.
   * Used for mafia chat and optimistic game signals.
   */
  relay(event: { type: ServerEventType; data?: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'relay', event }));
    }
  }

  /** Remove all handlers for a given event type. */
  off(event: ServerEventType) {
    this.handlers.delete(event);
  }

  /** Remove all handlers. */
  removeAllHandlers() {
    this.handlers.clear();
    this.stateHandlers.clear();
  }

  // ── Internal ────────────────────────────────────────────────────────

  private connect() {
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Reconnecting');
      this.ws = null;
    }

    if (!this.currentRoom) return;

    // Build WS URL from GM_SERVER_URL
    // GM_SERVER_URL is like "https://gm-test.mafiaonchain.live" or "http://localhost:3001"
    const wsUrl = GM_SERVER_URL
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://')
      + '/ws';

    this.setState('connecting');

    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = async () => {
      this.reconnectAttempt = 0;

      // Sign and send authenticated join message
      if (this.currentRoom) {
        const { roomId, chainId, playerAddress } = this.currentRoom;
        const timestamp = Date.now();
        try {
          const signed = await signRequest({
            address: playerAddress,
            roomId,
            buildMessage: () => `ws-join:${chainId}:${roomId}:${timestamp}`,
          });
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
              type: 'join',
              roomId,
              chainId,
              playerAddress,
              signature: signed.signature,
              signerAddress: signed.signerAddress,
              timestamp,
            }));
          }
        } catch (err) {
          console.error('[GmWebSocket] Failed to sign join message:', err);
          // Don't send unsigned join — server will reject with 4001.
          // Close and schedule reconnect (session key may not be ready yet).
          this.ws?.close(1000, 'Sign failed');
          this.scheduleReconnect();
          return;
        }
      }

      // Start keepalive pings (25s — under Somnia's 30s timeout)
      this.keepaliveTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25_000);
    };

    this.ws.onmessage = (event) => {
      try {
        const msg: ServerEvent = JSON.parse(event.data as string);

        // Handle join confirmation
        if (msg.type === 'joined') {
          this.setState('connected');
        }

        // Dispatch to handlers
        const handlers = this.handlers.get(msg.type);
        if (handlers) {
          for (const handler of handlers) {
            try {
              handler(msg.data);
            } catch (err) {
              console.error(`[GmWebSocket] Handler error for ${msg.type}:`, err);
            }
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = (event) => {
      this.ws = null;
      this.clearKeepalive();
      this.setState('disconnected');

      // 4001 = auth rejected by server — don't reconnect (would loop forever)
      if (event.code === 4001) {
        console.warn(`[GmWebSocket] Auth rejected (4001), not reconnecting`);
        return;
      }

      if (!this.intentionalClose && this.currentRoom) {
        console.debug(`[GmWebSocket] Connection closed (code ${event.code}), scheduling reconnect`);
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  private scheduleReconnect() {
    if (this.intentionalClose || !this.currentRoom) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.maxReconnectDelay);
    this.reconnectAttempt++;

    console.debug(`[GmWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private setState(state: ConnectionState) {
    if (this._state === state) return;
    this._state = state;
    for (const handler of this.stateHandlers) {
      try { handler(state); } catch { /* ignore */ }
    }
  }

  private clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearKeepalive();
  }

  private clearKeepalive() {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }
}

/** Singleton instance for the entire app. */
export const gmWs = new GmWebSocket();
