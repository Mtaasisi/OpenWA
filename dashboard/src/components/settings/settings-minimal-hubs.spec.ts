import { describe, expect, it } from 'vitest';
import { hubItemSortIndex, isHubVisibleItem } from './settings-minimal-hubs';

describe('settings minimal hubs', () => {
  it('shows only curated chats items on hub', () => {
    expect(isHubVisibleItem('chats', 'whatsapp-accounts')).toBe(true);
    expect(isHubVisibleItem('chats', 'sms-channel')).toBe(false);
    expect(isHubVisibleItem('chats', 'chat-export')).toBe(false);
  });

  it('keeps hidden search items out of ai hub but searchable', () => {
    expect(isHubVisibleItem('ai', 'ai-memory')).toBe(false);
    expect(isHubVisibleItem('ai', 'ai-auto-reply')).toBe(true);
  });

  it('shows single account preferences row on profile hub', () => {
    expect(isHubVisibleItem('profile', 'account-preferences')).toBe(true);
    expect(isHubVisibleItem('profile', 'appearance')).toBe(false);
  });

  it('orders hub items consistently', () => {
    expect(hubItemSortIndex('system', 'logs')).toBeGreaterThan(
      hubItemSortIndex('system', 'users'),
    );
  });
});
