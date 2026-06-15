import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { AuthSessionService } from '../auth/auth-session.service';
import { API_KEY_RAW_PREFIX } from '../auth/entities/api-key.entity';
import type {
  WSClientMessage,
  WSSubscribeRequest,
  WSUnsubscribeRequest,
  WSSubscribedResponse,
  WSUnsubscribedResponse,
  WSEventMessage,
  WSErrorResponse,
  WSPongResponse,
} from './dto/ws-messages.dto';
import { SUBSCRIBABLE_EVENTS, buildRoomName } from './dto/ws-messages.dto';

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/events',
  transports: ['polling', 'websocket'],
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('EventsGateway');

  constructor(
    private readonly authService: AuthService,
    private readonly authSession: AuthSessionService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const auth = client.handshake.auth as { apiKey?: string; token?: string } | undefined;
    const headerKey = client.handshake.headers['x-api-key'] as string | undefined;
    const queryKey = client.handshake.query.apiKey as string | undefined;
    const queryToken = client.handshake.query.token as string | undefined;
    const bearer = this.extractBearer(client.handshake.headers.authorization as string | undefined);

    const credential =
      auth?.token ||
      auth?.apiKey ||
      queryToken ||
      headerKey ||
      queryKey ||
      bearer;

    if (!credential) {
      this.logger.warn(`Client ${client.id} rejected: No credentials provided`);
      client.emit('message', this.createError('UNAUTHORIZED', 'Authentication required'));
      client.disconnect();
      return;
    }

    try {
      let validKey;
      if (credential.startsWith(API_KEY_RAW_PREFIX)) {
        validKey = await this.authService.validateApiKey(credential, undefined, undefined, {
          trackUsage: false,
        });
      } else {
        const identity = await this.authSession.resolveIdentityFromAccessToken(credential);
        validKey = identity.apiKey;
      }

      if (!validKey) {
        this.logger.warn(`Client ${client.id} rejected: Invalid credentials`);
        client.emit('message', this.createError('UNAUTHORIZED', 'Invalid credentials'));
        client.disconnect();
        return;
      }

      (client.data as { apiKey: unknown }).apiKey = validKey;
      this.logger.log(`Client connected: ${client.id} (key: ${validKey.name})`);
    } catch (error) {
      this.logger.warn(`Client ${client.id} rejected: Auth error`, {
        error: error instanceof Error ? error.message : String(error),
      });
      client.emit('message', this.createError('UNAUTHORIZED', 'Authentication failed'));
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private extractBearer(authorization?: string): string | undefined {
    if (authorization?.startsWith('Bearer ')) {
      return authorization.substring(7).trim();
    }
    return undefined;
  }

  @SubscribeMessage('message')
  handleMessage(@ConnectedSocket() client: Socket, @MessageBody() message: WSClientMessage) {
    switch (message.type) {
      case 'subscribe':
        return this.handleSubscribe(client, message);
      case 'unsubscribe':
        return this.handleUnsubscribe(client, message);
      case 'ping':
        return this.handlePing(client, message.requestId);
      default:
        return this.createError(
          'INVALID_MESSAGE',
          `Unknown message type`,
          (message as { requestId?: string }).requestId,
        );
    }
  }

  private handleSubscribe(client: Socket, message: WSSubscribeRequest): WSSubscribedResponse | WSErrorResponse {
    const { sessionId, events, requestId } = message;

    // Validate sessionId
    if (!sessionId || typeof sessionId !== 'string') {
      return this.createError('INVALID_SESSION', 'sessionId is required', requestId);
    }

    // Validate events
    if (!events || !Array.isArray(events) || events.length === 0) {
      return this.createError('INVALID_EVENTS', 'events array is required', requestId);
    }

    // Validate each event type
    const validEvents = events.filter(
      e => e === '*' || SUBSCRIBABLE_EVENTS.includes(e as (typeof SUBSCRIBABLE_EVENTS)[number]),
    );
    if (validEvents.length === 0) {
      return this.createError(
        'INVALID_EVENTS',
        `No valid events. Valid: ${SUBSCRIBABLE_EVENTS.join(', ')}, *`,
        requestId,
      );
    }

    // Join rooms for each session/event combination
    const rooms: string[] = [];
    for (const event of validEvents) {
      const room = buildRoomName(sessionId, event);
      void client.join(room);
      rooms.push(room);
    }

    this.logger.debug(`Client ${client.id} subscribed to: ${rooms.join(', ')}`);

    return {
      type: 'subscribed',
      sessionId,
      events: validEvents,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private handleUnsubscribe(client: Socket, message: WSUnsubscribeRequest): WSUnsubscribedResponse {
    const { sessionId, requestId } = message;

    // Leave all rooms for this session
    const clientRooms = Array.from(client.rooms);
    const sessionPrefix = `session:${sessionId}:`;

    for (const room of clientRooms) {
      if (room.startsWith(sessionPrefix) || (sessionId === '*' && room.startsWith('session:'))) {
        void client.leave(room);
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from session: ${sessionId}`);

    return {
      type: 'unsubscribed',
      sessionId,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private handlePing(_client: Socket, requestId?: string): WSPongResponse {
    return {
      type: 'pong',
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private createError(code: string, message: string, requestId?: string): WSErrorResponse {
    return {
      type: 'error',
      code,
      message,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  // ========== Event Emission Methods (room-based) ==========

  /**
   * Emit event to specific rooms based on sessionId and event type
   */
  private emitToRooms(sessionId: string, event: string, data: unknown): void {
    const eventMessage: WSEventMessage = {
      type: 'event',
      payload: { event, sessionId, data },
      timestamp: new Date().toISOString(),
    };

    // Session lifecycle events (QR, status) must reach all wildcard subscribers.
    const isSessionLifecycle = event === 'session.status' || event === 'session.qr';

    this.server.to(buildRoomName(sessionId, event)).emit('message', eventMessage);
    this.server.to(buildRoomName('*', event)).emit('message', eventMessage);

    if (isSessionLifecycle) {
      this.server.to(buildRoomName(sessionId, '*')).emit('message', eventMessage);
      this.server.to(buildRoomName('*', '*')).emit('message', eventMessage);
    }
  }

  /**
   * Emit session status change
   */
  emitSessionStatus(sessionId: string, status: string, data?: Record<string, unknown>) {
    this.emitToRooms(sessionId, 'session.status', { status, ...data });
  }

  /**
   * Emit QR code update for a session
   */
  emitQRCode(sessionId: string, qrCode: string) {
    this.emitToRooms(sessionId, 'session.qr', { qrCode });
  }

  /**
   * Emit new message notification
   */
  emitMessage(sessionId: string, message: Record<string, unknown>) {
    this.emitToRooms(sessionId, 'message.received', message);
  }

  /**
   * Emit message sent notification
   */
  emitMessageSent(sessionId: string, message: Record<string, unknown>) {
    this.emitToRooms(sessionId, 'message.sent', message);
  }

  /**
   * Emit message acknowledgment
   */
  emitMessageAck(sessionId: string, data: { messageId: string; ack: number; ackName: string }) {
    this.emitToRooms(sessionId, 'message.ack', data);
  }

  /**
   * Emit webhook delivery status (broadcast to all - no session context)
   */
  emitWebhookStatus(webhookId: string, success: boolean, error?: string) {
    // This one broadcasts to all since webhooks don't have session context in the same way
    this.server.emit('webhook:delivery', {
      webhookId,
      success,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /** Follow-up automation alerts (session-scoped or global via sessionId '*') */
  emitFollowupAlert(
    event:
      | 'followup.warning'
      | 'followup.escalated'
      | 'followup.kpi_penalty'
      | 'followup.autopilot_paused'
      | 'followup.autopilot_updated',
    sessionId: string,
    data: Record<string, unknown>,
  ): void {
    this.emitToRooms(sessionId, event, data);
  }

  emitAiTyping(sessionId: string, data: { chatId: string; active: boolean }): void {
    this.emitToRooms(sessionId, 'ai.typing', data);
  }

  emitAiSendQueued(
    sessionId: string,
    data: {
      chatId: string;
      queueItemId: string;
      scheduledAt: string;
      delayMs: number;
    },
  ): void {
    this.emitToRooms(sessionId, 'ai.sendQueued', data);
  }

  emitAiEscalated(sessionId: string, data: { chatId: string; reason?: string }): void {
    this.emitToRooms(sessionId, 'ai.escalated', data);
  }

  emitAiOptOut(sessionId: string, data: { chatId: string; source?: string }): void {
    this.emitToRooms(sessionId, 'ai.opt_out', data);
  }

  emitAiLearningPending(
    sessionId: string,
    data: { itemId: string; chatId: string; question: string; timesAsked?: number },
  ): void {
    this.emitToRooms(sessionId, 'ai.learning.pending', data);
    this.server?.emit('ai.learning.pending', { sessionId, ...data });
  }

  emitAiLearningRepeated(
    sessionId: string,
    data: { itemId: string; question: string; timesAsked: number },
  ): void {
    this.emitToRooms(sessionId, 'ai.learning.repeated', data);
    this.server?.emit('ai.learning.repeated', { sessionId, ...data });
  }

  emitProductDemandSpike(data: {
    productName: string;
    requestCount: number;
    branchId?: string | null;
  }): void {
    this.server?.emit('product.demand.spike', data);
  }

  emitKnowledgeNeedsReview(data: { knowledgeId: string; questionPattern: string }): void {
    this.server?.emit('knowledge.needs_review', data);
  }

  emitInboxChatAssigned(
    sessionId: string,
    data: {
      chatId: string;
      assignedStaffId: string;
      customerName?: string | null;
      customerPhone?: string | null;
    },
  ): void {
    this.emitToRooms(sessionId, 'inbox.chat_assigned', data);
  }

  emitSmsStatusChanged(data: {
    status: 'failed' | 'low_balance' | 'connected';
    error?: string | null;
    balance?: number | null;
  }): void {
    this.emitToRooms('*', 'sms.status_changed', data);
    this.server?.emit('sms.status_changed', data);
  }

  emitStorageWarning(data: { id: string; message: string; severity?: string }): void {
    this.emitToRooms('*', 'storage.warning', data);
    this.server?.emit('storage.warning', data);
  }

  emitSyncFailed(data: { error: string; branchId?: string | null }): void {
    this.emitToRooms('*', 'sync.failed', data);
    this.server?.emit('sync.failed', data);
  }
}
