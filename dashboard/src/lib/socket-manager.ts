import { io, type Socket } from 'socket.io-client';
import type {
  MessageEvent,
  WebSocketEvents,
} from '../hooks/useWebSocket';
import { getAccessToken } from './auth-storage';
import { getEventsSocketAuth, getEventsSocketUrl } from './ws-config';

interface WsEventPayload {
  event?: string;
  sessionId?: string;
  data?: Record<string, unknown> & { status?: string; qrCode?: string };
}

type HandlerEntry = {
  id: symbol;
  getEvents: () => WebSocketEvents;
};

let socket: Socket | null = null;
const handlers = new Map<symbol, HandlerEntry>();
const connectionListeners = new Set<(connected: boolean) => void>();
let resubscribeTimer: ReturnType<typeof setTimeout> | null = null;

function notifyConnection(connected: boolean) {
  for (const cb of connectionListeners) cb(connected);
}

function teardownSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

function collectSubscriptions(): Array<{ sessionId: string; events: string[]; requestId: string }> {
  const subs: Array<{ sessionId: string; events: string[]; requestId: string }> = [];
  const seen = new Set<string>();
  let idx = 0;

  for (const { getEvents } of handlers.values()) {
    const e = getEvents();
    if (e.subscribeAllSessions) {
      const key = '*|session.status,session.qr';
      if (!seen.has(key)) {
        seen.add(key);
        subs.push({
          sessionId: '*',
          events: ['session.status', 'session.qr'],
          requestId: `sg-${idx++}`,
        });
      }
    }
    if (e.globalEvents?.length) {
      const events = [...new Set(e.globalEvents)].sort();
      const key = `*|${events.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        subs.push({ sessionId: '*', events, requestId: `ge-${idx++}` });
      }
    }
    if (e.sessionId && e.sessionEvents?.length) {
      const events = [...new Set(e.sessionEvents)].sort();
      const key = `${e.sessionId}|${events.join(',')}`;
      if (!seen.has(key)) {
        seen.add(key);
        subs.push({ sessionId: e.sessionId, events, requestId: `se-${idx++}` });
      }
    }
  }
  return subs;
}

function applySubscriptions(sock: Socket) {
  for (const sub of collectSubscriptions()) {
    sock.emit('message', { type: 'subscribe', ...sub });
  }
}

function dispatchSocketMessage(msg: { type?: string; payload?: WsEventPayload }) {
  if (msg.type !== 'event' || !msg.payload?.event || !msg.payload.sessionId) return;
  const { event, sessionId, data } = msg.payload;

  for (const { getEvents } of handlers.values()) {
    const e = getEvents();

    if (event === 'session.status' && data?.status) {
      e.onSessionStatus?.({
        sessionId,
        status: data.status,
        reason: typeof data.reason === 'string' ? data.reason : undefined,
        statusMessage: typeof data.statusMessage === 'string' ? data.statusMessage : undefined,
        failureCode: typeof data.failureCode === 'string' ? data.failureCode : undefined,
        backgroundSyncing:
          typeof data.backgroundSyncing === 'boolean' ? data.backgroundSyncing : undefined,
        deleted: data.deleted === true,
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

    if ((event === 'message.received' || event === 'message.sent') && data) {
      const payload: MessageEvent = {
        sessionId,
        message: data as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      };
      e.onMessageEvent?.(event, payload);
      if (event === 'message.received') {
        e.onMessage?.(payload);
      }
    }

    if (
      data &&
      e.onGlobalEvent &&
      (event.startsWith('followup.') || event.startsWith('ai.') || event === 'message.received')
    ) {
      e.onGlobalEvent(event, sessionId, data as Record<string, unknown>);
    }
  }
}

function attachSocketListeners(sock: Socket) {
  sock.on('connect', () => {
    notifyConnection(true);
    applySubscriptions(sock);
  });

  sock.on('disconnect', () => {
    notifyConnection(false);
  });

  sock.on('connect_error', error => {
    const msg = error.message ?? '';
    // Stale Engine.IO session after a failed WS upgrade — reset and let the manager reconnect cleanly.
    if (msg.includes('400') || msg.includes('Invalid session') || msg.includes('session id unknown')) {
      teardownSocket();
    } else {
      console.warn('[WebSocket] Connection error:', msg);
    }
  });

  sock.on('message', dispatchSocketMessage);
}

/** Dev / Playwright harness for inbox global events (e.g. ai.learning.pending). */
export function dispatchTestSocketEvent(
  event: string,
  sessionId: string,
  data: Record<string, unknown>,
) {
  dispatchSocketMessage({
    type: 'event',
    payload: { event, sessionId, data },
  });
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as Window & { __openwaDispatchTestSocketEvent?: typeof dispatchTestSocketEvent }).__openwaDispatchTestSocketEvent =
    dispatchTestSocketEvent;
}

function ensureSocket() {
  const accessToken = getAccessToken();
  if (!accessToken) return null;

  const currentToken = (socket?.auth as { token?: string } | undefined)?.token;
  if (socket && currentToken !== accessToken) {
    teardownSocket();
  }

  if (socket) return socket;

  socket = io(getEventsSocketUrl(), {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ['polling', 'websocket'],
    ...getEventsSocketAuth(accessToken),
  });

  attachSocketListeners(socket);

  return socket;
}

export function registerSocketHandler(getEvents: () => WebSocketEvents): symbol {
  const id = Symbol('socket-handler');
  handlers.set(id, { id, getEvents });
  ensureSocket();
  if (socket?.connected) applySubscriptions(socket);
  return id;
}

export function unregisterSocketHandler(id: symbol) {
  handlers.delete(id);
  // Keep the shared socket alive across hook mount/unmount (StrictMode, route changes).
}

export function disconnectSharedSocket() {
  handlers.clear();
  teardownSocket();
}

export function resubscribeSocket() {
  if (!socket?.connected) return;
  if (resubscribeTimer) clearTimeout(resubscribeTimer);
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = null;
    if (socket?.connected) applySubscriptions(socket!);
  }, 150);
}

export function ensureSocketConnection(): Socket | null {
  return ensureSocket();
}

export function getSocketConnected(): boolean {
  return socket?.connected ?? false;
}

export function onSocketConnectionChange(cb: (connected: boolean) => void): () => void {
  connectionListeners.add(cb);
  cb(getSocketConnected());
  return () => connectionListeners.delete(cb);
}
