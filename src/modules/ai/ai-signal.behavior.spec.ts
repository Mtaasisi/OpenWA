import { AiSignalService } from './ai-signal.service';
import {
  AiCustomerIntent,
  AiEscalationReason,
  AiSignalType,
  StockingReminderReason,
} from './ai-signal.enums';
import {
  BRANCH_CITY_ASK_REPLY,
  CONTEXT_CLARIFICATION_REPLY,
  pickFirstDiscountDefenseReply,
} from './utils/ai-behavior.util';
import { PAYMENT_PROOF_ACK_REPLY } from './utils/payment-proof.util';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import type { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';

const SESSION_ID = 'sess-smoke-0001';
const CHAT_ID = '255700000001@c.us';

function createSignalService(options?: {
  crm?: Partial<InboxThreadCrm>;
  profiles?: Array<{ branchId: string; branchName: string }>;
  locationBlock?: string;
  products?: Array<{
    id: string;
    name: string;
    installmentEnabled: boolean;
    installmentRequiresApproval?: boolean;
    inStock: boolean;
    allowInstallmentWhenOutOfStock: boolean;
  }>;
}) {
  let crmRow: InboxThreadCrm = {
    sessionId: SESSION_ID,
    chatId: CHAT_ID,
    resolved: false,
    discountRequestCount: 0,
    ...options?.crm,
  } as InboxThreadCrm;

  const crmRepo = {
    findOne: jest.fn(async () => crmRow),
    create: jest.fn((row: Partial<InboxThreadCrm>) => ({ ...row })),
    save: jest.fn(async (row: InboxThreadCrm) => {
      crmRow = row;
      return row;
    }),
  };

  const eventRepo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
    count: jest.fn(),
    find: jest.fn(async () => []),
  };

  const escalationRepo = {
    findOne: jest.fn(async () => null),
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
    count: jest.fn(),
    update: jest.fn(),
  };

  const stockingRepo = {
    create: jest.fn((row: unknown) => row),
    save: jest.fn(async (row: unknown) => row),
    count: jest.fn(),
    find: jest.fn(),
  };

  const followupConversation = {
    getOrCreate: jest.fn(async () => ({ id: 'conv-1', stage: 'new_lead', internalNote: null })),
    findByThread: jest.fn(async () => null),
    update: jest.fn(async () => ({})),
  };

  const followupQueue = {
    createAutopilotQueueItem: jest.fn(async () => ({})),
  };

  const profileService = {
    listProfiles: jest.fn(async () => options?.profiles ?? []),
    getProfile: jest.fn(async (branchId: string) => {
      if (!options?.locationBlock) return null;
      return { branchId, locationDescription: options.locationBlock };
    }),
    getDefaultPaymentAccount: jest.fn(async () => null),
    formatLocationBlock: jest.fn(() => options?.locationBlock ?? ''),
    formatPaymentBlock: jest.fn(() => ''),
  };

  const productsService = {
    searchForAgent: jest.fn(async () => options?.products ?? []),
  };

  const productDemand = {
    recordFromMessage: jest.fn(async () => null),
  };

  const learningInbox = {
    processOutcomeOnIncoming: jest.fn(async () => undefined),
  };

  const sessionRepo = { find: jest.fn(async () => []) };
  const followupConvRepo = { find: jest.fn(async () => []) };
  const threadSummaryRepo = { find: jest.fn(async () => []) };

  const service = new AiSignalService(
    crmRepo as never,
    eventRepo as never,
    escalationRepo as never,
    stockingRepo as never,
    sessionRepo as never,
    followupConvRepo as never,
    threadSummaryRepo as never,
    followupConversation as never,
    followupQueue as never,
    profileService as never,
    productsService as never,
    productDemand as never,
    learningInbox as never,
  );

  return {
    service,
    crmRow: () => crmRow,
    escalationRepo,
    stockingRepo,
    followupQueue,
    productsService,
    learningInbox,
    productDemand,
  };
}

