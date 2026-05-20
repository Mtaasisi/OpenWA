import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionService } from '../session/session.service';
import { SendTextMessageDto, SendMediaMessageDto, MessageResponseDto } from './dto';
import { IncomingMessage, MediaInput } from '../../engine/interfaces/whatsapp-engine.interface';
import { Message, MessageDirection, MessageStatus } from './entities/message.entity';
import { InboxThreadRead } from './entities/inbox-thread-read.entity';
import { HookManager } from '../../core/hooks';
import {
  formatMessagePreview,
  isInboxChat,
  shouldPersistMessage,
} from '../../common/utils/inbox-chat.util';

export interface GetMessagesOptions {
  chatId?: string;
  limit?: number;
  offset?: number;
}

export interface ConversationSummary {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  chatId: string;
  displayName: string;
  lastMessageAt: string;
  lastPreview: string | null;
  lastDirection: MessageDirection;
  messageCount: number;
  unreadCount: number;
  hasUnread: boolean;
}

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message, 'data')
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(InboxThreadRead, 'data')
    private readonly threadReadRepository: Repository<InboxThreadRead>,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly hookManager: HookManager,
  ) {}

  async sendText(sessionId: string, dto: SendTextMessageDto): Promise<MessageResponseDto> {
    if (!isInboxChat(dto.chatId)) {
      throw new BadRequestException(
        'Cannot send to this chat type. Use a personal or group chat, not status/broadcast.',
      );
    }

    // Execute hook before sending - plugins can modify or block
    const { continue: shouldContinue, data: hookData } = await this.hookManager.execute(
      'message:sending',
      { sessionId, input: dto, type: 'text' },
      { sessionId, source: 'MessageService' },
    );

    if (!shouldContinue) {
      throw new BadRequestException('Message sending blocked by plugin');
    }

    // Use potentially modified input
    const finalDto = (hookData as { input: SendTextMessageDto }).input;

    const engine = this.getEngine(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: finalDto.chatId,
      body: finalDto.text,
      type: 'text',
    });

    try {
      const result = await engine.sendTextMessage(finalDto.chatId, finalDto.text);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      // Execute hook after successful send
      await this.hookManager.execute(
        'message:sent',
        { sessionId, result, input: finalDto },
        { sessionId, source: 'MessageService' },
      );

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      // Mark as failed
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);

      // Execute hook on failure
      await this.hookManager.execute(
        'message:failed',
        { sessionId, error: error instanceof Error ? error.message : String(error), input: finalDto },
        { sessionId, source: 'MessageService' },
      );

      throw error;
    }
  }

  async sendImage(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.caption || '',
      type: 'image',
    });

    try {
      const result = await engine.sendImageMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async sendVideo(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.caption || '',
      type: 'video',
    });

    try {
      const result = await engine.sendVideoMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async sendAudio(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      type: 'audio',
    });

    try {
      const result = await engine.sendAudioMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async sendDocument(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.filename || '',
      type: 'document',
    });

    try {
      const result = await engine.sendDocumentMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  /**
   * Get message history for a session
   */
  async getMessages(
    sessionId: string,
    options: GetMessagesOptions = {},
  ): Promise<{ messages: Message[]; total: number }> {
    const { chatId, limit = 50, offset = 0 } = options;

    const query = this.messageRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId })
      .skip(offset)
      .take(limit);

    if (chatId) {
      query.andWhere('message.chatId = :chatId', { chatId });
      query.orderBy('message.timestamp', 'ASC').addOrderBy('message.createdAt', 'ASC');
    } else {
      query.orderBy('message.createdAt', 'DESC');
    }

    const [rows, total] = await query.getManyAndCount();
    const messages = rows.filter(
      m => isInboxChat(m.chatId) && !['notification_template', 'e2e_notification', 'gp2', 'protocol'].includes(m.type),
    );
    return { messages, total: chatId ? messages.length : total };
  }

  /**
   * List conversations aggregated from persisted messages for a session.
   */
  /**
   * All conversations across sessions (unified inbox). Respects optional API key session allow-list.
   */
  async getUnifiedConversations(allowedSessionIds?: string[]): Promise<ConversationSummary[]> {
    const sessions = await this.sessionService.findAll();
    const scoped = allowedSessionIds?.length
      ? sessions.filter(s => allowedSessionIds.includes(s.id))
      : sessions;

    const merged: ConversationSummary[] = [];
    for (const session of scoped) {
      const convs = await this.getConversations(session.id);
      merged.push(...convs);
    }

    return merged
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .slice(0, 100);
  }

  async getConversations(sessionId: string, limit = 50): Promise<ConversationSummary[]> {
    const session = await this.sessionService.findOne(sessionId);

    const rows = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.chatId', 'chatId')
      .addSelect('MAX(message.createdAt)', 'lastMessageAt')
      .addSelect('COUNT(message.id)', 'messageCount')
      .where('message.sessionId = :sessionId', { sessionId })
      .groupBy('message.chatId')
      .orderBy('lastMessageAt', 'DESC')
      .limit(limit * 2)
      .getRawMany<{ chatId: string; lastMessageAt: string; messageCount: string }>();

    const byChatId = new Map<string, ConversationSummary>();

    for (const row of rows) {
      if (!isInboxChat(row.chatId)) continue;

      const latest = await this.messageRepository.findOne({
        where: { sessionId, chatId: row.chatId },
        order: { createdAt: 'DESC' },
      });
      if (!latest) continue;

      const meta = latest.metadata as { chatName?: string } | null;
      const dbUnread = await this.countUnreadIncoming(sessionId, row.chatId);
      byChatId.set(row.chatId, {
        sessionId: session.id,
        sessionName: session.name,
        sessionStatus: session.status,
        chatId: row.chatId,
        displayName: meta?.chatName || this.fallbackChatLabel(row.chatId),
        lastMessageAt: row.lastMessageAt,
        lastPreview: formatMessagePreview(latest.body, latest.type),
        lastDirection: latest.direction,
        messageCount: parseInt(row.messageCount, 10) || 0,
        unreadCount: dbUnread,
        hasUnread: dbUnread > 0,
      });
    }

    // Enrich display names and merge live WhatsApp unread counts when engine is ready
    const engine = this.sessionService.getEngine(sessionId);
    if (engine && byChatId.size > 0) {
      try {
        const chats = await engine.listChats();
        const nameByChatId = new Map(
          chats.filter(c => isInboxChat(c.chatId)).map(c => [c.chatId, c.name]),
        );
        const unreadByChatId = new Map(
          chats.filter(c => isInboxChat(c.chatId)).map(c => [c.chatId, c.unreadCount ?? 0]),
        );
        for (const [chatId, summary] of byChatId) {
          const name = nameByChatId.get(chatId);
          if (name) summary.displayName = name;
          const engineUnread = unreadByChatId.get(chatId) ?? 0;
          summary.unreadCount = Math.max(summary.unreadCount, engineUnread);
          summary.hasUnread = summary.unreadCount > 0;
        }
      } catch {
        // Engine busy — keep metadata names
      }
    }

    return Array.from(byChatId.values())
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
      .slice(0, limit);
  }

  private fallbackChatLabel(chatId: string): string {
    return chatId.replace(/@c\.us$/, '').replace(/@g\.us$/, ' (group)').replace(/@lid$/, '');
  }

  async countUnreadIncoming(sessionId: string, chatId: string): Promise<number> {
    const read = await this.threadReadRepository.findOne({
      where: { sessionId, chatId },
    });

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId })
      .andWhere('message.chatId = :chatId', { chatId })
      .andWhere('message.direction = :direction', { direction: MessageDirection.INCOMING });

    if (read?.lastReadAt) {
      qb.andWhere('message.createdAt > :lastReadAt', { lastReadAt: read.lastReadAt });
    }

    return qb.getCount();
  }

  private async upsertLastReadAt(sessionId: string, chatId: string, lastReadAt: Date): Promise<void> {
    const existing = await this.threadReadRepository.findOne({
      where: { sessionId, chatId },
    });
    if (existing) {
      existing.lastReadAt = lastReadAt;
      await this.threadReadRepository.save(existing);
      return;
    }
    await this.threadReadRepository.save(
      this.threadReadRepository.create({ sessionId, chatId, lastReadAt }),
    );
  }

  /**
   * Mark a conversation read in the dashboard and notify WhatsApp (sendSeen).
   */
  async markConversationRead(sessionId: string, chatId: string): Promise<void> {
    await this.sessionService.findOne(sessionId);
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Cannot mark this chat type as read');
    }

    await this.upsertLastReadAt(sessionId, chatId, new Date());

    const engine = this.sessionService.getEngine(sessionId);
    if (engine) {
      try {
        await engine.markChatRead(chatId);
      } catch {
        // Session may be busy; DB read cursor still applies for inbox UI
      }
    }
  }

  /**
   * Sync read state when unread count changes on the linked WhatsApp client (e.g. read on phone).
   */
  async syncUnreadFromEngine(sessionId: string, chatId: string, unreadCount: number): Promise<void> {
    if (!isInboxChat(chatId)) return;
    if (unreadCount === 0) {
      await this.upsertLastReadAt(sessionId, chatId, new Date());
    }
  }

  /**
   * Persist a message from the WhatsApp engine after hooks (dedup by waMessageId).
   */
  async persistInboundFromEngine(sessionId: string, incoming: IncomingMessage): Promise<Message | null> {
    if (!shouldPersistMessage(incoming)) {
      return null;
    }

    const waMessageId = incoming.id;
    if (waMessageId) {
      const existing = await this.messageRepository.findOne({
        where: { sessionId, waMessageId },
      });
      if (existing) return existing;
    }

    const session = await this.sessionService.findOne(sessionId);
    const metadata = this.sanitizeMessageMetadata(incoming);

    if (incoming.fromMe) {
      const message = this.messageRepository.create({
        sessionId,
        waMessageId,
        chatId: incoming.chatId,
        from: session.phone || 'me',
        to: incoming.chatId,
        body: incoming.body,
        type: incoming.type,
        direction: MessageDirection.OUTGOING,
        timestamp: incoming.timestamp,
        metadata,
        status: MessageStatus.SENT,
      });
      try {
        return await this.messageRepository.save(message);
      } catch {
        if (waMessageId) {
          const existing = await this.messageRepository.findOne({
            where: { sessionId, waMessageId },
          });
          return existing;
        }
        throw new BadRequestException('Failed to persist outgoing message from device');
      }
    }

    return this.saveIncomingMessage(sessionId, {
      waMessageId,
      chatId: incoming.chatId,
      from: incoming.from,
      to: incoming.to,
      body: incoming.body,
      type: incoming.type,
      timestamp: incoming.timestamp,
      metadata,
      status: MessageStatus.DELIVERED,
    });
  }

  /**
   * Update delivery/read status from WhatsApp ack events.
   */
  async updateMessageStatusByWaId(
    sessionId: string,
    waMessageId: string,
    ack: number,
  ): Promise<Message | null> {
    const message = await this.messageRepository.findOne({
      where: { sessionId, waMessageId },
    });
    if (!message || message.direction !== MessageDirection.OUTGOING) {
      return null;
    }

    if (ack >= 3) {
      message.status = MessageStatus.READ;
    } else if (ack >= 2) {
      message.status = MessageStatus.DELIVERED;
    } else if (ack >= 1) {
      message.status = MessageStatus.SENT;
    }

    return this.messageRepository.save(message);
  }

  private sanitizeMessageMetadata(incoming: IncomingMessage): Record<string, unknown> | undefined {
    const ext = incoming as IncomingMessage & { chatName?: string };
    const meta: Record<string, unknown> = {
      isGroup: incoming.isGroup,
      fromMe: incoming.fromMe,
    };
    if (ext.chatName) {
      meta.chatName = ext.chatName;
    }
    if (incoming.quotedMessage) {
      meta.quotedMessage = incoming.quotedMessage;
    }
    if (incoming.media) {
      meta.media = {
        mimetype: incoming.media.mimetype,
        filename: incoming.media.filename,
        hasData: !!incoming.media.data,
      };
    }
    return meta;
  }

  // ========== Phase 3: Extended Messaging ==========

  async sendLocation(
    sessionId: string,
    dto: { chatId: string; latitude: number; longitude: number; description?: string; address?: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: `📍 ${dto.description || 'Location'}`,
      type: 'location',
    });

    try {
      const result = await engine.sendLocationMessage(dto.chatId, {
        latitude: dto.latitude,
        longitude: dto.longitude,
        description: dto.description,
        address: dto.address,
      });

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async sendContact(
    sessionId: string,
    dto: { chatId: string; contactName: string; contactNumber: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: `📇 ${dto.contactName}`,
      type: 'contact',
    });

    try {
      const result = await engine.sendContactMessage(dto.chatId, {
        name: dto.contactName,
        number: dto.contactNumber,
      });

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async sendSticker(sessionId: string, dto: SendMediaMessageDto): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);
    const media = this.buildMediaInput(dto);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      type: 'sticker',
    });

    try {
      const result = await engine.sendStickerMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async reply(
    sessionId: string,
    dto: { chatId: string; quotedMessageId: string; text: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.text,
      type: 'text',
    });

    try {
      const result = await engine.replyToMessage(dto.chatId, dto.quotedMessageId, dto.text);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  async forward(
    sessionId: string,
    dto: { fromChatId: string; toChatId: string; messageId: string },
  ): Promise<MessageResponseDto> {
    const engine = this.getEngine(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.toChatId,
      body: '[Forwarded]',
      type: 'forward',
    });

    try {
      const result = await engine.forwardMessage(dto.fromChatId, dto.toChatId, dto.messageId);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      throw error;
    }
  }

  /**
   * Save incoming message (called from session webhook dispatch)
   */
  async saveIncomingMessage(sessionId: string, data: Partial<Message>): Promise<Message> {
    const message = this.messageRepository.create({
      ...data,
      sessionId,
      direction: MessageDirection.INCOMING,
    });
    return this.messageRepository.save(message);
  }

  /**
   * Save outgoing message to database.
   * When called before sending, creates a record with PENDING status.
   */
  private async saveOutgoingMessage(
    sessionId: string,
    data: {
      waMessageId?: string;
      chatId: string;
      body?: string;
      type: string;
      timestamp?: number;
      status?: MessageStatus;
    },
  ): Promise<Message> {
    const session = await this.sessionService.findOne(sessionId);
    const message = this.messageRepository.create({
      sessionId,
      waMessageId: data.waMessageId,
      chatId: data.chatId,
      from: session?.phone || 'me',
      to: data.chatId,
      body: data.body,
      type: data.type,
      direction: MessageDirection.OUTGOING,
      timestamp: data.timestamp,
      status: data.status ?? MessageStatus.PENDING,
    });
    return this.messageRepository.save(message);
  }

  // ========== Phase 3: Reactions ==========

  async reactToMessage(sessionId: string, dto: { chatId: string; messageId: string; emoji: string }): Promise<void> {
    const engine = this.getEngine(sessionId);
    await engine.reactToMessage(dto.chatId, dto.messageId, dto.emoji);
  }

  async getMessageReactions(sessionId: string, chatId: string, messageId: string) {
    const engine = this.getEngine(sessionId);
    return engine.getMessageReactions(chatId, messageId);
  }

  // ========== Delete Message ==========

  async deleteMessage(
    sessionId: string,
    dto: { chatId: string; messageId: string; forEveryone?: boolean },
  ): Promise<void> {
    const engine = this.getEngine(sessionId);
    await engine.deleteMessage(dto.chatId, dto.messageId, dto.forEveryone ?? true);
  }

  private getEngine(sessionId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new BadRequestException(`Session '${sessionId}' is not active. Start the session first.`);
    }
    return engine;
  }

  private buildMediaInput(dto: SendMediaMessageDto): MediaInput {
    if (!dto.url && !dto.base64) {
      throw new BadRequestException('Either url or base64 must be provided');
    }

    if (dto.base64 && !dto.mimetype) {
      throw new BadRequestException('mimetype is required when using base64 data');
    }

    return {
      mimetype: dto.mimetype || 'application/octet-stream',
      data: dto.url || dto.base64!,
      filename: dto.filename,
      caption: dto.caption,
    };
  }
}
