import { AiMessageBufferService } from './ai-message-buffer.service';
import { AiMessageBufferStatus } from '../entities/ai-message-buffer.entity';

describe('AiMessageBufferService', () => {
  it('creates a new pending buffer when none exists', async () => {
    const saved: Record<string, unknown>[] = [];
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row: Record<string, unknown>) => row),
      save: jest.fn(async (row: Record<string, unknown>) => {
        saved.push(row);
        return row;
      }),
    };
    const aiSettings = {
      getActiveConfig: jest.fn().mockResolvedValue({
        messageBufferEnabled: true,
        messageBufferDebounceSeconds: 10,
        messageBufferMaxWaitSeconds: 30,
        messageBufferMaxMessages: 10,
        messageBufferMaxCharacters: 4000,
      }),
    };

    const service = new AiMessageBufferService(repo as never, aiSettings as never);
    const row = await service.enqueue({
      sessionId: 'sess-1',
      chatId: '255700@c.us',
      messageId: 'msg-1',
      text: 'Hello',
    });

    expect(row.status).toBe(AiMessageBufferStatus.PENDING);
    expect(row.messageIds).toEqual(['msg-1']);
    expect(repo.save).toHaveBeenCalled();
  });

  it('appends to existing pending buffer for same conversation', async () => {
    const existing = {
      conversationId: 'sess-1:255700@c.us',
      status: AiMessageBufferStatus.PENDING,
      messageIds: ['msg-1'],
      rawMessages: [{ messageId: 'msg-1', text: 'Hi', receivedAt: new Date().toISOString() }],
      combinedText: 'Hi',
      normalizedCombinedText: 'hi',
      firstMessageAt: new Date(Date.now() - 5000),
      lastMessageAt: new Date(),
      scheduledProcessAt: new Date(Date.now() + 5000),
      batchId: 'batch-1',
    };
    const repo = {
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn(async (row: typeof existing) => row),
    };
    const aiSettings = {
      getActiveConfig: jest.fn().mockResolvedValue({
        messageBufferEnabled: true,
        messageBufferDebounceSeconds: 10,
        messageBufferMaxWaitSeconds: 30,
        messageBufferMaxMessages: 10,
        messageBufferMaxCharacters: 4000,
      }),
    };

    const service = new AiMessageBufferService(repo as never, aiSettings as never);
    const row = await service.enqueue({
      sessionId: 'sess-1',
      chatId: '255700@c.us',
      messageId: 'msg-2',
      text: 'Bei ya simu?',
    });

    expect(row.messageIds).toContain('msg-2');
    expect(row.combinedText).toContain('Bei ya simu');
  });
});
