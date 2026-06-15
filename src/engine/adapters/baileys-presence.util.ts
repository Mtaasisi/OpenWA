import type { ContactPresence, ContactPresenceState } from '../interfaces/whatsapp-engine.interface';

export interface BaileysPresenceData {
  lastKnownPresence?: string;
  lastSeen?: number;
}

export function mapBaileysContactPresence(
  chatId: string,
  data: BaileysPresenceData,
): ContactPresence {
  let state: ContactPresenceState = 'unknown';
  const presence = data.lastKnownPresence;
  if (presence === 'available' || presence === 'composing' || presence === 'recording') {
    state = 'online';
  } else if (presence === 'unavailable' || presence === 'paused') {
    state = 'offline';
  }
  return {
    chatId,
    state,
    lastSeenAt: data.lastSeen ? new Date(data.lastSeen * 1000).toISOString() : null,
  };
}
