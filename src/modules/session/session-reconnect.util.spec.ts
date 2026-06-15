import { isTerminalDisconnectReason } from './session-reconnect.util';

describe('isTerminalDisconnectReason', () => {
  it('returns true for LOGOUT (WhatsApp unlinked from phone)', () => {
    expect(isTerminalDisconnectReason('LOGOUT')).toBe(true);
  });

  it('returns true for CONFLICT (another Web session)', () => {
    expect(isTerminalDisconnectReason('CONFLICT')).toBe(true);
  });

  it('returns false for transient browser/network failures', () => {
    expect(isTerminalDisconnectReason('NAVIGATION')).toBe(false);
    expect(isTerminalDisconnectReason('Max qrcode retries')).toBe(false);
  });
});
