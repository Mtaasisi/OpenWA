import { describe, expect, it } from 'vitest';
import { inferConversationType } from './conversation-types';
import type { Conversation } from '../services/api';

describe('inferConversationType', () => {
  it('treats @lid chats with a person/business name as direct_customer', () => {
    const conv = {
      displayName: 'Inauzwa',
      messageCount: 5,
    } as Conversation;

    expect(inferConversationType('183288199155815@lid', conv)).toBe('direct_customer');
  });

  it('treats @lid chats with CRM customer name as direct_customer', () => {
    const conv = {
      customerName: 'Amina Hassan',
      displayName: '183288199155815@lid',
    } as Conversation;

    expect(inferConversationType('183288199155815@lid', conv)).toBe('direct_customer');
  });

  it('keeps raw @lid-only threads as internal workspace', () => {
    const conv = {
      displayName: '183288199155815@lid',
      messageCount: 0,
    } as Conversation;

    expect(inferConversationType('183288199155815@lid', conv)).toBe('internal');
  });

  it('treats @lid chats with messages as direct_customer even without a display name', () => {
    const conv = {
      displayName: '',
      messageCount: 3,
    } as Conversation;

    expect(inferConversationType('183288199155815@lid', conv)).toBe('direct_customer');
  });

  it('still classifies @c.us as direct_customer', () => {
    expect(inferConversationType('255700000001@c.us')).toBe('direct_customer');
  });

  it('classifies broadcast-list threads separately from direct customers', () => {
    const conv = { lastInboundBroadcast: true } as Conversation;
    expect(inferConversationType('255700000001@c.us', conv)).toBe('broadcast');
  });
});
