import { formatMessagePreview, isInboxChat, normalizeMessageType, shouldPersistMessage } from './inbox-chat.util';
import type { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';

describe('inbox-chat.util', () => {
  describe('isInboxChat', () => {
    it('rejects status broadcast', () => {
      expect(isInboxChat('status@broadcast')).toBe(false);
    });

    it('accepts personal and group chats', () => {
      expect(isInboxChat('628123@c.us')).toBe(true);
      expect(isInboxChat('123@g.us')).toBe(true);
      expect(isInboxChat('183288199155815@lid')).toBe(true);
    });
  });

  describe('shouldPersistMessage', () => {
    const base: IncomingMessage = {
      id: 'x',
      from: 'a',
      to: 'b',
      chatId: '628@c.us',
      body: 'hi',
      type: 'chat',
      timestamp: 1,
      fromMe: false,
      isGroup: false,
    };

    it('skips notification_template', () => {
      expect(shouldPersistMessage({ ...base, type: 'notification_template', body: '' })).toBe(false);
    });

    it('skips status broadcast chat', () => {
      expect(shouldPersistMessage({ ...base, chatId: 'status@broadcast' })).toBe(false);
    });

    it('skips WhatsApp Status updates', () => {
      expect(shouldPersistMessage({ ...base, isStatus: true })).toBe(false);
    });
  });

  describe('formatMessagePreview', () => {
    it('uses body when present', () => {
      expect(formatMessagePreview('Hello', 'chat')).toBe('Hello');
    });

    it('labels images without body', () => {
      expect(formatMessagePreview('', 'image')).toBe('📷 Image');
      expect(formatMessagePreview('', 'imageMessage')).toBe('📷 Image');
      expect(formatMessagePreview('', 'videoMessage')).toBe('🎬 Video');
    });
  });

  describe('normalizeMessageType', () => {
    it('maps Baileys proto types to inbox types', () => {
      expect(normalizeMessageType('imageMessage')).toBe('image');
      expect(normalizeMessageType('extendedTextMessage')).toBe('chat');
    });
  });
});
