import { AiInboxAgentService } from './ai-inbox-agent.service';

const SESSION_ID = 'sess-11111111-1111-1111-1111-111111111111';
const CHAT_ID = '255700000000@c.us';

function createAgentService(options?: {
  catalogBlock?: string;
  thread?: Array<{ role: 'user' | 'assistant'; content: string }>;
  runResult?: { content: string; actions: unknown[] };
}) {
  let capturedSystemContent = '';

  const aiSettings = {
    getActiveConfig: jest.fn(async () => ({
      enabled: true,
      autoReplyEnabled: true,
      autoReplyContextMessages: 8,
      autoReplyContextMessagesMax: 12,
      knowledgeRagEnabled: false,
      memoryRagEnabled: false,
      includeCatalogWhenNeeded: true,
      includeCrmWhenNeeded: true,
      includeKnowledgeWhenNeeded: true,
      includeMemoryWhenNeeded: true,
      maxCustomerToolIterations: 2,
      provider: 'OPENAI',
      model: 'gpt-4o-mini',
      autoReplyModelTier: 'cheap_fast',
      allowPremiumModelForAutoReply: false,
      maxTokens: 512,
      temperature: 0.7,
      disabledTools: [],
    })),
    filterTools: jest.fn((_tools: unknown[], config: unknown) => config),
  };

  const aiChat = {
    runAssistantWithTools: jest.fn(async (input: { systemContent: string }) => {
      capturedSystemContent = input.systemContent;
      return (
        options?.runResult ?? {
          content: 'Ndiyo Boss ipo 😊',
          actions: [],
          provider: 'openai',
          model: 'gpt-4o-mini',
          latencyMs: 120,
        }
      );
    }),
  };

  const contextService = {
    buildCrmContextBlock: jest.fn(async () => '=== CRM context ==='),
    buildContextSummary: jest.fn(async () => '=== Conversation context ==='),
    buildThread: jest.fn(async () =>
      options?.thread ?? [{ role: 'user' as const, content: 'iPhone 15 ipo?' }],
    ),
  };

  const customerTools = {
    getToolDefinitions: jest.fn(() => [
      { name: 'search_products', description: 'Search catalog', parameters: {} },
    ]),
    buildCatalogContextBlock: jest.fn(async () =>
      options?.catalogBlock ??
      '=== Shop inventory catalog ===\n- iPhone 15 [Phones] — 500 TZS',
    ),
    executeTool: jest.fn(async () => '{"count":1,"products":[]}'),
  };

  const service = new AiInboxAgentService(
    aiSettings as never,
    aiChat as never,
    contextService as never,
    customerTools as never,
    { logToolCall: jest.fn() } as never,
    { buildContextualPromptExcerpt: jest.fn(async () => '') } as never,
    { buildContextualPromptExcerpt: jest.fn(async () => '') } as never,
    { buildReplySamplesPromptBlock: jest.fn(async () => '') } as never,
    { clampMaxTokens: jest.fn((_f: string, n: number) => n) } as never,
  );

  return { service, aiChat, customerTools, getSystemContent: () => capturedSystemContent };
}

describe('AiInboxAgentService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('injects linked local inventory catalog into the system prompt', async () => {
    const catalogBlock =
      '=== Shop inventory catalog (local CRM — linked inventory) ===\n- Samsung A05 — 250000 TZS';
    const { service, customerTools, getSystemContent } = createAgentService({ catalogBlock });

    await service.runCustomerAgent({
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      incomingText: 'Samsung A05 bei ngapi?',
      onEscalate: jest.fn(),
    });

    expect(customerTools.buildCatalogContextBlock).toHaveBeenCalled();
    expect(getSystemContent()).toContain(catalogBlock);
    expect(getSystemContent()).toContain('linked local inventory');
    expect(getSystemContent()).toContain('IMEI/serial');
  });

  it('returns null content when thread is empty', async () => {
    const { service } = createAgentService({ thread: [] });

    const result = await service.runCustomerAgent({
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      incomingText: 'Hi',
      onEscalate: jest.fn(),
    });

    expect(result.content).toBeNull();
  });
});
