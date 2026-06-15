import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { InboxController } from './inbox.controller';
import { MessageService } from './message.service';
import { InboxCrmService } from './inbox-crm.service';
import { InboxTransferService } from './inbox-transfer.service';
import { InboxSendPipelineService } from './inbox-send-pipeline.service';
import { InboxAiDiagnosisService } from './inbox-ai-diagnosis.service';
import { InboxThreadEventService } from './inbox-thread-event.service';
import { InboxThreadPinService } from './inbox-thread-pin.service';
import { InboxSavedViewService } from './inbox-saved-view.service';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

describe('InboxController', () => {
  let controller: InboxController;

  const sendPipeline = {
    send: jest.fn(),
  };

  const aiDiagnosis = {
    diagnose: jest.fn(),
  };

  const threadEvents = {
    record: jest.fn().mockResolvedValue({}),
    listForThread: jest.fn(),
  };

  const threadPins = {
    listForStaff: jest.fn(),
    toggle: jest.fn(),
    replaceAll: jest.fn(),
  };

  const savedViews = {
    listForStaff: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const messageService = {
    queryUnifiedConversations: jest.fn(),
    searchInboxMessages: jest.fn(),
    sendTextFromInbox: jest.fn(),
    sendImageFromInbox: jest.fn(),
    sendVideoFromInbox: jest.fn(),
    sendDocumentFromInbox: jest.fn(),
    sendAudioFromInbox: jest.fn(),
    markConversationRead: jest.fn(),
  };

  const inboxCrmService = {
    getThreadCrm: jest.fn(),
    upsertThreadCrm: jest.fn(),
    takeOverFromAi: jest.fn(),
    resumeAi: jest.fn(),
  };

  const inboxTransferService = {
    transferChat: jest.fn(),
  };

  const apiKey = {
    id: 'key-1',
    role: ApiKeyRole.OPERATOR,
    allowedSessions: ['sess-a', 'sess-b'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboxController],
      providers: [
        { provide: MessageService, useValue: messageService },
        { provide: InboxCrmService, useValue: inboxCrmService },
        { provide: InboxTransferService, useValue: inboxTransferService },
        { provide: InboxSendPipelineService, useValue: sendPipeline },
        { provide: InboxAiDiagnosisService, useValue: aiDiagnosis },
        { provide: InboxThreadEventService, useValue: threadEvents },
        { provide: InboxThreadPinService, useValue: threadPins },
        { provide: InboxSavedViewService, useValue: savedViews },
      ],
    }).compile();

    controller = module.get<InboxController>(InboxController);
  });

  describe('searchMessages', () => {
    it('passes query options and allowed sessions to message service', async () => {
      const payload = {
        matches: [],
        total: 0,
        returned: 0,
        offset: 0,
        truncated: false,
      };
      messageService.searchInboxMessages.mockResolvedValue(payload);

      const response = await controller.searchMessages(
        { apiKey } as never,
        {
          q: 'invoice',
          groupsOnly: true,
          mediaOnly: false,
          limit: 6,
          offset: 0,
        } as never,
      );

      expect(messageService.searchInboxMessages).toHaveBeenCalledWith({
        query: 'invoice',
        sessionId: undefined,
        chatId: undefined,
        groupsOnly: true,
        mediaOnly: false,
        allowedSessionIds: ['sess-a', 'sess-b'],
        limit: 6,
        offset: 0,
      });
      expect(response).toBe(payload);
    });
  });

  describe('getUnifiedConversations', () => {
    it('passes allowed sessions and operator scope to message service', async () => {
      const result = { conversations: [], total: 0, limit: 50, offset: 0 };
      messageService.queryUnifiedConversations.mockResolvedValue(result);

      const query = { limit: 50, offset: 0 };
      const response = await controller.getUnifiedConversations(
        { apiKey } as never,
        query as never,
      );

      expect(messageService.queryUnifiedConversations).toHaveBeenCalledWith(query, {
        allowedSessionIds: ['sess-a', 'sess-b'],
        apiKeyId: 'key-1',
        role: ApiKeyRole.OPERATOR,
      });
      expect(response).toBe(result);
    });

    it('passes undefined allowed sessions when key has full access', async () => {
      messageService.queryUnifiedConversations.mockResolvedValue({
        conversations: [],
        total: 0,
        limit: 50,
        offset: 0,
      });

      await controller.getUnifiedConversations(
        { apiKey: { ...apiKey, allowedSessions: [] } } as never,
        {} as never,
      );

      expect(messageService.queryUnifiedConversations).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ allowedSessionIds: undefined }),
      );
    });
  });

  describe('sendText', () => {
    it('returns send result on success', async () => {
      const sent = { messageId: 'msg-1', timestamp: 1 };
      sendPipeline.send.mockResolvedValue(sent);

      const result = await controller.sendText(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        text: 'Hello',
      });

      expect(sendPipeline.send).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey,
          sessionId: 'sess-a',
          chatId: '111@c.us',
          kind: 'text',
          text: 'Hello',
          source: 'inbox-manual',
        }),
      );
      expect(result).toBe(sent);
    });

    it('routes quoted replies through the send pipeline', async () => {
      const sent = { messageId: 'msg-2', timestamp: 2 };
      sendPipeline.send.mockResolvedValue(sent);

      await controller.sendText(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        text: 'Reply',
        quotedMessageId: 'wa-quoted-1',
      });

      expect(sendPipeline.send).toHaveBeenCalledWith(
        expect.objectContaining({
          quotedMessageId: 'wa-quoted-1',
          text: 'Reply',
        }),
      );
    });

    it('throws ConflictException when session is not ready', async () => {
      const failure = {
        ok: false as const,
        code: 'SESSION_NOT_READY',
        status: 'disconnected',
        message: 'Session offline',
      };
      sendPipeline.send.mockResolvedValue(failure);

      await expect(
        controller.sendText(apiKey as never, {
          sessionId: 'sess-a',
          chatId: '111@c.us',
          text: 'Hello',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('sendImage', () => {
    it('returns send result on success', async () => {
      const sent = { messageId: 'msg-img', timestamp: 1 };
      sendPipeline.send.mockResolvedValue(sent);

      const dto = {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        base64: 'abc',
        mimetype: 'image/jpeg',
      };
      const result = await controller.sendImage(apiKey as never, dto as never);

      expect(sendPipeline.send).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey,
          sessionId: 'sess-a',
          chatId: '111@c.us',
          kind: 'image',
          source: 'inbox-image',
        }),
      );
      expect(result).toBe(sent);
    });

    it('forwards quotedMessageId to send pipeline', async () => {
      sendPipeline.send.mockResolvedValue({ messageId: 'msg-img-q', timestamp: 1 });

      await controller.sendImage(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        base64: 'abc',
        mimetype: 'image/jpeg',
        quotedMessageId: 'wa-quoted-99',
      } as never);

      expect(sendPipeline.send).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'image',
          quotedMessageId: 'wa-quoted-99',
        }),
      );
    });

    it('throws ConflictException when session is not ready', async () => {
      sendPipeline.send.mockResolvedValue({
        ok: false as const,
        code: 'SESSION_NOT_READY',
        status: 'disconnected',
        message: 'offline',
      });

      await expect(
        controller.sendImage(apiKey as never, {
          sessionId: 'sess-a',
          chatId: '111@c.us',
          base64: 'abc',
          mimetype: 'image/jpeg',
        } as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('sendVideo', () => {
    it('delegates to send pipeline', async () => {
      const sent = { messageId: 'msg-vid', timestamp: 1 };
      sendPipeline.send.mockResolvedValue(sent);

      const dto = {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        base64: 'abc',
        mimetype: 'video/mp4',
      };
      const result = await controller.sendVideo(apiKey as never, dto as never);

      expect(sendPipeline.send).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'video',
          source: 'inbox-video',
        }),
      );
      expect(result).toBe(sent);
    });
  });

  describe('transferConversation', () => {
    it('delegates to transfer service', async () => {
      const dto = {
        fromSessionId: 'sess-a',
        toSessionId: 'sess-b',
        chatId: '111@c.us',
        reason: 'Handoff',
      };
      inboxTransferService.transferChat.mockResolvedValue({
        toSessionId: 'sess-b',
        chatId: '111@c.us',
      });

      const result = await controller.transferConversation(apiKey as never, dto as never);

      expect(inboxTransferService.transferChat).toHaveBeenCalledWith(apiKey, dto);
      expect(result).toEqual({ toSessionId: 'sess-b', chatId: '111@c.us' });
    });
  });

  describe('markConversationRead', () => {
    it('marks conversation read and returns ok', async () => {
      messageService.markConversationRead.mockResolvedValue(undefined);

      const result = await controller.markConversationRead({
        sessionId: 'sess-a',
        chatId: '111@c.us',
      });

      expect(messageService.markConversationRead).toHaveBeenCalledWith('sess-a', '111@c.us');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('thread CRM', () => {
    it('gets thread CRM', async () => {
      const crm = { sessionId: 'sess-a', chatId: '111@c.us', resolved: false };
      inboxCrmService.getThreadCrm.mockResolvedValue(crm);

      const result = await controller.getThreadCrm('sess-a', '111@c.us');

      expect(inboxCrmService.getThreadCrm).toHaveBeenCalledWith('sess-a', '111@c.us');
      expect(result).toBe(crm);
    });

    it('updates thread CRM', async () => {
      const updated = { sessionId: 'sess-a', chatId: '111@c.us', internalNote: 'note' };
      inboxCrmService.upsertThreadCrm.mockResolvedValue(updated);

      const result = await controller.updateThreadCrm(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        internalNote: 'note',
      });

      expect(inboxCrmService.upsertThreadCrm).toHaveBeenCalledWith(
        'sess-a',
        '111@c.us',
        { internalNote: 'note' },
        'key-1',
      );
      expect(result).toBe(updated);
    });

    it('takes over from AI', async () => {
      const crm = { aiHandlingState: 'staff' };
      inboxCrmService.takeOverFromAi.mockResolvedValue(crm);

      const result = await controller.takeOverFromAi(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
      });

      expect(inboxCrmService.takeOverFromAi).toHaveBeenCalledWith('sess-a', '111@c.us');
      expect(result).toBe(crm);
    });

    it('resumes AI', async () => {
      const crm = { aiHandlingState: 'ai' };
      inboxCrmService.resumeAi.mockResolvedValue(crm);

      const result = await controller.resumeAi(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
      });

      expect(inboxCrmService.resumeAi).toHaveBeenCalledWith('sess-a', '111@c.us');
      expect(result).toBe(crm);
    });
  });

  describe('thread pins', () => {
    it('lists pins for the current staff member', async () => {
      const pins = [{ sessionId: 'sess-a', chatId: '111@c.us', label: 'Alice' }];
      threadPins.listForStaff.mockResolvedValue(pins);

      const result = await controller.listPins(apiKey as never);

      expect(threadPins.listForStaff).toHaveBeenCalledWith('key-1');
      expect(result).toBe(pins);
    });

    it('toggles a pin for the current staff member', async () => {
      const payload = {
        pinned: true,
        pins: [{ sessionId: 'sess-a', chatId: '111@c.us', label: 'Alice' }],
      };
      threadPins.toggle.mockResolvedValue(payload);

      const result = await controller.togglePin(apiKey as never, {
        sessionId: 'sess-a',
        chatId: '111@c.us',
        label: 'Alice',
      });

      expect(threadPins.toggle).toHaveBeenCalledWith('key-1', 'sess-a', '111@c.us', 'Alice');
      expect(result).toBe(payload);
    });

    it('replaces all pins for the current staff member', async () => {
      const pins = [{ sessionId: 'sess-a', chatId: '111@c.us' }];
      threadPins.replaceAll.mockResolvedValue(pins);

      const result = await controller.replacePins(apiKey as never, { pins });

      expect(threadPins.replaceAll).toHaveBeenCalledWith('key-1', pins);
      expect(result).toBe(pins);
    });
  });

  describe('savedViews', () => {
    it('lists saved views for the current staff member', async () => {
      const views = [{ id: 'v1', name: 'Hot', config: { filter: 'hot_leads' } }];
      savedViews.listForStaff.mockResolvedValue(views);

      const result = await controller.listSavedViews(apiKey as never);

      expect(savedViews.listForStaff).toHaveBeenCalledWith('key-1');
      expect(result).toBe(views);
    });

    it('creates a saved view', async () => {
      const created = { id: 'v1', name: 'Mine', config: { filter: 'my_work' } };
      savedViews.create.mockResolvedValue(created);

      const result = await controller.createSavedView(apiKey as never, {
        name: 'Mine',
        config: { filter: 'my_work' },
      });

      expect(savedViews.create).toHaveBeenCalledWith('key-1', 'Mine', { filter: 'my_work' });
      expect(result).toBe(created);
    });
  });
});
