export type InboxConversationViewMode = 'all' | 'one';

/**
 * Whether inbox conversation queries should stay disabled while a session connects.
 * Only blocks the selected session in single-account view; in unified view, blocks
 * only until at least one session is ready (other sessions connecting must not freeze inbox).
 */
export function shouldBlockInboxConversations(
  viewMode: InboxConversationViewMode,
  sessionId: string | undefined,
  selectedSessionConnecting: boolean,
  anySessionConnecting: boolean,
  anySessionReady: boolean,
): boolean {
  if (viewMode === 'one') {
    return Boolean(sessionId && selectedSessionConnecting);
  }
  return anySessionConnecting && !anySessionReady;
}
