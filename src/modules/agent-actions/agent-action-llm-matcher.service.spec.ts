jest.mock('../ai/ai-chat.service', () => ({
  AiChatService: jest.fn().mockImplementation(() => ({
    completeStructuredPrompt: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AgentActionLlmMatcherService } from './agent-action-llm-matcher.service';
import { AgentActionRegistryService } from './agent-action-registry.service';
import { AiChatService } from '../ai/ai-chat.service';

describe('AgentActionLlmMatcherService', () => {
  let service: AgentActionLlmMatcherService;
  let aiChat: { completeStructuredPrompt: jest.Mock };

  beforeEach(async () => {
    aiChat = {
      completeStructuredPrompt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentActionLlmMatcherService,
        AgentActionRegistryService,
        { provide: AiChatService, useValue: aiChat },
      ],
    }).compile();

    service = module.get(AgentActionLlmMatcherService);
  });

  it('returns refined match when LLM confirms with high confidence', async () => {
    aiChat.completeStructuredPrompt.mockResolvedValue(
      JSON.stringify({ actionId: 'ai.auto_reply.disable', confidence: 0.92, params: {} }),
    );

    const result = await service.refine('please stop auto replies', {
      actionId: 'ai.auto_reply.enable',
      confidence: 0.62,
      params: {},
    });

    expect(result?.actionId).toBe('ai.auto_reply.disable');
    expect(result?.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('returns null when LLM says none', async () => {
    aiChat.completeStructuredPrompt.mockResolvedValue(
      JSON.stringify({ actionId: 'none', confidence: 0, params: {} }),
    );

    const result = await service.refine('hello there', {
      actionId: 'ai.auto_reply.disable',
      confidence: 0.6,
      params: {},
    });

    expect(result).toBeNull();
  });

  it('returns null for unknown action ids from LLM', async () => {
    aiChat.completeStructuredPrompt.mockResolvedValue(
      JSON.stringify({ actionId: 'made.up.action', confidence: 0.95, params: {} }),
    );

    const result = await service.refine('do something weird', {
      actionId: 'ai.auto_reply.disable',
      confidence: 0.7,
      params: {},
    });

    expect(result).toBeNull();
  });
});
