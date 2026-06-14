import { AiLearningInboxService } from './ai-learning-inbox.service';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import {
  AiLearningItemStatus,
  AiLearningKnowledgeStatus,
  AiLearningOutcome,
} from './ai-learning.enums';
import { parseAiNotes, serializeAiNotes } from './utils/ai-behavior.util';
import type { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';

const SESSION_ID = 'sess-learning-01';
const CHAT_ID = '255700000001@c.us';

function createLearningInboxService(options?: {
  settings?: Partial<{
    enableLearningDetection: boolean;
    highConfidenceThreshold: number;
    mediumConfidenceThreshold: number;
    defaultUnknownReply: string;
    trackCustomerOutcome: boolean;
    trackStaffCorrections: boolean;
  }>;
  crm?: Partial<InboxThreadCrm>;
  knowledgeMatch?: { score: number; knowledge: { id: string; approvedAnswer: string; sourceItemId?: string | null } } | null;
}) {
  const settings = {
    enableLearningDetection: true,
    highConfidenceThreshold: 0.8,
    mediumConfidenceThreshold: 0.5,
    defaultUnknownReply: 'Nipe muda kidogo Boss…',
    trackCustomerOutcome: true,
    trackStaffCorrections: true,
    ...options?.settings,
  };

  let crmRow: InboxThreadCrm = {
    sessionId: SESSION_ID,
    chatId: CHAT_ID,
    resolved: false,
    discountRequestCount: 0,
    ...options?.crm,
  } as InboxThreadCrm;

  const items = {
    createFromLowConfidence: jest.fn(async () => ({
      id: 'learn-item-1',
      question: 'Bei ya simu?',
      timesAsked: 1,
    })),
    createStaffCorrection: jest.fn(async () => ({ id: 'learn-item-2' })),
    updateItem: jest.fn(async () => ({})),
  };

  const knowledge = {
    findBestMatch: jest.fn(async () => options?.knowledgeMatch ?? null),
    recordUsage: jest.fn(async () => undefined),
    getKnowledge: jest.fn(async (id: string) => ({
      id,
      successRate: 0.5,
      questionPattern: 'bei',
      sourceItemId: 'src-item-1',
    })),
    updateKnowledge: jest.fn(async () => ({})),
  };

  const settingsService = {
    getSettings: jest.fn(async () => settings),
  };

  const messageService = {
    getChatMessagesForAi: jest.fn(async () => ({
      messages: [{ direction: 'incoming', body: 'Bei ya simu?', createdAt: new Date() }],
    })),
    getMessages: jest.fn(async () => ({
      messages: [
        { direction: 'incoming', body: 'Bei ya iphone?' },
        { direction: 'outgoing', body: 'AI draft answer', isAiGenerated: true },
      ],
    })),
  };

  const inboxCrm = {
    setAiHandlingState: jest.fn(async () => undefined),
  };

  const events = {
    emitAiLearningPending: jest.fn(),
    emitAiLearningRepeated: jest.fn(),
    emitKnowledgeNeedsReview: jest.fn(),
  };

  const crmRepo = {
    findOne: jest.fn(async () => crmRow),
    save: jest.fn(async (row: InboxThreadCrm) => {
      crmRow = row;
      return row;
    }),
  };

  const trainingScan = {
    createFromLowConfidence: jest.fn(async () => ({
      id: 'learn-item-1',
      question: 'Bei ya simu?',
      timesAsked: 1,
    })),
    createFromHumanReply: jest.fn(),
  };

  const service = new AiLearningInboxService(
    items as never,
    knowledge as never,
    settingsService as never,
    messageService as never,
    inboxCrm as never,
    events as never,
    crmRepo as never,
    trainingScan as never,
  );

  return {
    service,
    items,
    knowledge,
    inboxCrm,
    events,
    trainingScan,
    crmRow: () => crmRow,
    settings,
  };
}

describe('AiLearningInboxService inbox→learning behavior', () => {
  it('decideBeforeAgent bypasses learning when detection is disabled', async () => {
    const { service } = createLearningInboxService({
      settings: { enableLearningDetection: false },
    });
    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'random?');
    expect(result.useApprovedAnswer).toBeNull();
    expect(result.shouldEscalateLowConfidence).toBe(false);
    expect(result.confidenceScore).toBe(0.7);
  });

  it('decideBeforeAgent reuses high-confidence approved knowledge', async () => {
    const { service, knowledge } = createLearningInboxService({
      knowledgeMatch: {
        score: 0.92,
        knowledge: { id: 'k-1', approvedAnswer: 'Bei ni 500k', sourceItemId: 'item-src' },
      },
    });
    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Bei ya simu?');
    expect(result.useApprovedAnswer).toBe('Bei ni 500k');
    expect(result.knowledgeId).toBe('k-1');
    expect(result.sourceItemId).toBe('item-src');
    expect(knowledge.recordUsage).toHaveBeenCalledWith('k-1');
  });

  it('decideBeforeAgent reuses training-center applied knowledge', async () => {
    const { service, knowledge } = createLearningInboxService({
      knowledgeMatch: {
        score: 0.9,
        knowledge: {
          id: 'k-training-1',
          approvedAnswer: 'Tupo Dar es Salaam Boss.',
          sourceItemId: 'train-item-1',
        },
      },
    });
    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi?');
    expect(result.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(result.sourceItemId).toBe('train-item-1');
    expect(knowledge.recordUsage).toHaveBeenCalledWith('k-training-1');
  });

  it('decideBeforeAgent reuses training knowledge for close paraphrases below global threshold', async () => {
    const { service, knowledge } = createLearningInboxService({
      knowledgeMatch: {
        score: 0.72,
        knowledge: {
          id: 'k-training-2',
          approvedAnswer: 'Tupo Dar es Salaam Boss.',
          sourceItemId: 'train-item-2',
        },
      },
    });
    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi boss?');
    expect(result.useApprovedAnswer).toBe('Tupo Dar es Salaam Boss.');
    expect(knowledge.recordUsage).toHaveBeenCalledWith('k-training-2');
  });

  it('decideBeforeAgent escalates low-confidence unknown questions', async () => {
    const { service, settings } = createLearningInboxService();
    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Nini hii?', 0.1);
    expect(result.shouldEscalateLowConfidence).toBe(true);
    expect(result.waitingReply).toBe(settings.defaultUnknownReply);
  });

  it('handleLowConfidence creates pending item and pauses AI handling', async () => {
    const { service, trainingScan, inboxCrm, events } = createLearningInboxService();
    await service.handleLowConfidence({
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      incomingText: 'Bei ya simu?',
      confidenceScore: 0.2,
    });
    expect(trainingScan.createFromLowConfidence).toHaveBeenCalledWith(
      expect.objectContaining({ incomingText: 'Bei ya simu?', confidenceScore: 0.2 }),
    );
    expect(inboxCrm.setAiHandlingState).toHaveBeenCalledWith(
      SESSION_ID,
      CHAT_ID,
      InboxAiHandlingState.WAITING_HUMAN,
    );
    expect(events.emitAiLearningPending).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ itemId: 'learn-item-1', chatId: CHAT_ID }),
    );
  });

  it('markPendingKnowledgeOutcome stores CRM pending outcome marker', async () => {
    const { service, crmRow } = createLearningInboxService();
    await service.markPendingKnowledgeOutcome(SESSION_ID, CHAT_ID, 'k-1', 'item-src');
    const notes = parseAiNotes(crmRow().aiNotes);
    expect(notes.pendingKnowledgeOutcome).toEqual(
      expect.objectContaining({ knowledgeId: 'k-1', sourceItemId: 'item-src' }),
    );
  });

  it('processOutcomeOnIncoming bumps knowledge success on positive customer reply', async () => {
    const { service, knowledge, items, crmRow } = createLearningInboxService({
      crm: {
        aiNotes: serializeAiNotes({
          pendingKnowledgeOutcome: {
            knowledgeId: 'k-1',
            sourceItemId: 'item-src',
            askedAt: new Date().toISOString(),
          },
        }),
      },
    });
    await service.processOutcomeOnIncoming(SESSION_ID, CHAT_ID, 'Asante sana boss');
    expect(knowledge.updateKnowledge).toHaveBeenCalledWith(
      'k-1',
      expect.objectContaining({ successRate: expect.any(Number) }),
    );
    expect(items.updateItem).toHaveBeenCalledWith('item-src', {
      outcome: AiLearningOutcome.CUSTOMER_REPLIED_POSITIVELY,
    });
    expect(parseAiNotes(crmRow().aiNotes).pendingKnowledgeOutcome).toBeUndefined();
  });

  it('processOutcomeOnIncoming flags needs_review on staff correction signal', async () => {
    const { service, knowledge, events } = createLearningInboxService({
      crm: {
        aiNotes: serializeAiNotes({
          pendingKnowledgeOutcome: { knowledgeId: 'k-1', sourceItemId: null },
        }),
      },
    });
    await service.processOutcomeOnIncoming(SESSION_ID, CHAT_ID, 'Sio hiyo bei');
    expect(knowledge.updateKnowledge).toHaveBeenCalledWith(
      'k-1',
      expect.objectContaining({ status: AiLearningKnowledgeStatus.NEEDS_REVIEW }),
    );
    expect(events.emitKnowledgeNeedsReview).toHaveBeenCalled();
  });

  it('processOutcomeOnIncoming no-ops when outcome tracking disabled', async () => {
    const { service, knowledge } = createLearningInboxService({
      settings: { trackCustomerOutcome: false },
      crm: {
        aiNotes: serializeAiNotes({
          pendingKnowledgeOutcome: { knowledgeId: 'k-1' },
        }),
      },
    });
    await service.processOutcomeOnIncoming(SESSION_ID, CHAT_ID, 'Asante');
    expect(knowledge.updateKnowledge).not.toHaveBeenCalled();
  });

  it('handleStaffCorrection creates suggested learning item after AI edit', async () => {
    const { service, items } = createLearningInboxService();
    await service.handleStaffCorrection(SESSION_ID, CHAT_ID, 'Staff corrected answer');
    expect(items.createStaffCorrection).toHaveBeenCalledWith(
      expect.objectContaining({
        question: 'Bei ya iphone?',
        aiDraftAnswer: 'AI draft answer',
        status: AiLearningItemStatus.SUGGESTED,
      }),
    );
  });

  it('decideBeforeAgent still requires high confidence for legacy knowledge without training source', async () => {
    const { service } = createLearningInboxService({
      knowledgeMatch: {
        score: 0.72,
        knowledge: {
          id: 'k-legacy',
          approvedAnswer: 'Legacy answer',
          sourceItemId: null,
        },
      },
    });
    const result = await service.decideBeforeAgent(SESSION_ID, CHAT_ID, 'Mko wapi boss?', 0.5);
    expect(result.useApprovedAnswer).toBeNull();
    expect(result.shouldEscalateLowConfidence).toBe(false);
  });
});