describe('AiSignalService behavior smoke', () => {
  it('short message without product context returns clarification reply', async () => {
    const { service } = createSignalService();
    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'ipo?');
    expect(result.deterministicReply).toBe(CONTEXT_CLARIFICATION_REPLY);
    expect(result.skipAgent).toBe(true);
  });

  it('second discount request pauses AI and escalates', async () => {
    const { service, crmRow, escalationRepo, followupQueue } = createSignalService({
      crm: { discountRequestCount: 1 },
    });

    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'punguza bei kidogo');

    expect(result.skipAgent).toBe(true);
    expect(result.escalate).toBe(true);
    expect(result.escalationReason).toBe(AiEscalationReason.REPEATED_DISCOUNT);
    expect(crmRow().aiAutoReplyPaused).toBe(true);
    expect(crmRow().autopilotPauseReason).toBe('repeated_discount');
    expect(crmRow().aiHandlingState).toBe(InboxAiHandlingState.WAITING_HUMAN);
    expect(escalationRepo.save).toHaveBeenCalled();
    expect(followupQueue.createAutopilotQueueItem).toHaveBeenCalled();
  });

  it('second discount request does not escalate when unrestricted', async () => {
    const { service, crmRow, escalationRepo } = createSignalService({
      crm: { discountRequestCount: 1 },
    });

    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'punguza bei tena', null, {
      unrestricted: true,
    });

    expect(result.escalate).toBe(false);
    expect(result.skipAgent).toBe(false);
    expect(crmRow().aiAutoReplyPaused).not.toBe(true);
    expect(escalationRepo.save).not.toHaveBeenCalled();
  });

  it('compatibility model answer returns deterministic ack', async () => {
    const { service } = createSignalService({
      crm: { lastProductInterest: 'USB-C charger' },
    });

    const result = await service.processIncoming(
      SESSION_ID,
      CHAT_ID,
      'iPhone 14',
      null,
      { lastAssistantMessage: 'Simu yako ni iPhone au Android?' },
    );
    expect(result.deterministicReply).toMatch(/inafaa/i);
    expect(result.skipAgent).toBe(true);
  });

  it('location with confirmed city soft re-confirms instead of re-asking branch', async () => {
    const { service } = createSignalService({
      crm: { confirmedCity: 'Dar', preferredBranchId: 'dar' },
      profiles: [{ branchId: 'dar', branchName: 'Dar es Salaam' }],
      locationBlock: 'Tuko Mwenge Plaza',
    });

    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'Duka lipo wapi?');
    expect(result.deterministicReply).toMatch(/Si uko Dar Boss/i);
    expect(result.deterministicReply).toMatch(/Mwenge/i);
  });

  it('location request with multiple branches asks for city', async () => {
    const { service } = createSignalService({
      profiles: [
        { branchId: 'dar', branchName: 'Dar es Salaam' },
        { branchId: 'aru', branchName: 'Arusha' },
      ],
    });

    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'Duka lipo wapi?');
    expect(result.deterministicReply).toBe(BRANCH_CITY_ASK_REPLY);
  });

  it('maps Dar city to preferred branch', async () => {
    const { service, crmRow } = createSignalService({
      profiles: [
        { branchId: 'dar', branchName: 'Dar es Salaam' },
        { branchId: 'aru', branchName: 'Arusha' },
      ],
    });

    await service.processIncoming(SESSION_ID, CHAT_ID, 'Niko Dar');
    expect(crmRow().confirmedCity).toBe('Dar');
    expect(crmRow().preferredBranchId).toBe('dar');
  });

  it('OOS installment creates stocking reminder and inject block', async () => {
    const { service, stockingRepo } = createSignalService({
      crm: { lastProductInterest: 'iPhone 14' },
      products: [
        {
          id: 'p1',
          name: 'iPhone 14',
          installmentEnabled: true,
          inStock: false,
          allowInstallmentWhenOutOfStock: true,
        },
      ],
    });

    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'naweza lipa kidogo kidogo?');
    expect(result.signalType).toBe(AiSignalType.OUT_OF_STOCK_INSTALLMENT);
    expect(result.injectPromptBlock).toMatch(/out of stock internally/i);
    expect(stockingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: StockingReminderReason.INSTALLMENT_OUT_OF_STOCK,
      }),
    );
  });

  it('first discount request returns deterministic defense reply', async () => {
    const { service } = createSignalService();
    const result = await service.processIncoming(SESSION_ID, CHAT_ID, 'punguza bei kidogo');
    expect(result.deterministicReply).toBe(pickFirstDiscountDefenseReply(CHAT_ID));
    expect(result.skipAgent).toBe(true);
    expect(result.escalate).toBe(false);
  });

  it('payment proof message acks and creates confirmation task', async () => {
    const { service, followupQueue } = createSignalService();
    const result = await service.processIncoming(
      SESSION_ID,
      CHAT_ID,
      'Nimepokea screenshot ya malipo',
    );
    expect(result.deterministicReply).toBe(PAYMENT_PROOF_ACK_REPLY);
    expect(followupQueue.createAutopilotQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ detectedReason: 'payment_confirmation' }),
    );
  });

  it('installment approval creates escalation and task', async () => {
    const { service, escalationRepo, followupQueue } = createSignalService({
      crm: { lastProductInterest: 'iPhone 14' },
      products: [
        {
          id: 'p1',
          name: 'iPhone 14',
          installmentEnabled: true,
          installmentRequiresApproval: true,
          inStock: true,
          allowInstallmentWhenOutOfStock: false,
        },
      ],
    });

    await service.processIncoming(SESSION_ID, CHAT_ID, 'naweza lipa kidogo kidogo?');
    expect(escalationRepo.save).toHaveBeenCalled();
    expect(followupQueue.createAutopilotQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ detectedReason: 'installment_approval' }),
    );
  });

  it('group lead syncs pipeline and creates group_lead escalation', async () => {
    const { service, escalationRepo } = createSignalService();

    const created = await service.processGroupLead(SESSION_ID, 'group@g.us', 'Bei ya laptop?');
    expect(created).toBe(true);
    expect(escalationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reason: AiEscalationReason.GROUP_LEAD }),
    );
  });

  it('createEscalation allows group_lead on group chats', async () => {
    const { service, escalationRepo } = createSignalService();

    const row = await service.createEscalation({
      sessionId: SESSION_ID,
      chatId: '120363@g.us',
      reason: AiEscalationReason.GROUP_LEAD,
      detail: 'Bei ya laptop?',
    });
    expect(row).not.toBeNull();
    expect(escalationRepo.save).toHaveBeenCalled();
  });

  it('createEscalation skips non-group-lead reasons on group chats', async () => {
    const { service, escalationRepo } = createSignalService();

    const row = await service.createEscalation({
      sessionId: SESSION_ID,
      chatId: '120363@g.us',
      reason: AiEscalationReason.COMPLAINT,
      detail: 'test',
    });
    expect(row).toBeNull();
    expect(escalationRepo.save).not.toHaveBeenCalled();
  });

  it('hapana topic change replaces stale product interest', async () => {
    const { service, crmRow } = createSignalService({
      crm: { lastProductInterest: 'iPhone 14', lastIntent: AiCustomerIntent.PRICE_REQUEST },
    });

    await service.processIncoming(SESSION_ID, CHAT_ID, 'Hapana leo nataka charger');
    expect(crmRow().lastProductInterest).not.toBe('iPhone 14');
    expect(crmRow().lastProductInterest).toMatch(/charger/i);
  });

  it('records product demand and learning outcome on every incoming message', async () => {
    const { service, productDemand, learningInbox } = createSignalService();

    await service.processIncoming(SESSION_ID, CHAT_ID, 'Bei ya iPhone 14?');

    expect(productDemand.recordFromMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        chatId: CHAT_ID,
        rawMessage: 'Bei ya iPhone 14?',
      }),
    );
    expect(learningInbox.processOutcomeOnIncoming).toHaveBeenCalledWith(
      SESSION_ID,
      CHAT_ID,
      'Bei ya iPhone 14?',
    );
  });
});
