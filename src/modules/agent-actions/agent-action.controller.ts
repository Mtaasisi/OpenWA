import { Body, Controller, Get, Post, Query, Inject, forwardRef } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AgentActionRouterService } from './agent-action-router.service';
import { AgentActionRegistryService } from './agent-action-registry.service';
import { AgentActionAuditService } from './agent-action-audit.service';
import { AgentActionConfirmationService } from './agent-action-confirmation.service';
import { AgentActionSettingsService } from './agent-action-settings.service';
import {
  AgentActionConfirmDto,
  AgentActionExecuteDto,
  AgentActionResolveDto,
} from './dto/agent-action.dto';
import { CurrentApiKey, CurrentUser, RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { User } from '../auth/entities/user.entity';
import type { AgentActionRequest, AgentActionResult } from './agent-action.types';
import { AiChatConversationsService } from '../ai/ai-chat-conversations.service';

@ApiTags('agent-actions')
@ApiBearerAuth()
@Controller('agent-actions')
export class AgentActionController {
  constructor(
    private readonly router: AgentActionRouterService,
    private readonly registry: AgentActionRegistryService,
    private readonly audit: AgentActionAuditService,
    private readonly confirmations: AgentActionConfirmationService,
    private readonly settings: AgentActionSettingsService,
    @Inject(forwardRef(() => AiChatConversationsService))
    private readonly convService: AiChatConversationsService,
  ) {}

  @Post('resolve')
  @ApiOperation({ summary: 'Resolve natural language to agent action' })
  async resolve(
    @Body() body: AgentActionResolveDto,
    @CurrentApiKey() apiKey?: ApiKey,
    @CurrentUser() user?: User,
  ) {
    const role = apiKey?.role ?? ApiKeyRole.OPERATOR;
    const request = this.buildRequest(body, user, apiKey);
    const result = await this.router.resolve(request, role);
    return result ?? { matched: false };
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute explicit agent action' })
  async execute(
    @Body() body: AgentActionExecuteDto,
    @CurrentApiKey() apiKey?: ApiKey,
    @CurrentUser() user?: User,
  ) {
    const role = apiKey?.role ?? ApiKeyRole.OPERATOR;
    const request = this.buildRequest(body, user, apiKey);
    return this.router.executeById(body.actionId, request, role);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Confirm risky agent action' })
  async confirm(
    @Body() body: AgentActionConfirmDto,
    @CurrentApiKey() apiKey?: ApiKey,
    @CurrentUser() user?: User,
  ): Promise<AgentActionResult> {
    const role = apiKey?.role ?? ApiKeyRole.OPERATOR;
    const request = this.buildRequest({}, user, apiKey);
    const result = await this.router.confirmAndExecute(body.confirmationId, request, role);
    if (body.conversationId) {
      await this.convService.addMessage(body.conversationId, {
        role: 'assistant',
        content: result.message,
        agentAction: result as unknown as Record<string, unknown>,
        provider: 'agent-action',
        model: result.actionId,
        latencyMs: 0,
      });
    }
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List available agent actions' })
  async list(
    @CurrentApiKey() apiKey?: ApiKey,
    @CurrentUser() user?: User,
    @Query('pending') pending?: string,
  ) {
    const role = apiKey?.role ?? ApiKeyRole.OPERATOR;
    const actions = this.registry.listForRole(role).map(a => ({
      id: a.id,
      title: a.title,
      category: a.category,
      risk: a.risk,
      supportsDirectExecution: a.supportsDirectExecution,
    }));
    const cfg = await this.settings.get();
    const pendingConfirmations =
      pending === 'true' && user
        ? await this.confirmations.getPendingForUser(user.id)
        : [];
    return { actions, settings: cfg, pendingConfirmations, pendingCount: pendingConfirmations.length };
  }

  @Get('audit')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'List recent agent action audit logs' })
  auditLogs(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.audit.listRecent(Number.isFinite(n) ? n : 50);
  }

  private buildRequest(
    body: Partial<AgentActionResolveDto & AgentActionExecuteDto>,
    user?: User,
    apiKey?: ApiKey,
  ): AgentActionRequest {
    return {
      userId: user?.id ?? apiKey?.id ?? 'unknown',
      userRole: user?.role ?? apiKey?.role ?? ApiKeyRole.VIEWER,
      text: body.text ?? '',
      currentPage: body.currentPage,
      currentChatId: body.currentChatId,
      currentCustomerId: body.currentCustomerId,
      branchId: body.branchId,
      params: body.params,
      apiKeyId: apiKey?.id,
    };
  }
}
