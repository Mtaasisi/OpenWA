export interface InboxConversationCursor {
  lastMessageAt: string;
  sessionId: string;
  chatId: string;
}

export function encodeInboxCursor(cursor: InboxConversationCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeInboxCursor(raw?: string): InboxConversationCursor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as InboxConversationCursor;
    if (!parsed.lastMessageAt || !parsed.sessionId || !parsed.chatId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildNextCursor(
  items: Array<{ lastMessageAt: string; sessionId: string; chatId: string }>,
): string | null {
  if (items.length === 0) return null;
  const last = items[items.length - 1];
  return encodeInboxCursor({
    lastMessageAt: last.lastMessageAt,
    sessionId: last.sessionId,
    chatId: last.chatId,
  });
}
