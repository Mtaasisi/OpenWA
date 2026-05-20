import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { MessageService } from './message.service';
import { Message, MessageDirection, MessageStatus } from './entities/message.entity';
import { InboxThreadRead } from './entities/inbox-thread-read.entity';
import { SessionService } from '../session/session.service';
import { HookManager } from '../../core/hooks';

const mockEngineResult = { id: 'wa-msg-1', timestamp: 1706868000 };

function createMockEngine() {
  return {
    markChatRead: jest.fn().mockResolvedValue(undefined),
    sendTextMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendImageMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendVideoMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendAudioMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendDocumentMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendStickerMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendLocationMessage: jest.fn().mockResolvedValue(mockEngineResult),
    sendContactMessage: jest.fn().mockResolvedValue(mockEngineResult),
    replyToMessage: jest.fn().mockResolvedValue(mockEngineResult),
    forwardMessage: jest.fn().mockResolvedValue(mockEngineResult),
    reactToMessage: jest.fn().mockResolvedValue(undefined),
    getMessageReactions: jest.fn().mockResolvedValue([]),
    deleteMessage: jest.fn().mockResolvedValue(undefined),
  };
}

describe('MessageService', () => {
  let service: MessageService;
  let repository: jest.Mocked<Partial<Repository<Message>>>;
  let threadReadRepository: jest.Mocked<Partial<Repository<InboxThreadRead>>>;
  let sessionService: jest.Mocked<Partial<SessionService>>;
  let hookManager: jest.Mocked<Partial<HookManager>>;
  let mockEngine: ReturnType<typeof createMockEngine>;

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation((data: Partial<Message>) => ({ id: 'msg-uuid-1', ...data }) as Message),
      save: jest.fn().mockImplementation(msg => Promise.resolve(msg)),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(),
    };

    threadReadRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(x => Promise.resolve(x)),
      create: jest.fn().mockImplementation((x: unknown) => x),
    };

    mockEngine = createMockEngine();
    mockEngine.markChatRead = jest.fn().mockResolvedValue(undefined);

    sessionService = {
      getEngine: jest.fn().mockReturnValue(mockEngine),
      findOne: jest.fn().mockResolvedValue({ id: 'sess-1', phone: '628123456789', name: 'test', status: 'ready' }),
    };

    hookManager = {
      execute: jest.fn().mockResolvedValue({
        continue: true,
        data: { sessionId: 'sess-1', input: { chatId: '628123456789@c.us', text: 'Hello' }, type: 'text' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        { provide: getRepositoryToken(Message, 'data'), useValue: repository },
        { provide: getRepositoryToken(InboxThreadRead, 'data'), useValue: threadReadRepository },
        { provide: SessionService, useValue: sessionService },
        { provide: HookManager, useValue: hookManager },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
  });

  // ── sendText ──────────────────────────────────────────────────────

  describe('sendText', () => {
    it('should send text message and return messageId + timestamp', async () => {
      const result = await service.sendText('sess-1', {
        chatId: '628123456789@c.us',
        text: 'Hello',
      });

      expect(result.messageId).toBe('wa-msg-1');
      expect(result.timestamp).toBe(1706868000);
      expect(mockEngine.sendTextMessage).toHaveBeenCalledWith('628123456789@c.us', 'Hello');
    });

    it('should save outgoing message as pending before sending, then update to sent', async () => {
      await service.sendText('sess-1', {
        chatId: '628123456789@c.us',
        text: 'Hello',
      });

      // First save: pending message before engine send
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          direction: MessageDirection.OUTGOING,
          type: 'text',
          body: 'Hello',
          status: MessageStatus.PENDING,
        }),
      );
      // save called twice: once for initial pending, once for status update to sent
      expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('should execute message:sending and message:sent hooks', async () => {
      await service.sendText('sess-1', {
        chatId: '628123456789@c.us',
        text: 'Hello',
      });

      expect(hookManager.execute).toHaveBeenCalledWith(
        'message:sending',
        expect.objectContaining({ type: 'text' }),
        expect.any(Object),
      );
      expect(hookManager.execute).toHaveBeenCalledWith(
        'message:sent',
        expect.objectContaining({ result: mockEngineResult }),
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when plugin blocks sending', async () => {
      (hookManager.execute as jest.Mock).mockResolvedValueOnce({ continue: false, data: {} });

      await expect(service.sendText('sess-1', { chatId: 'test@c.us', text: 'blocked' })).rejects.toThrow(
        'Message sending blocked by plugin',
      );
    });

    it('should throw BadRequestException if session is not active', async () => {
      (sessionService.getEngine as jest.Mock).mockReturnValue(undefined);

      await expect(service.sendText('inactive', { chatId: 'test@c.us', text: 'hello' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── sendImage ─────────────────────────────────────────────────────

  describe('sendImage', () => {
    it('should send image via URL', async () => {
      const result = await service.sendImage('sess-1', {
        chatId: '628123456789@c.us',
        url: 'https://example.com/img.jpg',
        caption: 'My image',
      });

      expect(result.messageId).toBe('wa-msg-1');
      expect(mockEngine.sendImageMessage).toHaveBeenCalledWith(
        '628123456789@c.us',
        expect.objectContaining({ data: 'https://example.com/img.jpg', caption: 'My image' }),
      );
    });

    it('should send image via base64 with mimetype', async () => {
      await service.sendImage('sess-1', {
        chatId: '628123456789@c.us',
        base64: 'iVBORw0KGgoAAAAN...',
        mimetype: 'image/png',
      });

      expect(mockEngine.sendImageMessage).toHaveBeenCalledWith(
        '628123456789@c.us',
        expect.objectContaining({ data: 'iVBORw0KGgoAAAAN...', mimetype: 'image/png' }),
      );
    });
  });

  // ── sendVideo / sendAudio / sendDocument / sendSticker ────────────

  describe('sendVideo', () => {
    it('should call engine.sendVideoMessage', async () => {
      await service.sendVideo('sess-1', {
        chatId: 'test@c.us',
        url: 'https://example.com/video.mp4',
      });
      expect(mockEngine.sendVideoMessage).toHaveBeenCalled();
    });
  });

  describe('sendAudio', () => {
    it('should call engine.sendAudioMessage', async () => {
      await service.sendAudio('sess-1', {
        chatId: 'test@c.us',
        url: 'https://example.com/audio.ogg',
      });
      expect(mockEngine.sendAudioMessage).toHaveBeenCalled();
    });
  });

  describe('sendDocument', () => {
    it('should call engine.sendDocumentMessage with filename', async () => {
      await service.sendDocument('sess-1', {
        chatId: 'test@c.us',
        url: 'https://example.com/doc.pdf',
        filename: 'report.pdf',
      });
      expect(mockEngine.sendDocumentMessage).toHaveBeenCalledWith(
        'test@c.us',
        expect.objectContaining({ filename: 'report.pdf' }),
      );
    });
  });

  describe('sendSticker', () => {
    it('should call engine.sendStickerMessage', async () => {
      await service.sendSticker('sess-1', {
        chatId: 'test@c.us',
        url: 'https://example.com/sticker.webp',
      });
      expect(mockEngine.sendStickerMessage).toHaveBeenCalled();
    });
  });

  // ── sendLocation ──────────────────────────────────────────────────

  describe('sendLocation', () => {
    it('should send location with lat/lng', async () => {
      const result = await service.sendLocation('sess-1', {
        chatId: 'test@c.us',
        latitude: -6.2088,
        longitude: 106.8456,
        description: 'Jakarta',
      });

      expect(result.messageId).toBe('wa-msg-1');
      expect(mockEngine.sendLocationMessage).toHaveBeenCalledWith(
        'test@c.us',
        expect.objectContaining({ latitude: -6.2088, longitude: 106.8456 }),
      );
    });
  });

  // ── sendContact ───────────────────────────────────────────────────

  describe('sendContact', () => {
    it('should send contact with name and number', async () => {
      const result = await service.sendContact('sess-1', {
        chatId: 'test@c.us',
        contactName: 'John Doe',
        contactNumber: '+628123456789',
      });

      expect(result.messageId).toBe('wa-msg-1');
      expect(mockEngine.sendContactMessage).toHaveBeenCalledWith(
        'test@c.us',
        expect.objectContaining({ name: 'John Doe', number: '+628123456789' }),
      );
    });
  });

  // ── reply / forward ───────────────────────────────────────────────

  describe('reply', () => {
    it('should call engine.replyToMessage with quotedMessageId', async () => {
      await service.reply('sess-1', {
        chatId: 'test@c.us',
        quotedMessageId: 'wa-quoted-1',
        text: 'This is a reply',
      });

      expect(mockEngine.replyToMessage).toHaveBeenCalledWith('test@c.us', 'wa-quoted-1', 'This is a reply');
    });
  });

  describe('forward', () => {
    it('should call engine.forwardMessage with from/to chats', async () => {
      await service.forward('sess-1', {
        fromChatId: 'from@c.us',
        toChatId: 'to@c.us',
        messageId: 'wa-msg-to-fwd',
      });

      expect(mockEngine.forwardMessage).toHaveBeenCalledWith('from@c.us', 'to@c.us', 'wa-msg-to-fwd');
    });

    it('should save forwarded message with toChatId', async () => {
      await service.forward('sess-1', {
        fromChatId: 'from@c.us',
        toChatId: 'to@c.us',
        messageId: 'wa-msg-to-fwd',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: 'to@c.us',
          body: '[Forwarded]',
          type: 'forward',
        }),
      );
    });
  });

  // ── saveIncomingMessage ───────────────────────────────────────────

  describe('saveIncomingMessage', () => {
    it('should save with INCOMING direction', async () => {
      await service.saveIncomingMessage('sess-1', {
        waMessageId: 'wa-in-1',
        chatId: 'sender@c.us',
        body: 'Hi there',
        type: 'text',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'sess-1',
          direction: MessageDirection.INCOMING,
        }),
      );
    });
  });

  describe('persistInboundFromEngine', () => {
    it('should dedupe when waMessageId already exists', async () => {
      const existing = { id: 'db-1', waMessageId: 'wa-dup' };
      (repository.findOne as jest.Mock).mockResolvedValue(existing);

      const result = await service.persistInboundFromEngine('sess-1', {
        id: 'wa-dup',
        from: '628@c.us',
        to: 'me@c.us',
        chatId: '628@c.us',
        body: 'Hi',
        type: 'chat',
        timestamp: 1,
        fromMe: false,
        isGroup: false,
      });

      expect(result).toBe(existing);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('should save outgoing when fromMe is true', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.create as jest.Mock).mockImplementation((x: unknown) => x);
      (repository.save as jest.Mock).mockImplementation((x: unknown) => Promise.resolve(x));

      await service.persistInboundFromEngine('sess-1', {
        id: 'wa-out-1',
        from: 'me@c.us',
        to: '628@c.us',
        chatId: '628@c.us',
        body: 'Sent from phone',
        type: 'chat',
        timestamp: 2,
        fromMe: true,
        isGroup: false,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: MessageDirection.OUTGOING,
          waMessageId: 'wa-out-1',
        }),
      );
    });
  });

  // ── unread / mark read ────────────────────────────────────────────

  describe('countUnreadIncoming', () => {
    it('should count all incoming when no read cursor exists', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(3),
      };
      (repository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const count = await service.countUnreadIncoming('sess-1', '628@c.us');
      expect(count).toBe(3);
      expect(qb.andWhere).not.toHaveBeenCalledWith('message.createdAt > :lastReadAt', expect.anything());
    });

    it('should count only messages after lastReadAt when cursor exists', async () => {
      (threadReadRepository.findOne as jest.Mock).mockResolvedValue({
        sessionId: 'sess-1',
        chatId: '628@c.us',
        lastReadAt: new Date('2026-01-01'),
      });
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
      };
      (repository.createQueryBuilder as jest.Mock).mockReturnValue(qb);

      const count = await service.countUnreadIncoming('sess-1', '628@c.us');
      expect(count).toBe(1);
      expect(qb.andWhere).toHaveBeenCalledWith('message.createdAt > :lastReadAt', {
        lastReadAt: expect.any(Date),
      });
    });
  });

  describe('markConversationRead', () => {
    it('should upsert read cursor and call engine markChatRead', async () => {
      await service.markConversationRead('sess-1', '628123456789@c.us');

      expect(threadReadRepository.save).toHaveBeenCalled();
      expect(mockEngine.markChatRead).toHaveBeenCalledWith('628123456789@c.us');
    });
  });

  describe('syncUnreadFromEngine', () => {
    it('should update lastReadAt when WhatsApp unread count is zero', async () => {
      await service.syncUnreadFromEngine('sess-1', '628123456789@c.us', 0);
      expect(threadReadRepository.save).toHaveBeenCalled();
    });

    it('should not update read cursor when unread count is positive', async () => {
      await service.syncUnreadFromEngine('sess-1', '628123456789@c.us', 2);
      expect(threadReadRepository.save).not.toHaveBeenCalled();
    });
  });

  // ── buildMediaInput (via sendImage) ───────────────────────────────

  describe('buildMediaInput validation', () => {
    it('should throw when neither url nor base64 is provided', async () => {
      await expect(service.sendImage('sess-1', { chatId: 'test@c.us' })).rejects.toThrow(
        'Either url or base64 must be provided',
      );
    });

    it('should throw when base64 is provided without mimetype', async () => {
      await expect(
        service.sendImage('sess-1', {
          chatId: 'test@c.us',
          base64: 'data...',
        }),
      ).rejects.toThrow('mimetype is required when using base64 data');
    });
  });

  // ── reactToMessage / deleteMessage ────────────────────────────────

  describe('reactToMessage', () => {
    it('should call engine.reactToMessage', async () => {
      await service.reactToMessage('sess-1', {
        chatId: 'test@c.us',
        messageId: 'wa-msg-1',
        emoji: '👍',
      });

      expect(mockEngine.reactToMessage).toHaveBeenCalledWith('test@c.us', 'wa-msg-1', '👍');
    });
  });

  describe('deleteMessage', () => {
    it('should call engine.deleteMessage with forEveryone default true', async () => {
      await service.deleteMessage('sess-1', {
        chatId: 'test@c.us',
        messageId: 'wa-msg-1',
      });

      expect(mockEngine.deleteMessage).toHaveBeenCalledWith('test@c.us', 'wa-msg-1', true);
    });

    it('should pass forEveryone=false when specified', async () => {
      await service.deleteMessage('sess-1', {
        chatId: 'test@c.us',
        messageId: 'wa-msg-1',
        forEveryone: false,
      });

      expect(mockEngine.deleteMessage).toHaveBeenCalledWith('test@c.us', 'wa-msg-1', false);
    });
  });
});
