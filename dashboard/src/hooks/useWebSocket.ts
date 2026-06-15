import { useEffect, useRef, useState } from 'react';
import {
  registerSocketHandler,
  unregisterSocketHandler,
  resubscribeSocket,
  getSocketConnected,
  onSocketConnectionChange,
} from '../lib/socket-manager';

export interface SessionStatusEvent {
  sessionId: string;
  status: string;
  reason?: string;
  statusMessage?: string;
  failureCode?: string;
  backgroundSyncing?: boolean;
  deleted?: boolean;
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

export interface WebSocketEvents {
  /** Subscribe to all sessions for session.status / session.qr */
  subscribeAllSessions?: boolean;
  /** Subscribe to a single session (or '*' when omitted with subscribeAllSessions) */
  sessionId?: string;
  sessionEvents?: string[];
  onSessionStatus?: (event: SessionStatusEvent) => void;
  onQRCode?: (event: QRCodeEvent) => void;
  onMessage?: (event: MessageEvent) => void;
  /** Fired for message.received and message.sent */
  onMessageEvent?: (event: 'message.received' | 'message.sent', payload: MessageEvent) => void;
  globalEvents?: string[];
  onGlobalEvent?: (event: string, sessionId: string, data: Record<string, unknown>) => void;
}

export function useWebSocket(events: WebSocketEvents = {}) {
  const [isConnected, setIsConnected] = useState(getSocketConnected);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const handlerIdRef = useRef<symbol | null>(null);

  useEffect(() => {
    handlerIdRef.current = registerSocketHandler(() => eventsRef.current);
    const unsub = onSocketConnectionChange(setIsConnected);
    return () => {
      unsub();
      if (handlerIdRef.current) {
        unregisterSocketHandler(handlerIdRef.current);
        handlerIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    resubscribeSocket();
  }, [
    events.subscribeAllSessions,
    events.sessionId,
    events.sessionEvents?.join(','),
    events.globalEvents?.join(','),
  ]);

  return { isConnected };
}
