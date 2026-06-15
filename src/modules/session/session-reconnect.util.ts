/** WhatsApp disconnect reasons that require user action — auto-reconnect will not help. */
const TERMINAL_DISCONNECT_REASONS = new Set([
  'LOGOUT',
  'UNPAIRED',
  'UNPAIRED_IDLE',
  'CONFLICT',
  'NLA',
  'Authentication failed',
]);

export function isTerminalDisconnectReason(reason: string): boolean {
  const normalized = reason.trim();
  if (!normalized) return false;
  if (TERMINAL_DISCONNECT_REASONS.has(normalized)) return true;
  return normalized.toLowerCase().includes('authentication failed');
}
