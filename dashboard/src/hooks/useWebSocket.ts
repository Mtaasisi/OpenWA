import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SessionStatusEvent {
  sessionId: string;
  status: string;
  timestamp?: string;
}

export interface QRCodeEvent {
  sessionId: string;
  qrCode: string;
  timestamp?: string;
}

export interface MessageEvent {
  sessionId: string;
  message: Record<string, unknown>;
  timestamp: string;
}

interface WsEventPayload {
  event?: string;
  sessionId?: string;
  data?: Record<string, unknown> & { status?: string; qrCode?: string };
}

interface WebSocketEvents {
  /** Subscribe to all sessions for session.status / session.qr */
  subscribeAllSessions?: boolean;
  /** Subscribe to a single session (or '*' when omitted with subscribeAllSessions) */
  sessionId?: string;
  sessionEvents?: string[];
  onSessionStatus?: (event: SessionStatusEvent) => void;
  onQRCode?: (event: QRCodeEvent) => void;
  onMessage?: (event: MessageEvent) => void;
}

import { getEventsSocketAuth, getEventsSocketUrl } from '../lib/ws-config';

export function useWebSocket(events: WebSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const subscribe = useCallback((socket: Socket) => {
    const e = eventsRef.current;
    if (e.subscribeAllSessions) {
      socket.emit('message', {
        type: 'subscribe',
        sessionId: '*',
        events: ['session.status', 'session.qr'],
        requestId: 'session-global',
      });
    }
    if (e.sessionId && e.sessionEvents?.length) {
      socket.emit('message', {
        type: 'subscribe',
        sessionId: e.sessionId,
        events: e.sessionEvents,
        requestId: `session-${e.sessionId}`,
      });
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const apiKey = sessionStorage.getItem('openwa_api_key');
    if (!apiKey) {
      console.warn('[WebSocket] No API key found, skipping connection');
      return;
    }

    socketRef.current = io(getEventsSocketUrl(), {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...getEventsSocketAuth(apiKey),
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      setIsConnected(true);
      subscribe(socket);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', error => {
      console.warn('[WebSocket] Connection error:', error.message);
    });

    socket.on('message', (msg: { type?: string; payload?: WsEventPayload }) => {
      if (msg.type !== 'event' || !msg.payload?.event || !msg.payload.sessionId) return;
      const { event, sessionId, data } = msg.payload;
      const e = eventsRef.current;

      if (event === 'session.status' && data?.status) {
        e.onSessionStatus?.({
          sessionId,
          status: data.status,
          timestamp: new Date().toISOString(),
        });
      }

      if (event === 'session.qr' && data?.qrCode) {
        e.onQRCode?.({
          sessionId,
          qrCode: data.qrCode,
          timestamp: new Date().toISOString(),
        });
      }

      if (event === 'message.received' && data) {
        e.onMessage?.({
          sessionId,
          message: data as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        });
      }
    });
  }, [subscribe]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [connect]);

  useEffect(() => {
    if (socketRef.current?.connected) {
      subscribe(socketRef.current);
    }
  }, [events.subscribeAllSessions, events.sessionId, events.sessionEvents, subscribe]);

  return { isConnected };
}
