jest.mock('./agent-action-executor.service', () => ({
  AgentActionExecutorService: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
}));

jest.mock('./agent-action-llm-matcher.service', () => ({
  AgentActionLlmMatcherService: jest.fn().mockImplementation(() => ({
    refine: jest.fn(),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AgentActionRouterService } from './agent-action-router.service';
import { AgentActionRegistryService } from './agent-action-registry.service';
import { AgentActionMatcherService } from './agent-action-matcher.service';
import { AgentActionPermissionService } from './agent-action-permission.service';
import { AgentActionRiskService } from './agent-action-risk.service';
import { AgentActionConfirmationService } from './agent-action-confirmation.service';
import { AgentActionExecutorService } from './agent-action-executor.service';
import { AgentActionAuditService } from './agent-action-audit.service';
import { AgentActionLinkService } from './agent-action-link.service';
import { AgentActionSettingsService } from './agent-action-settings.service';
import { AgentActionLlmMatcherService } from './agent-action-llm-matcher.service';

describe('AgentActionRouterService', () => {
  let router: AgentActionRouterService;
  let settings: { get: jest.Mock };
  let executor: jest.Mocked<Pick<AgentActionExecutorService, 'execute'>>;
  let confirmations: { create: jest.Mock; confirm: jest.Mock };
  let llmMatcher: { refine: jest.Mock };

  beforeEach(async () => {
    settings = {
      get: jest.fn().mockResolvedValue({
        agentActionsEnabled: true,
        allowSafeDirectExecution: true,
        requireConfirmationForMediumRisk: true,
        requireConfirmationForHighRisk: true,
        adminOnlyHighRisk: true,
        allowQuickLinks: true,
      }),
    };
    executor = { execute: jest.fn().mockResolvedValue({
      message: 'AI auto reply disabled.',
      data: { oldValue: true, newValue: false },
    }) };
    confirmations = {
      create: jest.fn().mockResolvedValue({ id: 'conf-1' }),
      confirm: jest.fn().mockResolvedValue({
        confirmation: { actionId: 'ai.burst_reading.disable', risk: 'medium' },
        params: {},
      }),
    };
    llmMatcher = { refine: jest.fn().mockResolvedValue(null) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentActionRouterService,
        AgentActionRegistryService,
        AgentActionMatcherService,
        AgentActionPermissionService,
        AgentActionRiskService,
        AgentActionLinkService,
        { provide: AgentActionSettingsService, useValue: settings },
        { provide: AgentActionExecutorService, useValue: executor },
        { provide: AgentActionConfirmationService, useValue: confirmations },
        {
          provide: AgentActionLlmMatcherService,
          useValue: llmMatcher,
        },
        {
          provide: AgentActionAuditService,
          useValue: { logAttempt: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    router = module.get(AgentActionRouterService);
  });

  it('resolves high-confidence safe action and executes', async () => {
    const result = await router.resolve(
      { text: 'Zima AI auto reply', userId: 'u1' },
      ApiKeyRole.OPERATOR,
    );
    expect(result?.status).toBe('success');
    expect(result?.actionId).toBe('ai.auto_reply.disable');
    expect(executor.execute).toHaveBeenCalled();
  });

  it('returns null when agent actions disabled', async () => {
    settings.get.mockResolvedValue({ agentActionsEnabled: false });
    const result = await router.resolve(
      { text: 'Zima AI auto reply', userId: 'u1' },
      ApiKeyRole.OPERATOR,
    );
    expect(result).toBeNull();
  });

  it('requires confirmation for medium-risk actions', async () => {
    const result = await router.executeById(
      'ai.burst_reading.disable',
      { text: 'zima burst reading', userId: 'u1' },
      ApiKeyRole.OPERATOR,
    );
    expect(result.status).toBe('confirmation_required');
    expect(result.confirmationId).toBe('conf-1');
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('returns null when ambiguous match is not refined by LLM', async () => {
    llmMatcher.refine.mockResolvedValue(null);
    const result = await router.resolve(
      { text: 'simamisha auto reply ya ai', userId: 'u1' },
      ApiKeyRole.OPERATOR,
    );
    expect(result).toBeNull();
    expect(llmMatcher.refine).toHaveBeenCalled();
  });

  it('executes when LLM refines ambiguous match to high confidence', async () => {
    llmMatcher.refine.mockResolvedValue({
      actionId: 'ai.auto_reply.disable',
      confidence: 0.9,
      params: {},
    });
    const result = await router.resolve(
      { text: 'simamisha auto reply ya ai', userId: 'u1' },
      ApiKeyRole.OPERATOR,
    );
    expect(result?.status).toBe('success');
    expect(result?.actionId).toBe('ai.auto_reply.disable');
  });

  it('executes after confirmation', async () => {
    executor.execute.mockResolvedValue({
      message: 'Burst reading disabled.',
      data: { oldValue: true, newValue: false },
    });
    const result = await router.confirmAndExecute(
      'conf-1',
      { text: 'zima burst reading', userId: 'u1' },
      ApiKeyRole.OPERATOR,
    );
    expect(result.status).toBe('success');
    expect(confirmations.confirm).toHaveBeenCalledWith('conf-1', 'u1', false);
    expect(executor.execute).toHaveBeenCalled();
  });
});
