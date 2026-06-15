import { describe, expect, it } from 'vitest';
import {
  conversationChatIdCopyText,
  conversationPhoneCopyText,
} from './inbox-customer-display';

describe('conversationPhoneCopyText', () => {
  it('prefers WhatsApp chat id digits over invalid CRM phone', () => {
    expect(
      conversationPhoneCopyText({
        chatId: '255746605561@c.us',
        customerPhone: '128355735208140@lid',
        displayName: 'Venom',
      }),
    ).toBe('+255 746 605 561');
  });

  it('uses sanitized CRM phone when chat id is linked device', () => {
    expect(
      conversationPhoneCopyText({
        chatId: '128355735208140@lid',
        customerPhone: '255798765432',
        displayName: 'Alice',
      }),
    ).toBe('+255 798 765 432');
  });

  it('extracts phone from display name when CRM phone is empty', () => {
    expect(
      conversationPhoneCopyText({
        chatId: '255712345678@c.us',
        customerPhone: null,
        displayName: '255712345678',
      }),
    ).toBe('+255 712 345 678');
  });

  it('returns empty for group chats', () => {
    expect(
      conversationPhoneCopyText({
        chatId: '120363028586951430@g.us',
        customerPhone: '255746605561',
      }),
    ).toBe('');
  });
});

describe('conversationChatIdCopyText', () => {
  it('strips WhatsApp suffix from direct chats', () => {
    expect(conversationChatIdCopyText('255746605561@c.us')).toBe('255746605561');
  });

  it('strips lid suffix for linked device chats', () => {
    expect(conversationChatIdCopyText('128355735208140@lid')).toBe('128355735208140');
  });
});
