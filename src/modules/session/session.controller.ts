import { Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Request } from 'express';
import { SessionService } from './session.service';
import { MessageService } from '../message/message.service';
import { CreateSessionDto, SessionResponseDto, QRCodeResponseDto } from './dto';
import { Session } from './entities/session.entity';
import { AuditService, AuditContext } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';

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
  async start(@Param('id') id: string, @Req() req: AuthedRequest): Promise<SessionResponseDto> {
    const session = await this.sessionService.start(id);
    await this.auditService.logInfo(
      AuditAction.SESSION_STARTED,
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

  @Get(':id/conversations')
  @ApiOperation({ summary: 'List inbox conversations for a session (from persisted messages)' })
  @ApiParam({ name: 'id', description: 'Session ID' })
  @ApiResponse({ status: 200, description: 'Conversation summaries' })
  async getConversations(@Param('id') id: string) {
    return this.messageService.getConversations(id);
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

  @Get('stats/overview')
  @ApiOperation({
    summary: 'Get session statistics for multi-session monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'Session statistics including counts and memory usage',
  })
  async getStats(): Promise<{
    total: number;
    active: number;
    ready: number;
    disconnected: number;
    byStatus: Record<string, number>;
    memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
  }> {
    return this.sessionService.getStats();
  }
}
