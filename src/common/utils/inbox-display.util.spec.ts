import {
  formatPhoneDigits,
  isInternalLidUserId,
  phoneDigitsFromChatId,
  resolveCustomerName,
  resolveCustomerPhone,
  resolveThreadIdentity,
  resolveInboxChatTitle,
  sanitizeStoredPhone,
} from './inbox-display.util';

describe('inbox-display.util', () => {
  const lid = '183288199155815@lid';

  it('detects lid internal ids', () => {
    expect(isInternalLidUserId('183288199155815', lid)).toBe(true);
    expect(isInternalLidUserId('183288199155815@lid', lid)).toBe(true);
    expect(isInternalLidUserId('Jane Doe', lid)).toBe(false);
  });

  it('formats @c.us phone chat ids', () => {
    expect(phoneDigitsFromChatId('212769283898@c.us')).toBe('212769283898');
    expect(resolveInboxChatTitle({ chatId: '212769283898@c.us' })).toContain('+21');
  });

  it('does not treat lid digits as a phone in title', () => {
    expect(
      resolveInboxChatTitle({
        chatId: lid,
        displayName: '183288199155815',
        linkedContactFallback: 'Linked contact',
      }),
    ).toBe('Linked contact');
  });

  it('prefers CRM phone for lid threads', () => {
    expect(
      resolveInboxChatTitle({
        chatId: lid,
        displayName: '183288199155815',
        customerPhone: '212769283898',
      }),
    ).toBe(formatPhoneDigits('212769283898'));
  });

  it('sanitizeStoredPhone rejects lid internal ids on @lid chats', () => {
    expect(sanitizeStoredPhone(lid, '183288199155815')).toBeNull();
    expect(sanitizeStoredPhone(lid, '183288199155815@lid')).toBeNull();
    expect(sanitizeStoredPhone(lid, '212769283898')).toBe('212769283898');
  });

  it('resolveInboxChatTitle ignores polluted CRM phone on lid threads', () => {
    expect(
      resolveInboxChatTitle({
        chatId: lid,
        customerPhone: '183288199155815',
        linkedContactFallback: 'Linked contact',
      }),
    ).toBe('Linked contact');
  });

  it('resolveThreadIdentity merges CRM, follow-up, and chat id fallbacks', () => {
    expect(
      resolveThreadIdentity({
        chatId: '212769283898@c.us',
        customerPhone: '12345',
        crmName: '183288199155815',
        customerName: 'Jane Doe',
      }),
    ).toEqual({
      customerName: 'Jane Doe',
      customerPhone: '+212769283898',
    });
  });

  it('resolveCustomerPhone prefers sanitized stored values then chat id', () => {
    expect(resolveCustomerPhone('212769283898@c.us', '12345')).toBe('+212769283898');
    expect(resolveCustomerPhone('212769283898@c.us', null)).toBe('+212769283898');
    expect(resolveCustomerPhone(lid, '212769283898')).toBe('212769283898');
    expect(resolveCustomerPhone(lid, '183288199155815')).toBeNull();
  });

  it('resolveCustomerName skips lid internal ids', () => {
    expect(resolveCustomerName(lid, '183288199155815', 'Jane Doe')).toBe('Jane Doe');
    expect(resolveCustomerName(lid, '183288199155815')).toBeNull();
  });

  it('resolveCustomerName skips generic WhatsApp labels like Business', () => {
    expect(resolveCustomerName('255743996097@c.us', 'Business', 'Agay Mapambo')).toBe('Agay Mapambo');
    expect(resolveCustomerName('255743996097@c.us', 'Business')).toBeNull();
  });

  it('resolveInboxChatTitle ignores generic CRM names like Business', () => {
    const title = resolveInboxChatTitle({
      chatId: '255743996097@c.us',
      customerName: 'Business',
      customerPhone: '+255743996097',
    });
    expect(title.toLowerCase()).not.toBe('business');
    expect(title.replace(/\D/g, '')).toContain('255743996097');
  });

  it('resolveInboxChatTitle uses WhatsApp group name when available', () => {
    const groupId = '120363404467764014@g.us';
    expect(
      resolveInboxChatTitle({
        chatId: groupId,
        displayName: 'Sales Team',
      }),
    ).toBe('Sales Team (group)');
    expect(
      resolveInboxChatTitle({
        chatId: groupId,
        displayName: '120363404467764014 (group)',
      }),
    ).toBe('120363404467764014 (group)');
  });
});
