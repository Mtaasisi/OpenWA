import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { SessionService, SessionHealthOverview } from './session.service';
import { MessageService } from '../message/message.service';
import { CreateSessionDto, SessionResponseDto, QRCodeResponseDto } from './dto';
import { UpdateSessionAiAutoReplyDto } from './dto/update-session-ai-auto-reply.dto';
import { UpdateSessionFollowupAutopilotDto } from './dto/update-session-followup-autopilot.dto';
import { UpdateSessionStaffAiDto } from './dto/update-session-staff-ai.dto';
import { UpdateSessionProxyDto } from './dto/update-session-proxy.dto';
import { UpdateSessionEngineDto } from './dto/update-session-engine.dto';
import { StartSessionDto } from './dto/start-session.dto';
import { UpdateSessionLinkingModeDto } from './dto/update-session-linking-mode.dto';
import { Session } from './entities/session.entity';
import { AuditService, AuditContext } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { InboxConversationsQueryDto } from '../message/dto/inbox-conversations-query.dto';

type AuthedRequest = Request & { apiKey?: ApiKey };

@ApiTags('sessions')
@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
    private readonly messageService: MessageService,
  ) {}

  private auditContext(req: AuthedRequest, extra: Partial<AuditContext> = {}): AuditContext {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress || undefined;
    return {
      apiKey: req.apiKey,
      ipAddress: ip,
      ...extra,
    };
  }

  // Transform entity to DTO with lastActive field name
  private transformSession(session: Session): SessionResponseDto {
    const aiAutoReplyEnabled = session.config?.aiAutoReplyEnabled !== false;
    const followupAutopilotEnabled = session.config?.followupAutopilotEnabled === true;
    const staffAiAllowedNumbers = this.sessionService.getStaffAiAllowedNumbers(session);
    const runtime = this.sessionService.getRuntimeExtras(session.id);
    const auth = this.sessionService.getEngineAuthStatus(session);
    return {
      id: session.id,
      name: session.name,
      status: session.status,
      phone: session.phone,
      pushName: session.pushName,
      connectedAt: session.connectedAt,
      lastActive: session.lastActiveAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      aiAutoReplyEnabled,
      followupAutopilotEnabled,
      staffAiAllowedNumbers,
      backgroundSyncing: runtime.backgroundSyncing,
      statusMessage: runtime.statusMessage,
      proxyUrl: session.proxyUrl,
      proxyType: session.proxyType,
      linkingMode: runtime.linkingMode,
      engineType: session.engineType ?? null,
      effectiveEngineType: this.sessionService.resolveEngineType(session),
      engineAuthPresent: auth.engineAuthPresent,
      requiresRelink: auth.requiresRelink,
      relinkReason: auth.relinkReason,
    };
  }

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new WhatsApp session' })
  @ApiResponse({
    status: 201,
    description: 'Session created',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Session name already exists' })
  async create(@Body() dto: CreateSessionDto, @Req() req: AuthedRequest): Promise<Session> {
    const session = await this.sessionService.create(dto);
    await this.auditService.logInfo(
      AuditAction.SESSION_CREATED,
      this.auditContext(req, { sessionId: session.id, sessionName: session.name }),
    );
    return session;
  }

  @Get()
  @ApiOperation({ summary: 'List all sessions' })
  @ApiResponse({
    status: 200,
    description: 'List of sessions',
    type: [SessionResponseDto],
  })
  async findAll(): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionService.findAll();
    return sessions.map(s => this.transformSession(s));
  }

  @Get('stats/overview')
  @ApiOperation({
    summary: 'Get session statistics for multi-session monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'Session statistics including counts, memory usage, and health overview',
  })
  async getStats(): Promise<{
    total: number;
    active: number;
    ready: number;
    disconnected: number;
    byStatus: Record<string, number>;
    memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
    health?: SessionHealthOverview[];
  }> {
    return this.sessionService.getStats();
  }

  @Get('health/overview')
  @ApiOperation({ summary: 'Per-session engine health for ops monitoring' })
  @ApiResponse({ status: 200, description: 'Linked session health entries' })
  async getHealthOverview(): Promise<SessionHealthOverview[]> {
    return this.sessionService.getHealthOverview();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session by ID' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session details',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async findOne(@Param('id') id: string): Promise<SessionResponseDto> {
    const session = await this.sessionService.findOne(id);
    return this.transformSession(session);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 204, description: 'Session deleted' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async delete(@Param('id') id: string, @Req() req: AuthedRequest): Promise<void> {
    const session = await this.sessionService.findOne(id);
    await this.sessionService.delete(id);
    await this.auditService.logInfo(
      AuditAction.SESSION_DELETED,
      this.auditContext(req, { sessionId: id, sessionName: session.name }),
    );
  }

  @Post(':id/start')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Start a session and initialize WhatsApp connection',
  })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session started',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Session already started' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async start(
    @Param('id') id: string,
    @Body() body: StartSessionDto = {},
    @Req() req: AuthedRequest,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionService.start(id, {
      linkingMode: body.linkingMode,
    });
    await this.auditService.logInfo(
      AuditAction.SESSION_STARTED,
      this.auditContext(req, { sessionId: session.id, sessionName: session.name }),
    );
    return this.transformSession(session);
  }

  @Patch(':id/linking-mode')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Enable or disable linking mode (pauses auto-recovery during QR scan)',
  })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async setLinkingMode(
    @Param('id') id: string,
    @Body() body: UpdateSessionLinkingModeDto,
  ): Promise<SessionResponseDto> {
    await this.sessionService.findOne(id);
    this.sessionService.setLinkingMode(id, body.linkingMode);
    const session = await this.sessionService.findOne(id);
    return this.transformSession(session);
  }

  @Patch(':id/ai-auto-reply')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Enable or disable AI auto-reply for this session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async setAiAutoReply(
    @Param('id') id: string,
    @Body() body: UpdateSessionAiAutoReplyDto,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionService.setAiAutoReplyEnabled(id, body.enabled);
    return this.transformSession(session);
  }

  @Patch(':id/followup-autopilot')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Enable or disable follow-up autopilot for this session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  async setFollowupAutopilot(
    @Param('id') id: string,
    @Body() body: UpdateSessionFollowupAutopilotDto,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionService.setFollowupAutopilotEnabled(
      id,
      body.followupAutopilotEnabled,
    );
    return this.transformSession(session);
  }

  @Patch(':id/staff-ai-numbers')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({
    summary: 'Phone numbers that can message this WhatsApp line to use dashboard CRM AI',
  })
  async setStaffAiNumbers(
    @Param('id') id: string,
    @Body() body: UpdateSessionStaffAiDto,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionService.setStaffAiAllowedNumbers(
      id,
      body.staffAiAllowedNumbers,
    );
    return this.transformSession(session);
  }

  @Patch(':id/engine')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Set per-session WhatsApp engine override' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Engine override updated', type: SessionResponseDto })
  async setEngine(
    @Param('id') id: string,
    @Body() body: UpdateSessionEngineDto,
    @Req() req: AuthedRequest,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionService.updateEngineType(id, body.engineType);
    await this.auditService.logInfo(
      AuditAction.SESSION_ENGINE_UPDATED,
      this.auditContext(req, {
        sessionId: session.id,
        sessionName: session.name,
        metadata: { engineType: session.engineType },
      }),
    );
    return this.transformSession(session);
  }

  @Patch(':id/proxy')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update SOCKS/HTTP proxy for a session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Proxy updated', type: SessionResponseDto })
  async setProxy(
    @Param('id') id: string,
    @Body() body: UpdateSessionProxyDto,
    @Req() req: AuthedRequest,
  ): Promise<SessionResponseDto> {
    const session = await this.sessionService.updateProxy(id, body);
    await this.auditService.logInfo(
      AuditAction.SESSION_PROXY_UPDATED,
      this.auditContext(req, { sessionId: session.id, sessionName: session.name }),
    );
    return this.transformSession(session);
  }

  @Post(':id/stop')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Stop a session and disconnect WhatsApp' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session stopped',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async stop(@Param('id') id: string, @Req() req: AuthedRequest): Promise<SessionResponseDto> {
    const session = await this.sessionService.stop(id);
    await this.auditService.logInfo(
      AuditAction.SESSION_STOPPED,
      this.auditContext(req, { sessionId: session.id, sessionName: session.name }),
    );
    return this.transformSession(session);
  }

  @Post(':id/restart')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Soft restart a linked session (refresh connection without new QR scan)',
  })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'Session restart initiated',
    type: SessionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Session not linked or invalid state' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async restart(@Param('id') id: string, @Req() req: AuthedRequest): Promise<SessionResponseDto> {
    const session = await this.sessionService.restart(id);
    await this.auditService.logInfo(
      AuditAction.SESSION_RESTARTED,
      this.auditContext(req, { sessionId: session.id, sessionName: session.name }),
    );
    return this.transformSession(session);
  }

  @Post(':id/relink')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({
    summary: 'Clear engine auth and disconnect (scan QR again to link)',
  })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Auth cleared; session disconnected', type: SessionResponseDto })
  async relink(@Param('id') id: string, @Req() req: AuthedRequest): Promise<SessionResponseDto> {
    const session = await this.sessionService.relink(id);
    await this.auditService.logInfo(
      AuditAction.SESSION_DISCONNECTED,
      this.auditContext(req, {
        sessionId: session.id,
        sessionName: session.name,
        metadata: { relink: true },
      }),
    );
    return this.transformSession(session);
  }

  @Get(':id/conversations')
  @ApiOperation({ summary: 'List inbox conversations for a session (unified inbox service)' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Conversation summaries' })
  async getConversations(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Query() query: InboxConversationsQueryDto,
  ) {
    const allowed =
      req.apiKey?.allowedSessions && req.apiKey.allowedSessions.length > 0
        ? req.apiKey.allowedSessions
        : undefined;
    return this.messageService.queryUnifiedConversations(
      { ...query, sessionId: id },
      {
        allowedSessionIds: allowed,
        apiKeyId: req.apiKey?.id ?? '',
        role: req.apiKey?.role ?? ApiKeyRole.ADMIN,
      },
    );
  }

  @Patch(':id/conversations/:chatId/read')
  @RequireRole(ApiKeyRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a conversation as read (dashboard + WhatsApp sendSeen)' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiParam({ name: 'chatId', description: 'URL-encoded WhatsApp chat ID' })
  @ApiResponse({ status: 200, description: 'Conversation marked read' })
  async markConversationRead(@Param('id') id: string, @Param('chatId') chatId: string) {
    await this.messageService.markConversationRead(id, decodeURIComponent(chatId));
    return { ok: true };
  }

  @Get(':id/chats')
  @ApiOperation({ summary: 'List WhatsApp chats for a session (requires active engine)' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Chat list from WhatsApp client' })
  @ApiResponse({ status: 400, description: 'Session not started' })
  async getChats(@Param('id') id: string) {
    return this.sessionService.listChats(id);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Get QR code for session authentication' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'QR code data',
    type: QRCodeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'QR code not ready or session already authenticated',
  })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getQRCode(@Param('id') id: string): Promise<QRCodeResponseDto> {
    return this.sessionService.getQRCode(id);
  }

  @Get(':id/groups')
  @ApiOperation({ summary: 'Get all groups for a session' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({
    status: 200,
    description: 'List of groups the session is a member of',
  })
  @ApiResponse({ status: 400, description: 'Session not ready' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getGroups(@Param('id') id: string): Promise<{ id: string; name: string }[]> {
    return this.sessionService.getGroups(id);
  }
}
