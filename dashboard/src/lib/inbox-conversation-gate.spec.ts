import { describe, expect, it } from 'vitest';
import { shouldBlockInboxConversations } from './inbox-conversation-gate';

describe('shouldBlockInboxConversations', () => {
  it('blocks single-account inbox while the selected session is connecting', () => {
    expect(
      shouldBlockInboxConversations('one', 'sess-a', true, true, false),
    ).toBe(true);
    expect(
      shouldBlockInboxConversations('one', 'sess-a', false, true, true),
    ).toBe(false);
  });

  it('does not block single-account inbox when another session is connecting', () => {
    expect(
      shouldBlockInboxConversations('one', 'sess-ready', false, true, true),
    ).toBe(false);
  });

  it('blocks unified inbox only until at least one session is ready', () => {
    expect(
      shouldBlockInboxConversations('all', undefined, false, true, false),
    ).toBe(true);
    expect(
      shouldBlockInboxConversations('all', undefined, false, true, true),
    ).toBe(false);
  });

  it('allows unified inbox when no session is connecting', () => {
    expect(
      shouldBlockInboxConversations('all', undefined, false, false, false),
    ).toBe(false);
  });
});
