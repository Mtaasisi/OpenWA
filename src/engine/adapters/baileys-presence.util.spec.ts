import { mapBaileysContactPresence } from './baileys-presence.util';

describe('mapBaileysContactPresence', () => {
  it('maps active presence states to online', () => {
    expect(mapBaileysContactPresence('628@c.us', { lastKnownPresence: 'available' }).state).toBe(
      'online',
    );
    expect(mapBaileysContactPresence('628@c.us', { lastKnownPresence: 'composing' }).state).toBe(
      'online',
    );
  });

  it('maps unavailable presence to offline', () => {
    expect(mapBaileysContactPresence('628@c.us', { lastKnownPresence: 'unavailable' }).state).toBe(
      'offline',
    );
  });

  it('includes lastSeen when present', () => {
    const result = mapBaileysContactPresence('628@c.us', {
      lastKnownPresence: 'unavailable',
      lastSeen: 1_700_000_000,
    });
    expect(result.lastSeenAt).toBe(new Date(1_700_000_000_000).toISOString());
  });
});
