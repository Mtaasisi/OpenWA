import { Controller, Get, Patch, Body, Req, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { MessageService, ConversationSummary } from './message.service';
import { InboxCrmService } from './inbox-crm.service';
import { UpdateInboxThreadCrmDto, InboxThreadCrmDto } from './dto/inbox-thread-crm.dto';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { RequireRole } from '../auth/decorators/auth.decorators';

type AuthedRequest = Request & { apiKey: ApiKey };

@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
  constructor(
    private readonly messageService: MessageService,
    private readonly inboxCrmService: InboxCrmService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations across all accessible sessions (unified inbox)' })
  @ApiResponse({ status: 200, description: 'Unified conversation list with session labels' })
  getUnifiedConversations(@Req() req: AuthedRequest): Promise<ConversationSummary[]> {
    const allowed =
      req.apiKey?.allowedSessions && req.apiKey.allowedSessions.length > 0
        ? req.apiKey.allowedSessions
        : undefined;
    return this.messageService.getUnifiedConversations(allowed);
  }

  @Patch('conversations/read')
  @RequireRole(ApiKeyRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a conversation as read' })
  @ApiResponse({ status: 200, description: 'Conversation marked read' })
  async markConversationRead(
    @Body() body: { sessionId: string; chatId: string },
  ): Promise<{ ok: boolean }> {
    await this.messageService.markConversationRead(body.sessionId, body.chatId);
    return { ok: true };
  }

  @Get('threads/crm')
  @ApiOperation({ summary: 'Get CRM metadata for a conversation thread' })
  @ApiResponse({ status: 200, description: 'Thread CRM record' })
  getThreadCrm(
    @Query('sessionId') sessionId: string,
    @Query('chatId') chatId: string,
  ): Promise<InboxThreadCrmDto> {
    return this.inboxCrmService.getThreadCrm(sessionId, chatId);
  }

  @Patch('threads/crm')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update CRM metadata for a conversation thread' })
  @ApiResponse({ status: 200, description: 'Updated thread CRM record' })
  updateThreadCrm(
    @Body() body: UpdateInboxThreadCrmDto & { sessionId: string; chatId: string },
  ): Promise<InboxThreadCrmDto> {
    const { sessionId, chatId, ...dto } = body;
    return this.inboxCrmService.upsertThreadCrm(sessionId, chatId, dto);
  }
}
