import { AiInboxAgentService } from './ai-inbox-agent.service';
import { AiCustomerIntent } from './ai-signal.enums';

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
      autoReplyContextMessages: 3,
      autoReplyContextMessagesMax: 5,
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
          aiCallsCount: 1,
          toolCallsCount: 0,
        }
      );
    }),
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

  const promptAssembler = {
    assemble: jest.fn(async () => ({
      systemContent: [
        'You are a WhatsApp shop assistant for this business.',
        '=== Product question rules ===',
        options?.catalogBlock ??
          '=== Shop inventory catalog ===\n- iPhone 15 [Phones] — 500 TZS',
        'Tool rules:',
        '- Use search_products before quoting prices, stock, or variants.',
      ].join('\n\n'),
      thread: options?.thread ?? [{ role: 'user' as const, content: 'iPhone 15 ipo?' }],
      breakdown: {
        rules_tokens: 120,
        knowledge_tokens: 0,
        history_tokens: 40,
        tool_tokens: 0,
        customer_message_tokens: 10,
        crm_tokens: 0,
        catalog_tokens: 50,
        memory_tokens: 0,
        total_estimated_input_tokens: 220,
      },
      budgetWarning: null,
      intent: AiCustomerIntent.PRODUCT_SEARCH,
      historyLimit: 3,
    })),
  };

  const service = new AiInboxAgentService(
    aiSettings as never,
    aiChat as never,
    customerTools as never,
    { logToolCall: jest.fn() } as never,
    { clampMaxTokens: jest.fn((_f: string, n: number) => n) } as never,
    promptAssembler as never,
  );

  return { service, aiChat, customerTools, getSystemContent: () => capturedSystemContent };
}

describe('AiInboxAgentService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses prompt assembler and includes catalog context', async () => {
    const catalogBlock =
      '=== Shop inventory catalog (local CRM — linked inventory) ===\n- Samsung A05 — 250000 TZS';
    const { service, getSystemContent } = createAgentService({ catalogBlock });

    await service.runCustomerAgent({
      sessionId: SESSION_ID,
      chatId: CHAT_ID,
      incomingText: 'Samsung A05 bei ngapi?',
      onEscalate: jest.fn(),
    });

    expect(getSystemContent()).toContain(catalogBlock);
    expect(getSystemContent()).toContain('search_products');
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
