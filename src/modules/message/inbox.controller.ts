import {
  Controller,
  Get,
  Patch,
  Put,
  Post,
  Body,
  Req,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  Delete,
  ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { MessageService } from './message.service';
import { InboxCrmService } from './inbox-crm.service';
import { InboxTransferService } from './inbox-transfer.service';
import { InboxSendPipelineService } from './inbox-send-pipeline.service';
import { InboxAiDiagnosisService } from './inbox-ai-diagnosis.service';
import { InboxComposeSuggestionsService } from './inbox-compose-suggestions.service';
import { InboxThreadEventService } from './inbox-thread-event.service';
import { InboxThreadPinService } from './inbox-thread-pin.service';
import { InboxSavedViewService } from './inbox-saved-view.service';
import { UpdateInboxThreadCrmDto, InboxThreadCrmDto } from './dto/inbox-thread-crm.dto';
import { InboxConversationsQueryDto, UnifiedConversationsResult } from './dto/inbox-conversations-query.dto';
import { InboxMessagesSearchQueryDto } from './dto/inbox-messages-search-query.dto';
import { InboxSendTextDto } from './dto/inbox-send-text.dto';
import { InboxSendMediaDto } from './dto/inbox-send-media.dto';
import { InboxTransferDto } from './dto/inbox-transfer.dto';
import { SendMediaMessageDto, MessageResponseDto } from './dto';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';

type AuthedRequest = Request & { apiKey: ApiKey };

@ApiTags('inbox')
@Controller('inbox')
export class InboxController {
  constructor(
    private readonly messageService: MessageService,
    private readonly inboxCrmService: InboxCrmService,
    private readonly inboxTransferService: InboxTransferService,
    private readonly sendPipeline: InboxSendPipelineService,
    private readonly aiDiagnosis: InboxAiDiagnosisService,
    private readonly composeSuggestions: InboxComposeSuggestionsService,
    private readonly threadEvents: InboxThreadEventService,
    private readonly threadPins: InboxThreadPinService,
    private readonly savedViews: InboxSavedViewService,
  ) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations across all accessible sessions (unified inbox)' })
  @ApiResponse({ status: 200, description: 'Unified conversation list with session labels' })
  getUnifiedConversations(
    @Req() req: AuthedRequest,
    @Query() query: InboxConversationsQueryDto,
  ): Promise<UnifiedConversationsResult> {
    const allowed =
      req.apiKey?.allowedSessions && req.apiKey.allowedSessions.length > 0
        ? req.apiKey.allowedSessions
        : undefined;
    return this.messageService.queryUnifiedConversations(query, {
      allowedSessionIds: allowed,
      apiKeyId: req.apiKey.id,
      role: req.apiKey.role,
    });
  }

  @Get('conversations/queue-counts')
  @ApiOperation({ summary: 'Cached work-queue counts for inbox filters (separate from list fetch)' })
  getQueueCounts(@Req() req: AuthedRequest, @Query() query: InboxConversationsQueryDto) {
    const allowed =
      req.apiKey?.allowedSessions && req.apiKey.allowedSessions.length > 0
        ? req.apiKey.allowedSessions
        : undefined;
    return this.messageService.queryInboxQueueCounts(query, {
      allowedSessionIds: allowed,
      apiKeyId: req.apiKey.id,
      role: req.apiKey.role,
    });
  }

  @Get('threads/search')
  @ApiOperation({ summary: 'Search inbox threads by name, phone, or preview (large-account discovery)' })
  searchThreads(
    @Req() req: AuthedRequest,
    @Query('q') q: string,
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
  ) {
    const allowed =
      req.apiKey?.allowedSessions && req.apiKey.allowedSessions.length > 0
        ? req.apiKey.allowedSessions
        : undefined;
    return this.messageService.searchInboxThreads(
      { q: q ?? '', sessionId, limit: limit ? parseInt(limit, 10) : undefined },
      {
        allowedSessionIds: allowed,
        apiKeyId: req.apiKey.id,
        role: req.apiKey.role,
      },
    );
  }

  @Get('messages/search')
  @ApiOperation({ summary: 'Search message text across inbox chats and groups' })
  searchMessages(@Req() req: AuthedRequest, @Query() query: InboxMessagesSearchQueryDto) {
    const allowed =
      req.apiKey?.allowedSessions && req.apiKey.allowedSessions.length > 0
        ? req.apiKey.allowedSessions
        : undefined;
    return this.messageService.searchInboxMessages({
      query: query.q,
      sessionId: query.sessionId,
      chatId: query.chatId,
      groupsOnly: query.groupsOnly,
      mediaOnly: query.mediaOnly,
      allowedSessionIds: allowed,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Post('send-text')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a text message through a specific inbox session' })
  async sendText(@CurrentApiKey() apiKey: ApiKey, @Body() dto: InboxSendTextDto) {
    const result = await this.sendPipeline.send({
      apiKey,
      sessionId: dto.sessionId,
      chatId: dto.chatId,
      kind: 'text',
      text: dto.text,
      quotedMessageId: dto.quotedMessageId,
      source: 'inbox-manual',
    });
    if ('ok' in result && result.ok === false) {
      throw new ConflictException(result);
    }
    return result;
  }

  @Post('send-image')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an image through a specific inbox session' })
  sendImage(@CurrentApiKey() apiKey: ApiKey, @Body() dto: InboxSendMediaDto) {
    return this.dispatchInboxMedia(apiKey, dto, 'image');
  }

  @Post('send-video')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a video through a specific inbox session' })
  sendVideo(@CurrentApiKey() apiKey: ApiKey, @Body() dto: InboxSendMediaDto) {
    return this.dispatchInboxMedia(apiKey, dto, 'video');
  }

  @Post('send-document')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a document through a specific inbox session' })
  sendDocument(@CurrentApiKey() apiKey: ApiKey, @Body() dto: InboxSendMediaDto) {
    return this.dispatchInboxMedia(apiKey, dto, 'document');
  }

  @Post('send-audio')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an audio message through a specific inbox session' })
  sendAudio(@CurrentApiKey() apiKey: ApiKey, @Body() dto: InboxSendMediaDto) {
    return this.dispatchInboxMedia(apiKey, dto, 'audio');
  }

  @Get('ai-diagnosis')
  @ApiOperation({ summary: 'Diagnose why AI did or did not reply for a chat' })
  getAiDiagnosis(
    @Query('sessionId') sessionId: string,
    @Query('chatId') chatId: string,
  ) {
    return this.aiDiagnosis.diagnose(sessionId, chatId);
  }

  @Get('threads/compose-suggestions')
  @ApiOperation({ summary: 'Contextual AI reply suggestions for the inbox composer' })
  getComposeSuggestions(
    @Query('sessionId') sessionId: string,
    @Query('chatId') chatId: string,
  ) {
    return this.composeSuggestions.suggest(sessionId, chatId);
  }

  @Get('threads/events')
  @ApiOperation({ summary: 'List business/system events for a conversation thread' })
  getThreadEvents(
    @Query('sessionId') sessionId: string,
    @Query('chatId') chatId: string,
    @Query('limit') limit?: string,
  ) {
    return this.threadEvents.listForThread(sessionId, chatId, limit ? Number(limit) : 50);
  }

  @Get('pins')
  @ApiOperation({ summary: 'List pinned inbox threads for the current staff member' })
  listPins(@CurrentApiKey() apiKey: ApiKey) {
    return this.threadPins.listForStaff(apiKey.id);
  }

  @Patch('pins/toggle')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin or unpin an inbox thread for the current staff member' })
  togglePin(
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: { sessionId: string; chatId: string; label?: string | null },
  ) {
    return this.threadPins.toggle(apiKey.id, body.sessionId, body.chatId, body.label);
  }

  @Put('pins')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace all pinned inbox threads for the current staff member' })
  replacePins(
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: { pins: Array<{ sessionId: string; chatId: string; label?: string | null }> },
  ) {
    return this.threadPins.replaceAll(apiKey.id, body.pins ?? []);
  }

  @Get('saved-views')
  @ApiOperation({ summary: 'List saved inbox filter views for the current staff member' })
  listSavedViews(@CurrentApiKey() apiKey: ApiKey) {
    return this.savedViews.listForStaff(apiKey.id);
  }

  @Post('saved-views')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save the current inbox filter configuration as a named view' })
  createSavedView(
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: { name: string; config: Record<string, unknown> },
  ) {
    return this.savedViews.create(apiKey.id, body.name, body.config as never);
  }

  @Patch('saved-views/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a saved inbox filter view' })
  updateSavedView(
    @CurrentApiKey() apiKey: ApiKey,
    @Param('id') id: string,
    @Body() body: { name?: string; config?: Record<string, unknown> },
  ) {
    return this.savedViews.update(apiKey.id, id, {
      name: body.name,
      config: body.config as never,
    });
  }

  @Delete('saved-views/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a saved inbox filter view' })
  async deleteSavedView(@CurrentApiKey() apiKey: ApiKey, @Param('id') id: string): Promise<void> {
    await this.savedViews.remove(apiKey.id, id);
  }

  private async dispatchInboxMedia(
    apiKey: ApiKey,
    dto: InboxSendMediaDto,
    kind: 'image' | 'video' | 'document' | 'audio',
  ): Promise<MessageResponseDto> {
    const { sessionId, ...mediaDto } = dto;
    const result = await this.sendPipeline.send({
      apiKey,
      sessionId,
      chatId: dto.chatId,
      kind,
      media: mediaDto as SendMediaMessageDto,
      quotedMessageId: dto.quotedMessageId,
      source: `inbox-${kind}`,
    });
    if ('ok' in result && result.ok === false) {
      throw new ConflictException(result);
    }
    return result as MessageResponseDto;
  }

  @Patch('conversations/transfer')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer a conversation to another WhatsApp account' })
  transferConversation(@CurrentApiKey() apiKey: ApiKey, @Body() dto: InboxTransferDto) {
    return this.inboxTransferService.transferChat(apiKey, dto);
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
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: UpdateInboxThreadCrmDto & { sessionId: string; chatId: string },
  ): Promise<InboxThreadCrmDto> {
    const { sessionId, chatId, ...dto } = body;
    return this.inboxCrmService.upsertThreadCrm(sessionId, chatId, dto, apiKey.id);
  }

  @Patch('threads/crm/ai-takeover')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff takes over chat from AI' })
  takeOverFromAi(
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: { sessionId: string; chatId: string },
  ): Promise<InboxThreadCrmDto> {
    return this.inboxCrmService.takeOverFromAi(body.sessionId, body.chatId).then(async crm => {
      await this.threadEvents.record({
        sessionId: body.sessionId,
        chatId: body.chatId,
        eventType: 'human_took_over',
        actorType: 'staff',
        actorId: apiKey.id,
        actorName: apiKey.name,
        summary: 'Staff took over from AI',
      });
      return crm;
    });
  }

  @Patch('threads/crm/ai-resume')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume AI auto-reply for chat' })
  resumeAi(
    @CurrentApiKey() apiKey: ApiKey,
    @Body() body: { sessionId: string; chatId: string },
  ): Promise<InboxThreadCrmDto> {
    return this.inboxCrmService.resumeAi(body.sessionId, body.chatId).then(async crm => {
      await this.threadEvents.record({
        sessionId: body.sessionId,
        chatId: body.chatId,
        eventType: 'ai_resumed',
        actorType: 'staff',
        actorId: apiKey.id,
        actorName: apiKey.name,
        summary: 'AI auto-reply resumed',
      });
      return crm;
    });
  }

  @Post('messages/:messageId/retry')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed inbox message' })
  retryMessage(@CurrentApiKey() apiKey: ApiKey, @Param('messageId') messageId: string) {
    return this.messageService.retryFailedInboxMessage(apiKey, messageId);
  }

  @Post('messages/:messageId/resend')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit and resend a failed inbox message' })
  resendMessage(
    @CurrentApiKey() apiKey: ApiKey,
    @Param('messageId') messageId: string,
    @Body() body: { text: string },
  ) {
    return this.messageService.resendFailedInboxMessage(apiKey, messageId, body.text);
  }
}
