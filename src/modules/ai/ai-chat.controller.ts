import { Controller, Get, Post, Delete, Body, Param, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import { AiChatConversationsService } from './ai-chat-conversations.service';
import { AiAppToolsService } from './ai-app-tools';
import { AiChatBodyDto } from './dto/ai.dto';
import { AiAuditService } from './ai-audit.service';
import { CurrentApiKey, CurrentUser } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { User } from '../auth/entities/user.entity';
import { AgentActionRouterService } from '../agent-actions/agent-action-router.service';
import type { AgentActionResult } from '../agent-actions/agent-action.types';
import { AiUsageFeature, AiUsageSource } from './cost/ai-cost.types';

export interface AiChatResponse {
  content: string;
  actions: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  provider: string;
  model: string;
  latencyMs: number;
  agentAction?: AgentActionResult;
  skippedLlm?: boolean;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiChatController {
  constructor(
    private readonly chatService: AiChatService,
    private readonly convService: AiChatConversationsService,
    private readonly appTools: AiAppToolsService,
    private readonly aiAudit: AiAuditService,
    @Optional() private readonly agentRouter?: AgentActionRouterService,
  ) {}

  @Get('tools')
  @ApiOperation({ summary: 'List AI assistant tools' })
  listTools(@CurrentApiKey() apiKey?: ApiKey) {
    const role = apiKey?.role ?? ApiKeyRole.OPERATOR;
    return this.appTools.getToolDefinitionsForRole(role);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI about your OpenWA instance' })
  async chat(
    @Body() body: AiChatBodyDto,
    @CurrentApiKey() apiKey?: ApiKey,
    @CurrentUser() user?: User,
  ): Promise<AiChatResponse> {
    const role = apiKey?.role ?? ApiKeyRole.OPERATOR;
    const last = body.messages[body.messages.length - 1];

    if (body.conversationId && last?.role === 'user') {
      await this.convService.addMessage(body.conversationId, {
        role: 'user',
        content: last.content,
      });
    }

    if (last?.role === 'user' && last.content?.trim() && this.agentRouter) {
      const agentResult = await this.agentRouter.resolve(
        {
          userId: user?.id ?? apiKey?.id ?? 'unknown',
          userRole: user?.role ?? apiKey?.role ?? ApiKeyRole.VIEWER,
          text: last.content,
          currentPage: body.currentPage,
          currentChatId: body.currentChatId,
          currentCustomerId: body.currentCustomerId,
          branchId: body.branchId,
          apiKeyId: apiKey?.id,
        },
        role,
      );

      if (agentResult) {
        const response: AiChatResponse = {
          content: agentResult.message,
          actions: [],
          provider: 'agent-action',
          model: agentResult.actionId,
          latencyMs: 0,
          agentAction: agentResult,
          skippedLlm: true,
        };

        if (body.conversationId) {
          await this.convService.addMessage(body.conversationId, {
            role: 'assistant',
            content: agentResult.message,
            agentAction: agentResult,
            provider: 'agent-action',
            model: agentResult.actionId,
            latencyMs: 0,
          });
        }

        return response;
      }
    }

    const result = await this.chatService.chat(
      body.messages,
      role,
      {
        userId: user?.id ?? apiKey?.id,
        apiKeyId: apiKey?.id,
      },
      {
        feature: AiUsageFeature.ADMIN_ASSISTANT,
        source: AiUsageSource.ADMIN_MANUAL,
        branchId: body.branchId,
        conversationId: body.currentChatId,
        customerId: body.currentCustomerId,
        adminOverrideBudget: role === ApiKeyRole.ADMIN,
      },
    );

    for (const action of result.actions ?? []) {
      this.aiAudit.logToolCall('*', 'dashboard', action.tool, action.args);
    }
    this.aiAudit.logAiReply('*', 'dashboard', {
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      source: 'staff_chat',
    });

    if (body.conversationId) {
      await this.convService.addMessage(body.conversationId, {
        role: 'assistant',
        content: result.content,
        toolCalls: result.actions,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
      });
    }

    return result;
  }
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai/conversations')
export class AiChatConversationsController {
  constructor(private readonly convService: AiChatConversationsService) {}

  @Get()
  list() {
    return this.convService.listConversations();
  }

  @Post()
  create() {
    return this.convService.createConversation();
  }

  @Get(':id/messages')
  messages(@Param('id') id: string) {
    return this.convService.listMessages(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.convService.deleteConversation(id);
  }
}
