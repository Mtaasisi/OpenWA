import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef, Logger } from '@nestjs/common';
import { rethrowWhatsAppSendError } from '../../common/utils/whatsapp-send-error.util';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session/session.service';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { InboxCrmService } from './inbox-crm.service';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { FollowupInboxEnrichment } from '../followup/followup-inbox-enrichment.types';
import { AuthService } from '../auth/auth.service';
import { ProfilePictureCacheService } from '../contact/profile-picture-cache.service';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { InboxThreadCrm } from './entities/inbox-thread-crm.entity';
import {
  InboxConversationsQueryDto,
  InboxConversationSort,
  InboxConversationStatusFilter,
  InboxQueryContext,
  UnifiedConversationsResult,
  InboxQueueCountsResult,
  InboxThreadSearchResult,
} from './dto/inbox-conversations-query.dto';
import { assertApiKeySessionAccess } from '../../common/utils/api-key-session.util';
import { resolveThreadSearchMatchReason } from './utils/inbox-search-match.util';
import { ApiKey } from '../auth/entities/api-key.entity';
import { SendTextMessageDto, SendMediaMessageDto, MessageResponseDto } from './dto';
import {
  IncomingMessage,
  IWhatsAppEngine,
  MediaInput,
  ChatSummary,
} from '../../engine/interfaces/whatsapp-engine.interface';
import { Message, MessageDirection, MessageStatus } from './entities/message.entity';
import { InboxThreadRead } from './entities/inbox-thread-read.entity';
import { InboxThreadSummaryService } from './inbox-thread-summary.service';
import { InboxThreadStateService } from './inbox-thread-state.service';
import { buildNextCursor } from './inbox-cursor.util';
import { readLargeAccountDefaults, resolveThreadStorageTier } from './large-account.util';
import { resolveInboxViewerStaffId } from './inbox-viewer-staff.util';
import type { InboxThreadState, InboxWorkQueue, InboxQueueCounts } from './inbox-thread-state.types';
import { InboxThreadSummary } from './entities/inbox-thread-summary.entity';
import { HookManager } from '../../core/hooks';
import { StorageService } from '../../common/storage/storage.service';
import {
  formatMessagePreview,
  isInboxChat,
  shouldPersistMessage,
  isMediaMessageType,
  normalizeMessageType,
  extensionForMimetype,
  defaultMimetypeForMessageType,
} from '../../common/utils/inbox-chat.util';
import { StoragePolicyService, type MessageMediaMeta } from '../storage/storage-policy.service';
import type { MediaStatus } from '../storage/storage.types';
import { WhatsAppOutboundService, type OutboundSafetyOptions } from '../whatsapp-safety/services/whatsapp-outbound.service';
import { WhatsAppWarmupService } from '../whatsapp-safety/services/whatsapp-warmup.service';
import { WhatsAppConsentService } from '../whatsapp-safety/services/whatsapp-consent.service';
import { WhatsAppSendAuditService } from '../whatsapp-safety/services/whatsapp-send-audit.service';
import {
  WhatsAppMessageType,
  WhatsAppSendAuditDecision,
  WhatsAppSendSource,
} from '../whatsapp-safety/enums/whatsapp-safety.enums';
import {
  isInternalLidUserId,
  isPlausiblePhoneDigits,
  isUsableWhatsAppChatTitle,
  isFallbackGroupIdLabel,
  isGenericWhatsAppContactLabel,
  looksLikePersonLabel,
  phoneDigitsFromChatId,
  resolveCustomerName,
  resolveCustomerPhone,
  resolveThreadIdentity,
  resolveInboxChatTitle,
  sanitizeStoredPhone,
} from '../../common/utils/inbox-display.util';

export interface GetMessagesOptions {
  chatId?: string;
  limit?: number;
  offset?: number;
}

export interface InboxMessageSearchHit {
  id: string;
  sessionId: string;
  sessionName: string;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  direction: MessageDirection;
  type: string;
  body: string;
  bodyPreview: string;
  timestamp: number | null;
  createdAt: Date;
  matchReason: 'message_body';
}

export interface ChatMessageForAi {
  id: string;
  body: string | null;
  direction: MessageDirection;
  type: string;
  timestamp: number | null;
  createdAt: Date;
  status: MessageStatus;
}

/** Safety context passed through outbound send paths (text, media, products). */
export type OutboundSendContext = {
  actorStaffId?: string;
  source?: string;
  skipGuard?: boolean;
  templateId?: string | null;
  aiConfidence?: number;
  isHighRiskIntent?: boolean;
  detectedIntent?: string | null;
  messageType?: WhatsAppMessageType;
  aiUnrestrictedMode?: boolean;
  repliedToWaMessageId?: string;
  burstMessageIds?: string[];
  burstWaMessageIds?: string[];
  ai?: {
    provider?: string;
    model?: string;
    tokensUsed?: number;
    latencyMs?: number;
  };
};

interface MediaFileMeta {
  mimetype?: string;
  filename?: string;
  hasData?: boolean;
  storagePath?: string;
  hasMedia?: boolean;
  mediaStatus?: MediaStatus;
  sizeBytes?: number;
  starred?: boolean;
}

export interface ConversationSummary {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  chatId: string;
  displayName: string;
  lastMessageAt: string;
  lastPreview: string | null;
  lastMessageType?: string | null;
  lastMessageId?: string | null;
  lastDirection: MessageDirection;
  messageCount: number;
  unreadCount: number;
  hasUnread: boolean;
  resolved: boolean;
  hasFollowUp: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  linkedExternalId?: string | null;
  profilePicUrl?: string | null;
  /** CRM lead source from followup_conversations when tracked */
  leadSource?: string | null;
  aiHandlingState?: string | null;
  aiOptOut?: boolean;
  aiAutoReplyPaused?: boolean;
  followupAutopilotPaused?: boolean;
  followUpAt?: string | null;
  assignedStaffId?: string | null;
  accountPhoneNumber?: string | null;
  accountPushName?: string | null;
  accountStatus?: string;
  accountPurpose?: string | null;
  branchId?: string | null;
  assignedStaffName?: string | null;
  stage?: string | null;
  priority?: string | null;
  nextFollowupAt?: string | null;
  followupOverdue?: boolean;
  lastCustomerMessageAt?: string | null;
  lastStaffMessageAt?: string | null;
  responseTimeSeconds?: number | null;
  productInterest?: string | null;
  outcome?: string | null;
  lostReason?: string | null;
  resolutionReason?: string | null;
  paymentReadiness?: string | null;
  threadState?: string;
  threadStateReason?: string;
  needsReply?: boolean;
  needsHuman?: boolean;
  waitingCustomer?: boolean;
  hotLead?: boolean;
  followupDue?: boolean;
  aiStatus?: string;
  queueStatus?: string | null;
  slaStatus?: string | null;
  isGroup?: boolean;
  /** hot / warm / cold storage tier (large accounts only) */
  threadTier?: 'hot' | 'warm' | 'cold';
  /** Latest inbound message was sent via sender's WhatsApp broadcast list. */
  lastInboundBroadcast?: boolean;
}

interface ThreadAggregateRow {
  sessionId: string;
  chatId: string;
  lastTimestamp: string | null;
  lastCreatedAt: string;
  messageCount: string;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);
  private readonly profilePicCache = new Map<string, { url: string | null; expiresAt: number }>();
  private readonly queueCountsCache = new Map<
    string,
    { expiresAt: number; counts: InboxQueueCounts }
  >();
  private static readonly PROFILE_PIC_TTL_MS = 30 * 60 * 1000;
  private static readonly MEDIA_BACKFILL_LIMIT = 80;
  private static readonly MEDIA_BACKFILL_DELAY_MS = 120;
  private static readonly LATEST_MESSAGE_ORDER = {
    timestamp: 'DESC' as const,
    createdAt: 'DESC' as const,
  };

  /** WhatsApp send time when available; otherwise when the row was persisted. */
  private resolveMessageActivityIso(
    timestamp: number | string | null | undefined,
    createdAt: Date | string | null | undefined,
  ): string {
    const ts = timestamp != null ? Number(timestamp) : NaN;
    if (Number.isFinite(ts) && ts > 0) {
      const ms = ts > 1e12 ? ts : ts * 1000;
      const fromTimestamp = new Date(ms);
      if (!Number.isNaN(fromTimestamp.getTime())) return fromTimestamp.toISOString();
    }
    if (createdAt) {
      const fromCreatedAt = new Date(createdAt);
      if (!Number.isNaN(fromCreatedAt.getTime())) return fromCreatedAt.toISOString();
    }
    return new Date().toISOString();
  }

  constructor(
    @InjectRepository(Message, 'data')
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(InboxThreadRead, 'data')
    private readonly threadReadRepository: Repository<InboxThreadRead>,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly hookManager: HookManager,
    private readonly storageService: StorageService,
    private readonly inboxCrmService: InboxCrmService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversationService: FollowupConversationService,
    private readonly authService: AuthService,
    private readonly profilePictureCacheService: ProfilePictureCacheService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => StoragePolicyService))
    private readonly storagePolicyService: StoragePolicyService,
    private readonly inboxThreadSummaryService: InboxThreadSummaryService,
    private readonly inboxThreadStateService: InboxThreadStateService,
    @Inject(forwardRef(() => WhatsAppOutboundService))
    private readonly whatsappOutbound: WhatsAppOutboundService,
    @Inject(forwardRef(() => WhatsAppWarmupService))
    private readonly whatsappWarmup: WhatsAppWarmupService,
    @Inject(forwardRef(() => WhatsAppConsentService))
    private readonly whatsappConsent: WhatsAppConsentService,
    @Inject(forwardRef(() => WhatsAppSendAuditService))
    private readonly whatsappAudit: WhatsAppSendAuditService,
  ) {}

  private touchThreadSummary(message: Message): void {
    void this.inboxThreadSummaryService.touchFromMessage(message).catch(err => {
      this.logger.warn('Failed to update inbox thread summary', {
        sessionId: message.sessionId,
        chatId: message.chatId,
        error: String(err),
      });
    });
  }

  private summaryToConversation(session: Session, row: InboxThreadSummary): ConversationSummary {
    return {
      sessionId: row.sessionId,
      sessionName: session.name,
      sessionStatus: session.status,
      chatId: row.chatId,
      displayName: row.displayName || this.fallbackChatLabel(row.chatId),
      lastMessageAt: row.lastMessageAt.toISOString(),
      lastPreview: row.lastPreview,
      lastMessageType: row.lastMessageType,
      lastMessageId: row.lastMessageId,
      lastDirection: row.lastDirection,
      messageCount: row.messageCount,
      unreadCount: row.unreadCount,
      hasUnread: row.unreadCount > 0,
      resolved: false,
      hasFollowUp: false,
      lastInboundBroadcast: row.lastInboundBroadcast ?? false,
    };
  }

  async sendText(
    sessionId: string,
    dto: SendTextMessageDto,
    options?: OutboundSendContext & {
      ai?: {
        provider?: string;
        model?: string;
        tokensUsed?: number;
        latencyMs?: number;
      };
    },
  ): Promise<MessageResponseDto> {
    return this.sendTextInternal(sessionId, dto, options);
  }

  /** Used by queue worker and internal paths; supports skipGuard. */
  async sendTextInternal(
    sessionId: string,
    dto: SendTextMessageDto,
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
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

    const safetyOptions = await this.assertOutboundSafety(
      sessionId,
      finalDto.chatId,
      finalDto.text,
      options,
    );

    const engine = await this.getEngineForSend(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: finalDto.chatId,
      body: finalDto.text,
      type: 'text',
      metadata: this.buildOutboundMetadata(options),
      isAiGenerated: Boolean(options?.ai || options?.source === 'ai-auto-reply'),
      aiProvider: options?.ai?.provider ?? null,
      aiModel: options?.ai?.model ?? null,
      aiTokensUsed: options?.ai?.tokensUsed ?? null,
      aiLatencyMs: options?.ai?.latencyMs ?? null,
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
        {
          sessionId,
          result,
          input: finalDto,
          chatId: finalDto.chatId,
          to: finalDto.chatId,
          staffId: options?.actorStaffId,
          isAiGenerated: Boolean(options?.ai || options?.source === 'ai-auto-reply'),
          source: options?.source ?? null,
        },
        { sessionId, source: 'MessageService' },
      );

      void this.whatsappWarmup.recordOutbound(
        sessionId,
        safetyOptions.messageType ?? WhatsAppMessageType.CUSTOMER_REPLY,
      );
      void this.whatsappConsent.recordOutbound(sessionId, finalDto.chatId.replace(/@.*$/, ''));
      void this.whatsappAudit.log({
        sessionId,
        chatId: finalDto.chatId,
        source: safetyOptions.source ?? WhatsAppSendSource.API,
        messageType: safetyOptions.messageType ?? WhatsAppMessageType.CUSTOMER_REPLY,
        decision: WhatsAppSendAuditDecision.SENT,
        reason: 'Message sent',
        body: finalDto.text,
      });

      return {
        messageId: result.id,
        timestamp: result.timestamp,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const lower = reason.toLowerCase();
      const retryable =
        !lower.includes('qr') &&
        !lower.includes('scan') &&
        !lower.includes('safety') &&
        !lower.includes('blocked') &&
        !lower.includes('not connected');
      message.metadata = {
        ...(message.metadata ?? {}),
        sendFailureReason: reason,
        retryable,
        retryCount: Number((message.metadata as Record<string, unknown>)?.retryCount ?? 0),
        maxRetries: 3,
      };
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);

      await this.hookManager.execute(
        'message:failed',
        {
          sessionId,
          error: reason,
          input: finalDto,
          messageId: message.id,
          isAiGenerated: message.isAiGenerated,
          chatId: finalDto.chatId,
        },
        { sessionId, source: 'MessageService' },
      );

      rethrowWhatsAppSendError(error);
    }
  }

  async sendImage(
    sessionId: string,
    dto: SendMediaMessageDto,
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    await this.assertOutboundSafety(sessionId, dto.chatId, dto.caption || '[image]', {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);
    const media = this.buildMediaInput(dto);
    const outboundOptions = this.mergeMediaOutboundOptions(dto, options);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.caption || '',
      type: 'image',
      metadata: this.buildOutboundMetadata(outboundOptions),
    });

    try {
      const result = await engine.sendImageMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);
      await this.persistOutboundMediaFromInput(sessionId, message, media);

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

  async sendImageAlbum(
    sessionId: string,
    dto: { chatId: string; urls: string[]; caption?: string },
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    await this.assertOutboundSafety(sessionId, dto.chatId, dto.caption || '[image album]', {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.PRODUCT_SEND,
    });

    const urls = dto.urls.map((url) => url.trim()).filter(Boolean);
    if (urls.length === 0) {
      throw new BadRequestException('At least one image URL is required');
    }

    const engine = await this.getEngineForSend(sessionId);
    const pending: Message[] = [];

    for (let index = 0; index < urls.length; index++) {
      const isLast = index === urls.length - 1;
      pending.push(
        await this.saveOutgoingMessage(sessionId, {
          chatId: dto.chatId,
          body: isLast ? dto.caption || '' : '',
          type: 'image',
        }),
      );
    }

    try {
      const results =
        urls.length === 1
          ? [
              await engine.sendImageMessage(dto.chatId, {
                mimetype: 'image/jpeg',
                data: urls[0],
                caption: dto.caption,
              }),
            ]
          : await engine.sendImageAlbum(dto.chatId, urls, dto.caption);

      for (let index = 0; index < pending.length; index++) {
        pending[index].waMessageId = results[index].id;
        pending[index].status = MessageStatus.SENT;
        pending[index].timestamp = results[index].timestamp;
        await this.messageRepository.save(pending[index]);
        await this.persistOutboundMediaFromInput(sessionId, pending[index], {
          mimetype: 'image/jpeg',
          data: urls[index],
        });
      }

      const last = results[results.length - 1];
      return {
        messageId: last.id,
        timestamp: last.timestamp,
      };
    } catch (error) {
      for (const message of pending) {
        message.status = MessageStatus.FAILED;
        await this.messageRepository.save(message);
      }
      throw error;
    }
  }

  async sendVideo(
    sessionId: string,
    dto: SendMediaMessageDto,
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    await this.assertOutboundSafety(sessionId, dto.chatId, dto.caption || '[video]', {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);
    const media = this.buildMediaInput(dto);
    const outboundOptions = this.mergeMediaOutboundOptions(dto, options);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.caption || '',
      type: 'video',
      metadata: this.buildOutboundMetadata(outboundOptions),
    });

    try {
      const result = await engine.sendVideoMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);
      await this.persistOutboundMediaFromInput(sessionId, message, media);

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

  async sendAudio(
    sessionId: string,
    dto: SendMediaMessageDto,
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    await this.assertOutboundSafety(sessionId, dto.chatId, dto.caption || '[audio]', {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);
    const media = this.buildMediaInput(dto);
    const outboundOptions = this.mergeMediaOutboundOptions(dto, options);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      type: 'audio',
      metadata: this.buildOutboundMetadata(outboundOptions),
    });

    try {
      const result = await engine.sendAudioMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);
      await this.persistOutboundMediaFromInput(sessionId, message, media);

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

  async sendDocument(
    sessionId: string,
    dto: SendMediaMessageDto,
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    await this.assertOutboundSafety(sessionId, dto.chatId, dto.filename || dto.caption || '[document]', {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);
    const media = this.buildMediaInput(dto);
    const outboundOptions = this.mergeMediaOutboundOptions(dto, options);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.filename || '',
      type: 'document',
      metadata: this.buildOutboundMetadata(outboundOptions),
    });

    try {
      const result = await engine.sendDocumentMessage(dto.chatId, media);

      // Update with actual WhatsApp message ID and status
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);
      await this.persistOutboundMediaFromInput(sessionId, message, media);

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

    const baseQuery = this.messageRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId });

    if (chatId) {
      baseQuery.andWhere('message.chatId = :chatId', { chatId });
    }

    let total = await baseQuery.getCount();

    if (chatId && offset === 0) {
      const threadTotal = await this.inboxThreadSummaryService.countThreads([sessionId]);
      const largeAccount = threadTotal > this.largeAccountThreshold();
      const needsWarmImport = total === 0 || (largeAccount && total < 5);
      if (needsWarmImport) {
        const imported = await this.tryImportChatHistory(sessionId, chatId);
        if (imported > 0) {
          total = await baseQuery.getCount();
        }
      }
    }

    const query = baseQuery.clone();
    if (chatId) {
      query.orderBy('message.timestamp', 'ASC').addOrderBy('message.createdAt', 'ASC');
      const skip = Math.max(0, total - limit - offset);
      query.skip(skip).take(limit);
    } else {
      query.orderBy('message.createdAt', 'DESC').skip(offset).take(limit);
    }

    const rows = await query.getMany();
    const messages = rows.filter(
      m => isInboxChat(m.chatId) && !['notification_template', 'e2e_notification', 'gp2', 'protocol'].includes(m.type),
    );
    return { messages, total };
  }

  /**
   * Load message attachment (cached on disk or downloaded from WhatsApp when session is active).
   */
  async getMessageMedia(
    sessionId: string,
    messageId: string,
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
    let message = await this.messageRepository.findOne({
      where: { id: messageId, sessionId },
    });
    if (!message) {
      message = await this.messageRepository.findOne({ where: { id: messageId } });
    }
    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const hasMedia =
      isMediaMessageType(message.type) ||
      Boolean((message.metadata as { media?: unknown } | null)?.media);
    if (!hasMedia) {
      return null;
    }

    const cached = await this.readCachedMessageMedia(message);
    if (cached) {
      return cached;
    }

    const meta = (message.metadata as { media?: MediaFileMeta } | null)?.media;
    if (meta?.mediaStatus === 'not_downloaded' || meta?.mediaStatus === 'deleted') {
      return null;
    }

    if (!meta?.storagePath && meta?.mediaStatus !== 'downloading') {
      const allowed = await this.storagePolicyService.shouldAutoDownload(message);
      if (!allowed) {
        await this.setMediaStatus(message, 'not_downloaded');
        return null;
      }
    }

    // Do not block the HTTP response on WhatsApp download — cache in background.
    void this.cacheMessageMedia(message.sessionId, messageId).catch(err => {
      this.logger.debug(`getMessageMedia background cache failed: ${messageId}`, String(err));
    });

    return null;
  }

  /**
   * Download and persist attachment bytes (when session is connected).
   * Safe to call in the background after persist or on session:ready.
   */
  async cacheMessageMedia(
    sessionId: string,
    messageId: string,
    options: { force?: boolean } = {},
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
    const message = await this.messageRepository.findOne({
      where: { id: messageId, sessionId },
    });
    if (!message || !this.messageNeedsMediaCache(message)) {
      return null;
    }

    const existing = await this.readCachedMessageMedia(message);
    if (existing) {
      return existing;
    }

    if (!options.force) {
      const allowed = await this.storagePolicyService.shouldAutoDownload(message);
      if (!allowed) {
        await this.setMediaStatus(message, 'not_downloaded');
        return null;
      }
    }

    if (!message.waMessageId) {
      return null;
    }

    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) {
      return null;
    }

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      return null;
    }

    await this.setMediaStatus(message, 'downloading');

    let downloaded: { mimetype: string; data: Buffer; filename?: string } | null;
    try {
      downloaded = await engine.downloadMessageMedia(message.waMessageId);
    } catch (error) {
      this.logger.debug(`cacheMessageMedia download failed: ${messageId}`, String(error));
      await this.setMediaStatus(message, 'failed');
      return null;
    }
    if (!downloaded) {
      await this.setMediaStatus(message, 'failed');
      return null;
    }

    return this.writeMessageMedia(message, downloaded);
  }

  async forceDownloadMedia(messageId: string): Promise<{
    ok: boolean;
    mediaStatus: MediaStatus;
    messageId: string;
    sessionId: string;
  }> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    const result = await this.cacheMessageMedia(message.sessionId, messageId, { force: true });
    const refreshed = await this.messageRepository.findOne({ where: { id: messageId } });
    const meta = (refreshed?.metadata as { media?: MediaFileMeta } | null)?.media;
    return {
      ok: Boolean(result),
      mediaStatus: meta?.mediaStatus ?? (result ? 'downloaded' : 'failed'),
      messageId,
      sessionId: message.sessionId,
    };
  }

  async setMessageMediaStarred(
    messageId: string,
    starred: boolean,
  ): Promise<{ messageId: string; starred: boolean }> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    const meta = (message.metadata as { media?: MediaFileMeta } | null)?.media ?? { hasMedia: true };
    message.metadata = {
      ...(message.metadata ?? {}),
      media: {
        ...meta,
        hasMedia: true,
        starred,
      },
    };
    await this.messageRepository.save(message);
    return { messageId, starred };
  }

  /**
   * After connect, cache recent attachments that were only stored as metadata.
   */
  async backfillUncachedMedia(
    sessionId: string,
    limit = MessageService.MEDIA_BACKFILL_LIMIT,
    delayMs = MessageService.MEDIA_BACKFILL_DELAY_MS,
  ): Promise<void> {
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) {
      return;
    }

    const rows = await this.messageRepository.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: limit * 4,
    });

    let queued = 0;
    for (const row of rows) {
      if (queued >= limit) break;
      if (!this.messageNeedsMediaCache(row)) continue;
      const allowed = await this.storagePolicyService.shouldAutoDownload(row);
      if (!allowed) continue;
      queued += 1;
      await this.cacheMessageMedia(sessionId, row.id);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  /**
   * Throttled background history import for chats not yet stored in DB.
   */
  async runBackgroundHistoryBatch(
    sessionId: string,
    batchSize: number,
    offset: number,
    messagesPerChat: number,
    delayMs: number,
    options?: { hotTierOnly?: boolean },
  ): Promise<{ hasMore: boolean; total: number; imported: number }> {
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) {
      return { hasMore: false, total: 0, imported: 0 };
    }

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      return { hasMore: false, total: 0, imported: 0 };
    }

    const threadTotal = await this.inboxThreadSummaryService.countThreads([sessionId]);
    const largeAccount = threadTotal > this.largeAccountThreshold();

    if (largeAccount) {
      const { chatIds, total } = await this.inboxThreadSummaryService.listHistorySyncCandidates(
        sessionId,
        offset,
        batchSize,
        options?.hotTierOnly
          ? {
              hotTierOnly: true,
              hotTierDays: this.configService.get<number>('engine.wa.largeAccountHotTierDays', 30),
            }
          : undefined,
      );
      let imported = 0;
      for (const chatId of chatIds) {
        const hasDb = await this.messageRepository.exist({
          where: { sessionId, chatId },
        });
        if (!hasDb) {
          imported += await this.importChatHistoryFromEngine(sessionId, chatId, messagesPerChat);
        } else {
          const count = await this.messageRepository.count({ where: { sessionId, chatId } });
          if (count < messagesPerChat) {
            imported += await this.importChatHistoryFromEngine(sessionId, chatId, messagesPerChat);
          }
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      return { hasMore: offset + batchSize < total, total, imported };
    }

    let chats: ChatSummary[] = [];
    try {
      chats = await engine.listChats();
    } catch {
      return { hasMore: false, total: 0, imported: 0 };
    }

    const sorted = chats
      .filter(c => isInboxChat(c.chatId))
      .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));
    const total = sorted.length;
    const batch = sorted.slice(offset, offset + batchSize);
    let imported = 0;

    for (const chat of batch) {
      const hasDb = await this.messageRepository.exist({
        where: { sessionId, chatId: chat.chatId },
      });
      if (!hasDb) {
        imported += await this.importChatHistoryFromEngine(sessionId, chat.chatId, messagesPerChat);
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    return { hasMore: offset + batchSize < total, total, imported };
  }

  async importChatHistoryFromEngine(
    sessionId: string,
    chatId: string,
    limit = 40,
  ): Promise<number> {
    if (!isInboxChat(chatId)) return 0;

    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) return 0;

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) return 0;

    let incoming: IncomingMessage[] = [];
    try {
      incoming = await engine.fetchChatMessages(chatId, limit);
    } catch (err) {
      this.logger.debug(`fetchChatMessages failed for ${chatId}: ${String(err)}`);
      return 0;
    }

    incoming.sort((a, b) => a.timestamp - b.timestamp);
    let imported = 0;
    for (const msg of incoming) {
      const saved = await this.persistInboundFromEngine(sessionId, msg);
      if (saved) imported += 1;
    }
    return imported;
  }

  private async tryImportChatHistory(sessionId: string, chatId: string): Promise<number> {
    const limit = this.configService.get<number>('engine.wa.historyBackfillMessages', 40);
    return this.importChatHistoryFromEngine(sessionId, chatId, limit);
  }

  /**
   * Throttled background enrichment for large accounts — one batch at a time.
   */
  async runBackgroundEnrichmentBatch(
    sessionId: string,
    batchSize: number,
    offset: number,
    profileDelayMs: number,
  ): Promise<{ hasMore: boolean; total: number }> {
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) {
      return { hasMore: false, total: 0 };
    }

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      return { hasMore: false, total: 0 };
    }

    const threadTotal = await this.inboxThreadSummaryService.countThreads([sessionId]);
    const largeAccount = threadTotal > this.largeAccountThreshold();

    if (largeAccount) {
      const { chatIds, total } = await this.inboxThreadSummaryService.listHistorySyncCandidates(
        sessionId,
        offset,
        batchSize,
      );
      if (chatIds.length === 0) {
        return { hasMore: false, total };
      }
      for (const chatId of chatIds) {
        const name = await this.findThreadChatName(sessionId, chatId);
        if (name && isUsableWhatsAppChatTitle(name, chatId)) {
          await this.persistThreadChatName(sessionId, chatId, name);
        }
        try {
          await engine.getProfilePicture(chatId);
        } catch {
          /* profile not available yet */
        }
        await new Promise(resolve => setTimeout(resolve, profileDelayMs));
      }
      return { hasMore: offset + batchSize < total, total };
    }

    const aggregates = await this.loadThreadAggregates([sessionId]);
    const chatIds = aggregates.filter(row => isInboxChat(row.chatId)).map(row => row.chatId);
    const total = chatIds.length;
    const batch = chatIds.slice(offset, offset + batchSize);
    if (batch.length === 0) {
      return { hasMore: false, total };
    }

    try {
      const chats = await engine.listChats();
      const nameByChatId = new Map(
        chats.filter(c => isInboxChat(c.chatId)).map(c => [c.chatId, c.name]),
      );
      for (const chatId of batch) {
        const name = nameByChatId.get(chatId);
        if (name && isUsableWhatsAppChatTitle(name, chatId)) {
          await this.persistThreadChatName(sessionId, chatId, name);
        }
        try {
          await engine.getProfilePicture(chatId);
        } catch {
          /* profile not available yet */
        }
        await new Promise(resolve => setTimeout(resolve, profileDelayMs));
      }
    } catch {
      /* engine busy during wwjs sync */
    }

    return { hasMore: offset + batchSize < total, total };
  }

  private async persistThreadChatName(sessionId: string, chatId: string, chatName: string): Promise<void> {
    const trimmed = chatName.trim();
    if (!trimmed || !isUsableWhatsAppChatTitle(trimmed, chatId)) return;

    void this.inboxThreadSummaryService.upsertDisplayName(sessionId, chatId, trimmed);

    const latest = await this.messageRepository.findOne({
      where: { sessionId, chatId },
      order: { createdAt: 'DESC' },
    });
    if (!latest) return;
    const metadata = (latest.metadata as Record<string, unknown> | null) ?? {};
    if (metadata.chatName === trimmed) return;
    await this.messageRepository.update(latest.id, {
      metadata: { ...metadata, chatName: trimmed },
    });
  }

  private canUseLiveEngineEnrichment(session: Session | undefined): boolean {
    if (!session || session.status !== SessionStatus.READY) return false;
    if (this.sessionService.isBackgroundSyncing(session.id)) return false;
    return true;
  }

  private largeAccountThreshold(): number {
    return this.configService.get<number>('engine.wa.largeAccountThreshold', 2000);
  }

  private queueCountsCacheTtlMs(): number {
    return this.configService.get<number>('engine.wa.queueCountsCacheTtlMs', 60_000);
  }

  async resolveInboxSessionIdsAsync(
    query: InboxConversationsQueryDto,
    ctx: InboxQueryContext,
  ): Promise<string[]> {
    const allSessions = await this.sessionService.findAll();
    let sessionIds = allSessions.map(s => s.id);
    if (ctx.allowedSessionIds?.length) {
      sessionIds = sessionIds.filter(id => ctx.allowedSessionIds!.includes(id));
    }
    if (query.sessionId) {
      sessionIds = sessionIds.filter(id => id === query.sessionId);
    }
    return sessionIds;
  }

  async queryInboxQueueCounts(
    query: Pick<InboxConversationsQueryDto, 'sessionId' | 'assignedStaffId' | 'assignedToMe'>,
    ctx: InboxQueryContext,
  ): Promise<InboxQueueCountsResult> {
    const sessionIds = await this.resolveInboxSessionIdsAsync(query, ctx);
    if (sessionIds.length === 0) {
      return { counts: {}, cached: false, largeAccountMode: false };
    }

    const threadTotal = await this.inboxThreadSummaryService.countThreads(sessionIds);
    const largeAccountMode = threadTotal > this.largeAccountThreshold();
    const viewerStaffId = resolveInboxViewerStaffId(query as InboxConversationsQueryDto, ctx);
    const cacheKey = `${sessionIds.sort().join(',')}:${viewerStaffId ?? ''}:${largeAccountMode ? 'large' : 'normal'}`;
    const cached = this.queueCountsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { counts: cached.counts, cached: true, largeAccountMode };
    }

    const sampleLimit = largeAccountMode
      ? this.configService.get<number>('engine.wa.largeAccountCountsSampleLimit', 500)
      : 2000;
    const allSessions = await this.sessionService.findAll();
    const sessionById = new Map(allSessions.map(s => [s.id, s]));
    const staffNames = await this.staffNameMap();

    const { summaries: countRows } = await this.inboxThreadSummaryService.queryPage(
      sessionIds,
      { ...query, queue: undefined, limit: sampleLimit, offset: 0, cursor: undefined },
      ctx,
      { skipExactTotal: largeAccountMode },
    );
    const enrichedForCounts = await this.enrichConversationSummaries(
      countRows,
      sessionById,
      staffNames,
      { skipLiveEngine: true },
    );
    const counts = this.inboxThreadStateService.countQueues(enrichedForCounts, viewerStaffId);
    this.queueCountsCache.set(cacheKey, {
      counts,
      expiresAt: Date.now() + this.queueCountsCacheTtlMs(),
    });
    return { counts, cached: false, largeAccountMode };
  }

  async searchInboxThreads(
    options: { q: string; sessionId?: string; limit?: number },
    ctx: InboxQueryContext,
  ): Promise<InboxThreadSearchResult> {
    const sessionIds = await this.resolveInboxSessionIdsAsync(
      { sessionId: options.sessionId },
      ctx,
    );
    if (sessionIds.length === 0) {
      return { threads: [], total: 0, limit: options.limit ?? 25 };
    }
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
    const { rows, total } = await this.inboxThreadSummaryService.searchThreadsLight(
      sessionIds,
      options,
      ctx,
    );

    const bySessionChatIds = new Map<string, string[]>();
    for (const row of rows) {
      const list = bySessionChatIds.get(row.sessionId) ?? [];
      list.push(row.chatId);
      bySessionChatIds.set(row.sessionId, list);
    }

    const crmMaps = new Map<string, Map<string, InboxThreadCrm>>();
    const followupMaps = new Map<string, Map<string, FollowupInboxEnrichment>>();
    for (const [sid, chatIds] of bySessionChatIds) {
      crmMaps.set(sid, await this.inboxCrmService.getCrmMapForSession(sid, chatIds));
      followupMaps.set(
        sid,
        await this.followupConversationService.getInboxEnrichmentMapForThreads(sid, chatIds),
      );
    }

    const q = options.q.trim();

    return {
      threads: rows.map(row => ({
        sessionId: row.sessionId,
        chatId: row.chatId,
        displayName: row.displayName,
        lastPreview: row.lastPreview,
        lastMessageAt:
          row.lastMessageAt instanceof Date
            ? row.lastMessageAt.toISOString()
            : String(row.lastMessageAt),
        unreadCount: row.unreadCount,
        matchReason: resolveThreadSearchMatchReason(
          q,
          row,
          crmMaps.get(row.sessionId)?.get(row.chatId),
          followupMaps.get(row.sessionId)?.get(row.chatId),
        ),
      })),
      total,
      limit,
    };
  }

  /**
   * List conversations aggregated from persisted messages for a session.
   */
  /**
   * All conversations across sessions (unified inbox). Respects optional API key session allow-list.
   * @deprecated Use queryUnifiedConversations for filters and pagination.
   */
  async getUnifiedConversations(allowedSessionIds?: string[]): Promise<ConversationSummary[]> {
    const result = await this.queryUnifiedConversations(
      { limit: 100, offset: 0 },
      {
        allowedSessionIds,
        apiKeyId: '',
        role: ApiKeyRole.ADMIN,
      },
    );
    return result.conversations;
  }

  async queryUnifiedConversations(
    query: InboxConversationsQueryDto,
    ctx: InboxQueryContext,
  ): Promise<UnifiedConversationsResult> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const sessionIds = await this.resolveInboxSessionIdsAsync(query, ctx);
    if (sessionIds.length === 0) {
      return {
        conversations: [],
        total: 0,
        limit,
        offset,
        nextCursor: null,
        hasMore: false,
        largeAccountMode: false,
        totalApproximate: false,
        threadTotal: 0,
      };
    }

    const allSessions = await this.sessionService.findAll();
    const sessionById = new Map(allSessions.map(s => [s.id, s]));
    const staffNames = await this.staffNameMap();
    const viewerStaffId = resolveInboxViewerStaffId(query, ctx);

    const threadTotal = await this.inboxThreadSummaryService.countThreads(sessionIds);
    const largeAccountMode = threadTotal > this.largeAccountThreshold();
    const totalApproximate = largeAccountMode;

    let counts = undefined;
    if (query.includeCounts) {
      const countResult = await this.queryInboxQueueCounts(query, ctx);
      counts = countResult.counts;
    }

    const { summaries, total } = await this.inboxThreadSummaryService.queryPage(
      sessionIds,
      query,
      ctx,
      { skipExactTotal: largeAccountMode },
    );

    if (query.queue) {
      const queueResult = await this.queryUnifiedConversationsWithQueue(
        query,
        ctx,
        sessionIds,
        sessionById,
        staffNames,
        viewerStaffId,
        limit,
        offset,
        counts,
        total,
        { largeAccountMode, totalApproximate, threadTotal, skipLiveEngine: largeAccountMode },
      );
      return queueResult;
    }

    let page = await this.enrichConversationSummaries(summaries, sessionById, staffNames, {
      skipLiveEngine: largeAccountMode,
    });
    await this.applyThreadStateToPage(page, sessionById, viewerStaffId);
    if (largeAccountMode) {
      this.applyThreadStorageTiers(page);
    }

    const nextCursor = buildNextCursor(page);
    const effectiveTotal = totalApproximate ? threadTotal : total;
    const hasMore = totalApproximate
      ? page.length >= limit
      : query.cursor
        ? page.length >= limit
        : offset + page.length < total;
    const largeAccountDefaults = largeAccountMode
      ? readLargeAccountDefaults(this.configService)
      : undefined;

    return {
      conversations: page,
      total: effectiveTotal,
      limit,
      offset,
      nextCursor: page.length > 0 && hasMore ? nextCursor : null,
      hasMore,
      counts,
      largeAccountMode,
      totalApproximate,
      threadTotal,
      recommendSingleSession: largeAccountMode && sessionIds.length > 1,
      largeAccountDefaults,
    };
  }

  private async queryUnifiedConversationsWithQueue(
    query: InboxConversationsQueryDto,
    ctx: InboxQueryContext,
    sessionIds: string[],
    sessionById: Map<string, Session>,
    staffNames: Map<string, string>,
    viewerStaffId: string | null | undefined,
    limit: number,
    offset: number,
    counts: UnifiedConversationsResult['counts'],
    sqlTotal: number,
    scale?: {
      largeAccountMode: boolean;
      totalApproximate: boolean;
      threadTotal: number;
      skipLiveEngine: boolean;
    },
  ): Promise<UnifiedConversationsResult> {
    const queue = query.queue as InboxWorkQueue;
    const matched: ConversationSummary[] = [];
    let scanCursor: string | undefined = query.cursor;
    let scanOffset = query.cursor ? 0 : offset;
    const batchSize = Math.min(Math.max(limit * 4, 50), 200);
    let lastBatchLength = 0;
    let exhausted = false;

    while (matched.length < limit && !exhausted) {
      const { summaries } = await this.inboxThreadSummaryService.queryPage(
        sessionIds,
        {
          ...query,
          limit: batchSize,
          offset: scanCursor ? undefined : scanOffset,
          cursor: scanCursor,
        },
        ctx,
        scale?.totalApproximate ? { skipExactTotal: true } : undefined,
      );

      lastBatchLength = summaries.length;
      if (summaries.length === 0) {
        exhausted = true;
        break;
      }

      const page = await this.enrichConversationSummaries(summaries, sessionById, staffNames, {
        skipLiveEngine: scale?.skipLiveEngine === true,
      });
      await this.applyThreadStateToPage(page, sessionById, viewerStaffId);

      for (const summary of page) {
        const assignedToMe =
          Boolean(viewerStaffId) && summary.assignedStaffId === viewerStaffId;
        if (
          this.inboxThreadStateService.matchesQueue(
            (summary.threadState ?? 'idle') as InboxThreadState,
            queue,
            assignedToMe,
          )
        ) {
          matched.push(summary);
          if (matched.length >= limit) break;
        }
      }

      scanCursor =
        buildNextCursor(
          summaries.map(s => ({
            lastMessageAt:
              s.lastMessageAt instanceof Date
                ? s.lastMessageAt.toISOString()
                : String(s.lastMessageAt),
            sessionId: s.sessionId,
            chatId: s.chatId,
          })),
        ) ?? undefined;
      if (!query.cursor) {
        scanOffset += summaries.length;
      }
      if (summaries.length < batchSize) {
        exhausted = true;
      }
      if (scanOffset > 10_000) {
        exhausted = true;
      }
    }

    const page = matched.slice(0, limit);
    if (scale?.largeAccountMode) {
      this.applyThreadStorageTiers(page);
    }
    const hasMore =
      matched.length > limit ||
      (!exhausted && lastBatchLength >= batchSize && page.length > 0);
    const nextCursor =
      page.length > 0 && hasMore
        ? buildNextCursor(
            page.map(c => ({
              lastMessageAt: c.lastMessageAt,
              sessionId: c.sessionId,
              chatId: c.chatId,
            })),
          )
        : null;

    return {
      conversations: page,
      total: scale?.totalApproximate ? scale.threadTotal : sqlTotal,
      limit,
      offset,
      nextCursor,
      hasMore,
      counts,
      largeAccountMode: scale?.largeAccountMode,
      totalApproximate: scale?.totalApproximate,
      threadTotal: scale?.threadTotal,
      recommendSingleSession: scale?.largeAccountMode === true && sessionIds.length > 1,
      largeAccountDefaults: scale?.largeAccountMode
        ? readLargeAccountDefaults(this.configService)
        : undefined,
    };
  }

  private applyThreadStorageTiers(page: ConversationSummary[]): void {
    for (const summary of page) {
      summary.threadTier = resolveThreadStorageTier(
        {
          lastMessageAt: summary.lastMessageAt,
          messageCount: summary.messageCount,
          resolved: summary.resolved,
        },
        this.configService,
      );
    }
  }

  private async applyThreadStateToPage(
    page: ConversationSummary[],
    sessionById: Map<string, Session>,
    viewerStaffId?: string | null,
  ): Promise<void> {
    const sendFlags = await this.loadThreadSendFlags(page);
    for (const summary of page) {
      const session = sessionById.get(summary.sessionId);
      const flags = sendFlags.get(`${summary.sessionId}:${summary.chatId}`);
      this.inboxThreadStateService.applyToSummary(summary, {
        viewerStaffId,
        sessionDisconnected: session?.status !== SessionStatus.READY,
        hasFailedSend: flags?.hasFailedSend,
        hasQueuedSend: flags?.hasQueuedSend,
      });
    }
  }

  private async loadThreadSendFlags(
    summaries: Array<{ sessionId: string; chatId: string }>,
  ): Promise<Map<string, { hasFailedSend: boolean; hasQueuedSend: boolean }>> {
    const result = new Map<string, { hasFailedSend: boolean; hasQueuedSend: boolean }>();
    if (summaries.length === 0) return result;

    const sessionGroups = new Map<string, string[]>();
    for (const row of summaries) {
      const list = sessionGroups.get(row.sessionId) ?? [];
      list.push(row.chatId);
      sessionGroups.set(row.sessionId, list);
    }

    for (const [sessionId, chatIds] of sessionGroups) {
      const failedRows = await this.messageRepository
        .createQueryBuilder('m')
        .select('m.chatId', 'chatId')
        .addSelect('MAX(CASE WHEN m.status = :failedStatus THEN 1 ELSE 0 END)', 'hasFailed')
        .addSelect('MAX(CASE WHEN m.status = :pendingStatus THEN 1 ELSE 0 END)', 'hasPending')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.chatId IN (:...chatIds)', { chatIds })
        .andWhere('m.direction = :dir', { dir: MessageDirection.OUTGOING })
        .andWhere('m.status IN (:...statuses)', {
          statuses: [MessageStatus.FAILED, MessageStatus.PENDING],
        })
        .groupBy('m.chatId')
        .setParameter('failedStatus', MessageStatus.FAILED)
        .setParameter('pendingStatus', MessageStatus.PENDING)
        .getRawMany<{ chatId: string; hasFailed: string; hasPending: string }>();

      for (const row of failedRows) {
        result.set(`${sessionId}:${row.chatId}`, {
          hasFailedSend: Number(row.hasFailed) > 0,
          hasQueuedSend: Number(row.hasPending) > 0 && Number(row.hasFailed) === 0,
        });
      }
    }

    return result;
  }

  private async enrichConversationSummaries(
    summaries: import('./entities/inbox-thread-summary.entity').InboxThreadSummary[],
    sessionById: Map<string, Session>,
    staffNames: Map<string, string>,
    options?: { skipLiveEngine?: boolean },
  ): Promise<ConversationSummary[]> {
    const bySessionChatIds = new Map<string, string[]>();
    for (const row of summaries) {
      const list = bySessionChatIds.get(row.sessionId) ?? [];
      list.push(row.chatId);
      bySessionChatIds.set(row.sessionId, list);
    }

    const crmMaps = new Map<string, Map<string, InboxThreadCrm>>();
    const followupMaps = new Map<string, Map<string, FollowupInboxEnrichment>>();
    const notifyNameMaps = new Map<string, Map<string, string>>();
    for (const [sid, chatIds] of bySessionChatIds) {
      crmMaps.set(sid, await this.inboxCrmService.getCrmMapForSession(sid, chatIds));
      followupMaps.set(
        sid,
        await this.followupConversationService.getInboxEnrichmentMapForThreads(sid, chatIds),
      );
      notifyNameMaps.set(sid, await this.findLatestNotifyNamesForChats(sid, chatIds));
    }

    const page: ConversationSummary[] = [];
    for (const row of summaries) {
      const session = sessionById.get(row.sessionId);
      if (!session) continue;
      const summary = this.summaryToConversation(session, row);
      const notifyName = notifyNameMaps.get(row.sessionId)?.get(row.chatId) ?? null;
      this.applyCrmFields(summary, crmMaps.get(row.sessionId)?.get(row.chatId), notifyName);
      this.applyFollowupFields(
        summary,
        followupMaps.get(row.sessionId)?.get(row.chatId),
        crmMaps.get(row.sessionId)?.get(row.chatId),
        staffNames,
      );
      this.applySessionAccountFields(session, summary);
      page.push(summary);
    }

    await this.enrichConversationPage(page, sessionById, options);
    for (const summary of page) {
      this.applyConversationLabel(summary);
    }
    return page;
  }

  async hasInboxThread(sessionId: string, chatId: string): Promise<boolean> {
    return this.messageRepository.exist({ where: { sessionId, chatId } });
  }

  async enrichInboundNotificationPayload(
    sessionId: string,
    chatId: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const session = await this.sessionService.findOne(sessionId);
    const crm = await this.inboxCrmService.getThreadCrm(sessionId, chatId).catch(() => null);
    const followup = await this.followupConversationService.findByThread(sessionId, chatId);

    const body = typeof payload.body === 'string' ? payload.body : '';
    const notifyName =
      typeof payload.notifyName === 'string' && !isInternalLidUserId(payload.notifyName, chatId)
        ? payload.notifyName
        : null;
    const storedNotifyName =
      (await this.findLatestNotifyNamesForChats(sessionId, [chatId])).get(chatId) ?? null;
    const customerName =
      resolveCustomerName(
        chatId,
        notifyName,
        storedNotifyName,
        crm?.customerName,
        followup?.customerName,
      ) ?? null;
    const customerPhone = resolveCustomerPhone(
      chatId,
      crm?.customerPhone,
      followup?.customerPhone,
    );

    return {
      ...payload,
      sessionName: session.name,
      sessionPhone: session.phone ?? null,
      customerName,
      customerPhone,
      messagePreview: formatMessagePreview(body, typeof payload.type === 'string' ? payload.type : 'text'),
      stage: followup?.stage ?? null,
    };
  }

  private async gateInboxSend(
    apiKey: ApiKey,
    sessionId: string,
    chatId: string,
  ): Promise<{ ok: true } | { ok: false; code: string; status: string; message: string }> {
    assertApiKeySessionAccess(apiKey, sessionId);
    if (!isInboxChat(chatId)) {
      throw new BadRequestException(
        'Cannot send to this chat type. Use a personal or group chat, not status/broadcast.',
      );
    }

    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) {
      return {
        ok: false,
        code: 'SESSION_NOT_READY',
        status: session.status,
        message: `Session '${sessionId}' is not connected (status: ${session.status}). Start or reconnect the WhatsApp session first.`,
      };
    }

    const hasMessages = await this.messageRepository.exist({
      where: { sessionId, chatId },
    });
    if (!hasMessages) {
      const engine = this.sessionService.getEngine(sessionId);
      if (engine) {
        try {
          const chats = await engine.listChats();
          const found = chats.some(c => c.chatId === chatId && isInboxChat(c.chatId));
          if (!found) {
            throw new BadRequestException('Chat not found in inbox for this session');
          }
        } catch (err) {
          if (err instanceof BadRequestException) throw err;
          throw new BadRequestException('Chat not found in inbox for this session');
        }
      } else {
        throw new BadRequestException('Chat not found in inbox for this session');
      }
    }

    return { ok: true };
  }

  /** REST-friendly inbox send gate — throws instead of returning SESSION_NOT_READY objects. */
  async assertInboxSendAllowed(apiKey: ApiKey, sessionId: string, chatId: string): Promise<void> {
    const gate = await this.gateInboxSend(apiKey, sessionId, chatId);
    if (!gate.ok) {
      let message = gate.message;
      if (gate.status === SessionStatus.QR_READY) {
        message = `${message} Scan the QR code to connect.`;
      }
      throw new BadRequestException(message);
    }

    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new BadRequestException(
        `Session '${sessionId}' has no active WhatsApp engine. Start the session first.`,
      );
    }
  }

  async sendTextFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    chatId: string,
    text: string,
    options?: { source?: string },
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    const gate = await this.gateInboxSend(apiKey, sessionId, chatId);
    if (!gate.ok) return gate;
    return this.sendText(sessionId, { chatId, text }, {
      actorStaffId: apiKey.id,
      source: options?.source,
    });
  }

  async replyFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    chatId: string,
    quotedMessageId: string,
    text: string,
    options?: { source?: string },
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    const gate = await this.gateInboxSend(apiKey, sessionId, chatId);
    if (!gate.ok) return gate;
    return this.reply(
      sessionId,
      { chatId, quotedMessageId, text },
      {
        actorStaffId: apiKey.id,
        source: options?.source ?? 'inbox-quote',
        repliedToWaMessageId: quotedMessageId,
      },
    );
  }

  async retryFailedInboxMessage(
    apiKey: ApiKey,
    messageId: string,
  ): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new BadRequestException('Message not found');
    if (message.status !== MessageStatus.FAILED) {
      throw new BadRequestException('Only failed messages can be retried');
    }
    const meta = (message.metadata ?? {}) as Record<string, unknown>;
    if (meta.retryable === false) {
      throw new BadRequestException('This message failure is not retryable');
    }
    await this.assertInboxSendAllowed(apiKey, message.sessionId, message.chatId);
    return this.resendExistingOutgoingMessage(message, {
      actorStaffId: apiKey.id,
      source: 'inbox-retry',
    });
  }

  async resendFailedInboxMessage(
    apiKey: ApiKey,
    messageId: string,
    text: string,
  ): Promise<MessageResponseDto> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new BadRequestException('Message not found');
    if (message.status !== MessageStatus.FAILED) {
      throw new BadRequestException('Only failed messages can be resent');
    }
    await this.assertInboxSendAllowed(apiKey, message.sessionId, message.chatId);
    message.body = text.trim();
    return this.resendExistingOutgoingMessage(message, {
      actorStaffId: apiKey.id,
      source: 'inbox-resend',
    });
  }

  async resendExistingOutgoingMessage(
    message: Message,
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    const text = message.body?.trim();
    if (!text) throw new BadRequestException('Message has no text to send');

    await this.assertOutboundSafety(message.sessionId, message.chatId, text, options);
    const engine = await this.getEngineForSend(message.sessionId);

    message.status = MessageStatus.PENDING;
    await this.messageRepository.update(message.id, { waMessageId: null as unknown as string, status: MessageStatus.PENDING });
    const meta = { ...(message.metadata ?? {}) } as Record<string, unknown>;
    meta.retryCount = Number(meta.retryCount ?? 0) + 1;
    delete meta.sendFailureReason;
    message.metadata = meta;
    await this.messageRepository.save(message);

    try {
      const result = await engine.sendTextMessage(message.chatId, text);
      message.waMessageId = result.id;
      message.status = MessageStatus.SENT;
      message.timestamp = result.timestamp;
      await this.messageRepository.save(message);
      return { messageId: result.id, timestamp: result.timestamp };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      message.metadata = {
        ...meta,
        sendFailureReason: reason,
        retryable: meta.retryable !== false,
      };
      message.status = MessageStatus.FAILED;
      await this.messageRepository.save(message);
      rethrowWhatsAppSendError(error);
    }
  }

  async findMessageById(messageId: string): Promise<Message> {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new BadRequestException('Message not found');
    return message;
  }

  private async sendMediaFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    dto: SendMediaMessageDto,
    sender: (
      sid: string,
      media: SendMediaMessageDto,
      opts?: OutboundSendContext,
    ) => Promise<MessageResponseDto>,
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    const gate = await this.gateInboxSend(apiKey, sessionId, dto.chatId);
    if (!gate.ok) return gate;
    return sender(sessionId, dto, { actorStaffId: apiKey.id });
  }

  async sendImageFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    dto: SendMediaMessageDto,
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    return this.sendMediaFromInbox(apiKey, sessionId, dto, (sid, media, opts) => this.sendImage(sid, media, opts));
  }

  async sendVideoFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    dto: SendMediaMessageDto,
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    return this.sendMediaFromInbox(apiKey, sessionId, dto, (sid, media, opts) => this.sendVideo(sid, media, opts));
  }

  async sendDocumentFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    dto: SendMediaMessageDto,
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    return this.sendMediaFromInbox(apiKey, sessionId, dto, (sid, media, opts) => this.sendDocument(sid, media, opts));
  }

  async sendAudioFromInbox(
    apiKey: ApiKey,
    sessionId: string,
    dto: SendMediaMessageDto,
  ): Promise<MessageResponseDto | { ok: false; code: string; status: string; message: string }> {
    return this.sendMediaFromInbox(apiKey, sessionId, dto, (sid, media, opts) => this.sendAudio(sid, media, opts));
  }

  async getConversations(
    sessionId: string,
    query: InboxConversationsQueryDto = {},
    ctx?: InboxQueryContext,
  ): Promise<UnifiedConversationsResult> {
    return this.queryUnifiedConversations(
      { ...query, sessionId, limit: query.limit ?? 50, offset: query.offset ?? 0 },
      ctx ?? { apiKeyId: '', role: ApiKeyRole.ADMIN },
    );
  }

  private async enrichProfilePictures(
    engine: IWhatsAppEngine,
    sessionId: string,
    summaries: ConversationSummary[],
  ): Promise<void> {
    await Promise.all(
      summaries.map(async summary => {
        const latestIncoming = await this.messageRepository.findOne({
          where: {
            sessionId,
            chatId: summary.chatId,
            direction: MessageDirection.INCOMING,
          },
          order: MessageService.LATEST_MESSAGE_ORDER,
        });
        const alternates = latestIncoming?.from ? [latestIncoming.from] : [];
        summary.profilePicUrl = await this.resolveProfilePicture(
          engine,
          sessionId,
          summary.chatId,
          alternates,
        );
      }),
    );
  }

  private async resolveProfilePicture(
    engine: IWhatsAppEngine,
    sessionId: string,
    chatId: string,
    alternateContactIds: string[] = [],
  ): Promise<string | null> {
    const cacheKey = `${sessionId}:${chatId}`;
    const cached = this.profilePicCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    if (await this.profilePictureCacheService.isKnownAbsent(sessionId, chatId)) {
      this.profilePicCache.set(cacheKey, {
        url: null,
        expiresAt: Date.now() + MessageService.PROFILE_PIC_TTL_MS,
      });
      return null;
    }

    const candidates = [chatId, ...alternateContactIds.filter(id => id && id !== chatId)];
    if (chatId.endsWith('@lid')) {
      try {
        const contact = await engine.getContactById(chatId);
        if (contact?.number) {
          const digits = contact.number.replace(/\D/g, '');
          if (digits) candidates.push(`${digits}@c.us`);
        }
      } catch {
        /* contact not in WA store yet */
      }
    }
    let url: string | null = null;
    for (const candidate of candidates) {
      try {
        url = await engine.getProfilePicture(candidate);
        if (url) break;
      } catch {
        url = null;
      }
    }

    this.profilePicCache.set(cacheKey, {
      url,
      expiresAt: Date.now() + MessageService.PROFILE_PIC_TTL_MS,
    });

    if (url) {
      await this.profilePictureCacheService.warmFromUrl(sessionId, chatId, url);
    } else {
      const session = await this.sessionService.findOne(sessionId);
      if (session?.status === SessionStatus.READY) {
        void this.profilePictureCacheService.markKnownAbsent(sessionId, chatId);
      }
    }

    return url;
  }

  private async enrichLinkedDeviceSummaries(
    sessionId: string,
    engine: IWhatsAppEngine,
    summaries: ConversationSummary[],
  ): Promise<void> {
    const lidRows = summaries.filter(s => s.chatId.endsWith('@lid'));
    if (lidRows.length === 0) return;

    await Promise.all(
      lidRows.map(async summary => {
        try {
          const contact = await engine.getContactById(summary.chatId);
          if (!contact) return;

          const digits = contact.number?.replace(/\D/g, '') ?? '';
          let phoneHint: string | null = null;
          if (!summary.customerPhone && isPlausiblePhoneDigits(digits)) {
            summary.customerPhone = resolveCustomerPhone(summary.chatId, `+${digits}`) ?? digits;
            phoneHint = `+${digits}`;
          }

          const push = (contact.pushName || contact.name)?.trim();
          if (
            push &&
            looksLikePersonLabel(push) &&
            !isInternalLidUserId(push, summary.chatId) &&
            !isGenericWhatsAppContactLabel(push) &&
            !summary.customerName?.trim()
          ) {
            summary.customerName = push;
            summary.displayName = push;
          }

          if (phoneHint || summary.customerName) {
            await this.followupConversationService.syncIdentityIfEmpty(sessionId, summary.chatId, {
              customerName: summary.customerName ?? null,
              customerPhone: phoneHint,
            });
          }
        } catch {
          // Contact not in WA store yet
        }
      }),
    );
  }

  private buildBaseSummary(session: Session, row: ThreadAggregateRow): ConversationSummary {
    return {
      sessionId: row.sessionId,
      sessionName: session.name,
      sessionStatus: session.status,
      chatId: row.chatId,
      displayName: this.fallbackChatLabel(row.chatId),
      lastMessageAt: this.resolveMessageActivityIso(row.lastTimestamp, row.lastCreatedAt),
      lastPreview: null,
      lastDirection: MessageDirection.INCOMING,
      messageCount: parseInt(row.messageCount, 10) || 0,
      unreadCount: 0,
      hasUnread: false,
      resolved: false,
      hasFollowUp: false,
    };
  }

  private applySessionAccountFields(session: Session, summary: ConversationSummary): void {
    const config = session.config as { purpose?: string; branchId?: string } | null;
    summary.accountPhoneNumber = session.phone ?? null;
    summary.accountPushName = session.pushName ?? null;
    summary.accountStatus = session.status;
    summary.accountPurpose = config?.purpose ?? null;
    if (!summary.branchId && config?.branchId) {
      summary.branchId = config.branchId;
    }
  }

  private applyCrmFields(
    summary: ConversationSummary,
    crm?: InboxThreadCrm,
    notifyName?: string | null,
  ): void {
    summary.resolved = crm?.resolved ?? false;
    summary.followUpAt = crm?.followUpAt?.toISOString() ?? null;
    summary.hasFollowUp = Boolean(crm?.followUpAt && crm.followUpAt > new Date());
    summary.customerName = resolveCustomerName(summary.chatId, notifyName, crm?.customerName);
    summary.customerPhone = resolveCustomerPhone(summary.chatId, crm?.customerPhone);
    summary.linkedExternalId = crm?.linkedExternalId ?? null;
    summary.aiHandlingState = crm?.aiHandlingState ?? 'idle';
    summary.aiOptOut = crm?.aiOptOut ?? false;
    summary.aiAutoReplyPaused = crm?.aiAutoReplyPaused ?? false;
    summary.followupAutopilotPaused = crm?.followupAutopilotPaused ?? false;
    summary.resolutionReason = crm?.resolvedReason ?? null;
    summary.paymentReadiness = crm?.paymentReadiness ?? null;
    if (!summary.nextFollowupAt && crm?.followUpAt) {
      summary.nextFollowupAt = crm.followUpAt.toISOString();
    }
    this.computeFollowupOverdue(summary);
  }

  private applyFollowupFields(
    summary: ConversationSummary,
    followup?: FollowupInboxEnrichment,
    crm?: InboxThreadCrm,
    staffNames?: Map<string, string>,
  ): void {
    if (!followup) return;

    if (!summary.customerName?.trim()) {
      const name = resolveCustomerName(summary.chatId, followup.customerName);
      if (name) summary.customerName = name;
    }
    if (!summary.customerPhone) {
      const phone = resolveCustomerPhone(summary.chatId, followup.customerPhone);
      if (phone) summary.customerPhone = phone;
    }

    summary.leadSource = followup.source ?? null;
    summary.branchId = followup.branchId ?? summary.branchId ?? null;
    summary.assignedStaffId = followup.assignedStaffId ?? null;
    summary.assignedStaffName = followup.assignedStaffId
      ? (staffNames?.get(followup.assignedStaffId) ?? null)
      : null;
    summary.stage = followup.stage ?? null;
    summary.priority = followup.priority ?? null;
    summary.productInterest = followup.productInterest ?? null;
    summary.outcome = followup.outcome ?? null;
    summary.lostReason = followup.lostReason ?? null;
    summary.lastCustomerMessageAt = followup.lastCustomerMessageAt?.toISOString() ?? null;
    summary.lastStaffMessageAt = followup.lastStaffMessageAt?.toISOString() ?? null;
    summary.responseTimeSeconds = followup.responseTimeSeconds ?? null;
    if (followup.nextFollowupAt) {
      summary.nextFollowupAt = followup.nextFollowupAt.toISOString();
    } else if (!summary.nextFollowupAt && crm?.followUpAt) {
      summary.nextFollowupAt = crm.followUpAt.toISOString();
    }
    if (followup.followupAutopilotPaused) {
      summary.followupAutopilotPaused = true;
    }
    this.computeFollowupOverdue(summary);
  }

  private computeFollowupOverdue(summary: ConversationSummary): void {
    if (summary.resolved) {
      summary.followupOverdue = false;
      return;
    }
    const dueIso = summary.nextFollowupAt ?? summary.followUpAt;
    if (!dueIso) {
      summary.followupOverdue = false;
      return;
    }
    const due = new Date(dueIso);
    summary.followupOverdue = !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
  }

  private latestMessageSubquery(column: 'timestamp' | 'createdAt') {
    return (subQuery: ReturnType<Repository<Message>['createQueryBuilder']>) =>
      subQuery
        .select(`m.${column}`)
        .from(Message, 'm')
        .where('m.sessionId = message.sessionId')
        .andWhere('m.chatId = message.chatId')
        .orderBy('m.timestamp', 'DESC')
        .addOrderBy('m.createdAt', 'DESC')
        .limit(1);
  }

  private async loadThreadAggregates(sessionIds: string[]): Promise<ThreadAggregateRow[]> {
    if (sessionIds.length === 0) return [];
    return this.messageRepository
      .createQueryBuilder('message')
      .select('message.sessionId', 'sessionId')
      .addSelect('message.chatId', 'chatId')
      .addSelect(this.latestMessageSubquery('timestamp'), 'lastTimestamp')
      .addSelect(this.latestMessageSubquery('createdAt'), 'lastCreatedAt')
      .addSelect('COUNT(message.id)', 'messageCount')
      .where('message.sessionId IN (:...sessionIds)', { sessionIds })
      .groupBy('message.sessionId')
      .addGroupBy('message.chatId')
      .getRawMany<ThreadAggregateRow>();
  }

  private async staffNameMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const keys = await this.authService.findAll();
      for (const k of keys) map.set(k.id, k.name);
    } catch {
      /* optional */
    }
    return map;
  }

  private async filterUnifiedCandidates(
    candidates: ConversationSummary[],
    query: InboxConversationsQueryDto,
    ctx: InboxQueryContext,
  ): Promise<ConversationSummary[]> {
    const isAdmin = ctx.role === ApiKeyRole.ADMIN;
    const staffId = resolveInboxViewerStaffId(query, ctx);

    let result = candidates;

    if (!isAdmin && ctx.apiKeyId) {
      result = result.filter(
        c => !c.assignedStaffId || c.assignedStaffId === ctx.apiKeyId,
      );
    }

    if (staffId) {
      result = result.filter(c => c.assignedStaffId === staffId);
    }
    if (query.unassigned) {
      result = result.filter(c => !c.assignedStaffId);
    }
    if (query.branchId) {
      result = result.filter(c => c.branchId === query.branchId);
    }
    if (query.status === InboxConversationStatusFilter.OPEN) {
      result = result.filter(c => !c.resolved);
    } else if (query.status === InboxConversationStatusFilter.RESOLVED) {
      result = result.filter(c => c.resolved);
    }
    if (query.stage) {
      result = result.filter(c => c.stage === query.stage);
    }
    if (query.priority) {
      result = result.filter(c => c.priority === query.priority);
    }
    if (query.aiStatus) {
      result = result.filter(c => c.aiHandlingState === query.aiStatus);
    }
    if (query.overdueFollowup) {
      result = result.filter(c => c.followupOverdue === true);
    }
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      result = result.filter(
        c =>
          (c.displayName?.toLowerCase().includes(q) ?? false) ||
          (c.sessionName?.toLowerCase().includes(q) ?? false) ||
          c.chatId.toLowerCase().includes(q) ||
          (c.lastPreview?.toLowerCase().includes(q) ?? false) ||
          (c.customerName?.toLowerCase().includes(q) ?? false) ||
          (c.customerPhone?.toLowerCase().includes(q) ?? false) ||
          (c.productInterest?.toLowerCase().includes(q) ?? false),
      );
    }

    if (query.unread !== undefined) {
      const withUnread: ConversationSummary[] = [];
      for (const c of result) {
        const unread = await this.countUnreadIncoming(c.sessionId, c.chatId);
        c.unreadCount = unread;
        c.hasUnread = unread > 0;
        if (query.unread === c.hasUnread) withUnread.push(c);
      }
      result = withUnread;
    }

    return result;
  }

  private sortUnifiedConversations(
    rows: ConversationSummary[],
    sort: InboxConversationSort,
  ): ConversationSummary[] {
    const priorityRank: Record<string, number> = {
      hot: 0,
      high: 1,
      normal: 2,
      low: 3,
    };

    const copy = [...rows];
    copy.sort((a, b) => {
      if (sort === InboxConversationSort.OLDEST) {
        return new Date(a.lastMessageAt).getTime() - new Date(b.lastMessageAt).getTime();
      }
      if (sort === InboxConversationSort.PRIORITY) {
        const pa = priorityRank[a.priority ?? 'normal'] ?? 2;
        const pb = priorityRank[b.priority ?? 'normal'] ?? 2;
        if (pa !== pb) return pa - pb;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
      if (sort === InboxConversationSort.OVERDUE) {
        const oa = a.followupOverdue ? 0 : 1;
        const ob = b.followupOverdue ? 0 : 1;
        if (oa !== ob) return oa - ob;
        const da = a.nextFollowupAt ? new Date(a.nextFollowupAt).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.nextFollowupAt ? new Date(b.nextFollowupAt).getTime() : Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      }
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });
    return copy;
  }

  private async enrichConversationPage(
    page: ConversationSummary[],
    sessionById: Map<string, Session>,
    options?: { skipLiveEngine?: boolean },
  ): Promise<void> {
    const bySession = new Map<string, ConversationSummary[]>();
    for (const summary of page) {
      const list = bySession.get(summary.sessionId) ?? [];
      list.push(summary);
      bySession.set(summary.sessionId, list);
    }

    for (const [sessionId, summaries] of bySession) {
      const session = sessionById.get(sessionId);
      if (!session) continue;

      const chatIds = summaries.map(s => s.chatId);
      const [latestByChat, unreadByChat, namesByChat] = await Promise.all([
        this.batchLatestMessages(sessionId, chatIds),
        this.batchUnreadCounts(sessionId, chatIds),
        this.batchThreadChatNames(sessionId, chatIds),
      ]);

      for (const summary of summaries) {
        const chatNameFromDb = namesByChat.get(summary.chatId);
        if (chatNameFromDb) {
          summary.displayName = chatNameFromDb;
        }
        if (!summary.lastMessageId) {
          const latest = latestByChat.get(summary.chatId);
          if (latest) {
            summary.lastMessageAt = this.resolveMessageActivityIso(latest.timestamp, latest.createdAt);
            summary.lastPreview = formatMessagePreview(latest.body, latest.type);
            summary.lastMessageType = latest.type;
            summary.lastMessageId = latest.id;
            summary.lastDirection = latest.direction;
          }
          const unread = unreadByChat.get(summary.chatId) ?? 0;
          summary.unreadCount = unread;
          summary.hasUnread = unread > 0;
        }
      }

      const engine = this.sessionService.getEngine(sessionId);
      if (
        engine &&
        summaries.length > 0 &&
        this.canUseLiveEngineEnrichment(session) &&
        !options?.skipLiveEngine
      ) {
        try {
          const chats = await engine.listChats();
          const nameByChatId = new Map(
            chats.filter(c => isInboxChat(c.chatId)).map(c => [c.chatId, c.name]),
          );
          const unreadByChatId = new Map(
            chats.filter(c => isInboxChat(c.chatId)).map(c => [c.chatId, c.unreadCount ?? 0]),
          );
          for (const summary of summaries) {
            const name = nameByChatId.get(summary.chatId);
            if (name && isUsableWhatsAppChatTitle(name, summary.chatId)) {
              summary.displayName = name;
              void this.persistThreadChatName(sessionId, summary.chatId, name);
            }
            const engineUnread = unreadByChatId.get(summary.chatId) ?? 0;
            summary.unreadCount = Math.max(summary.unreadCount, engineUnread);
            summary.hasUnread = summary.unreadCount > 0;
          }
          await this.enrichGroupDisplayNames(sessionId, engine, summaries);
          await this.enrichLinkedDeviceSummaries(sessionId, engine, summaries);
          await this.enrichProfilePictures(engine, sessionId, summaries);
        } catch {
          /* engine busy */
        }
      }

      for (const summary of summaries) {
        this.applyConversationLabel(summary);
      }
    }
  }

  private async batchLatestMessages(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, Message>> {
    if (chatIds.length === 0) return new Map();
    const rows = await this.messageRepository.find({
      where: { sessionId, chatId: In(chatIds) },
      order: { timestamp: 'DESC', createdAt: 'DESC' },
    });
    const map = new Map<string, Message>();
    for (const row of rows) {
      if (!map.has(row.chatId)) map.set(row.chatId, row);
    }
    return map;
  }

  private async batchUnreadCounts(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, number>> {
    if (chatIds.length === 0) return new Map();
    const reads = await this.threadReadRepository.find({
      where: { sessionId, chatId: In(chatIds) },
    });
    const readAt = new Map(reads.map(r => [r.chatId, r.lastReadAt]));
    const rows = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.chatId', 'chatId')
      .addSelect('message.createdAt', 'createdAt')
      .where('message.sessionId = :sessionId', { sessionId })
      .andWhere('message.chatId IN (:...chatIds)', { chatIds })
      .andWhere('message.direction = :direction', { direction: MessageDirection.INCOMING })
      .getRawMany<{ chatId: string; createdAt: string }>();

    const counts = new Map<string, number>();
    for (const chatId of chatIds) counts.set(chatId, 0);
    for (const row of rows) {
      const lastRead = readAt.get(row.chatId);
      const created = new Date(row.createdAt);
      if (!lastRead || created > lastRead) {
        counts.set(row.chatId, (counts.get(row.chatId) ?? 0) + 1);
      }
    }
    return counts;
  }

  private async batchThreadChatNames(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, string>> {
    if (chatIds.length === 0) return new Map();
    const take = Math.min(chatIds.length * 15, 500);
    const rows = await this.messageRepository.find({
      where: { sessionId, chatId: In(chatIds) },
      order: { createdAt: 'DESC' },
      take,
      select: ['chatId', 'metadata'],
    });
    const map = new Map<string, string>();
    for (const row of rows) {
      if (map.has(row.chatId)) continue;
      const chatName = (row.metadata as { chatName?: string } | null)?.chatName?.trim();
      if (chatName && isUsableWhatsAppChatTitle(chatName, row.chatId)) {
        map.set(row.chatId, chatName);
      }
    }
    const fromSummaries = await this.inboxThreadSummaryService.findDisplayNamesForChats(
      sessionId,
      chatIds,
    );
    for (const [chatId, name] of fromSummaries) {
      if (map.has(chatId)) continue;
      const trimmed = name?.trim();
      if (trimmed && isUsableWhatsAppChatTitle(trimmed, chatId)) {
        map.set(chatId, trimmed);
      }
    }
    return map;
  }

  /** Resolve WhatsApp group subjects when only the numeric jid fallback is stored. */
  private async enrichGroupDisplayNames(
    sessionId: string,
    engine: IWhatsAppEngine,
    summaries: ConversationSummary[],
  ): Promise<void> {
    const needsName = summaries.filter(row => {
      if (!row.chatId.endsWith('@g.us')) return false;
      const label = row.displayName?.trim();
      if (!label) return true;
      return isFallbackGroupIdLabel(label, row.chatId);
    });
    if (needsName.length === 0) return;

    await Promise.all(
      needsName.map(async summary => {
        try {
          const info = await engine.getGroupInfo(summary.chatId);
          const name = info?.name?.trim();
          if (!name || !isUsableWhatsAppChatTitle(name, summary.chatId)) return;
          summary.displayName = name;
          void this.persistThreadChatName(sessionId, summary.chatId, name);
        } catch {
          /* group metadata unavailable */
        }
      }),
    );
  }

  /** Best stored WhatsApp push name from inbound message metadata. */
  private async findLatestNotifyNamesForChats(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (chatIds.length === 0) return map;

    const rows = await this.messageRepository.find({
      where: { sessionId, chatId: In(chatIds), direction: MessageDirection.INCOMING },
      order: { timestamp: 'DESC', createdAt: 'DESC' },
      take: Math.min(chatIds.length * 8, 400),
      select: ['chatId', 'metadata'],
    });

    for (const row of rows) {
      if (map.has(row.chatId)) continue;
      const notify = (row.metadata as { notifyName?: string } | null)?.notifyName?.trim();
      if (
        notify &&
        !isInternalLidUserId(notify, row.chatId) &&
        looksLikePersonLabel(notify) &&
        !isGenericWhatsAppContactLabel(notify)
      ) {
        map.set(row.chatId, notify);
      }
    }
    return map;
  }

  /** Best stored WhatsApp chat title from message metadata (group subject / contact push name). */
  private async findThreadChatName(sessionId: string, chatId: string): Promise<string | null> {
    const rows = await this.messageRepository.find({
      where: { sessionId, chatId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
    for (const row of rows) {
      const chatName = (row.metadata as { chatName?: string } | null)?.chatName?.trim();
      if (chatName && isUsableWhatsAppChatTitle(chatName, chatId)) {
        return chatName;
      }
    }
    return null;
  }

  private applyConversationLabel(summary: ConversationSummary): void {
    summary.displayName = resolveInboxChatTitle({
      chatId: summary.chatId,
      displayName: summary.displayName,
      customerName: summary.customerName ?? null,
      customerPhone: summary.customerPhone ?? null,
    });
  }

  private fallbackChatLabel(chatId: string): string {
    if (chatId.endsWith('@lid')) return '';
    return chatId.replace(/@c\.us$/, '').replace(/@g\.us$/, ' (group)');
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
    } else {
      await this.threadReadRepository.save(
        this.threadReadRepository.create({ sessionId, chatId, lastReadAt }),
      );
    }
    void this.inboxThreadSummaryService.resetUnread(sessionId, chatId);
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
        type: normalizeMessageType(incoming.type),
        direction: MessageDirection.OUTGOING,
        timestamp: incoming.timestamp,
        metadata,
        status: MessageStatus.SENT,
      });
      try {
        const saved = await this.messageRepository.save(message);
        await this.persistInboundMediaIfPresent(saved, incoming);
        this.queueMediaCache(sessionId, saved);
        this.touchThreadSummary(saved);
        return saved;
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

    const saved = await this.saveIncomingMessage(sessionId, {
      waMessageId,
      chatId: incoming.chatId,
      from: incoming.from,
      to: incoming.to,
      body: incoming.body,
      type: normalizeMessageType(incoming.type),
      timestamp: incoming.timestamp,
      metadata,
      status: MessageStatus.DELIVERED,
    });
    await this.persistInboundMediaIfPresent(saved, incoming);
    this.queueMediaCache(sessionId, saved);
    return saved;
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
    const meta: Record<string, unknown> = {
      isGroup: incoming.isGroup,
      fromMe: incoming.fromMe,
    };
    if (incoming.chatName) {
      meta.chatName = incoming.chatName;
    }
    if (incoming.author) {
      meta.author = incoming.author;
    }
    if (incoming.notifyName) {
      meta.notifyName = incoming.notifyName;
    }
    if (incoming.remoteJidAlt) {
      meta.remoteJidAlt = incoming.remoteJidAlt;
    }
    if (incoming.participantAlt) {
      meta.participantAlt = incoming.participantAlt;
    }
    if (incoming.quotedMessage) {
      meta.quotedMessage = incoming.quotedMessage;
    }
    if (incoming.media) {
      const thumbnailPreview = incoming.media.thumbnail
        ? `data:image/jpeg;base64,${incoming.media.thumbnail}`
        : undefined;
      meta.media = {
        mimetype: incoming.media.mimetype,
        filename: incoming.media.filename,
        hasData: !!incoming.media.data,
        hasMedia: true,
        mediaStatus: incoming.media.data ? 'downloaded' : 'not_downloaded',
        ...(incoming.media.width ? { width: incoming.media.width } : {}),
        ...(incoming.media.height ? { height: incoming.media.height } : {}),
        ...(thumbnailPreview ? { thumbnailPreview } : {}),
      };
      if (thumbnailPreview && !incoming.media.data) {
        meta.localPreviewUrl = thumbnailPreview;
      }
    }
    if (incoming.broadcast) {
      meta.broadcast = true;
    }
    if (incoming.isStatus) {
      meta.isStatus = true;
    }
    return meta;
  }

  // ========== Phase 3: Extended Messaging ==========

  async sendLocation(
    sessionId: string,
    dto: { chatId: string; latitude: number; longitude: number; description?: string; address?: string },
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    if (!isInboxChat(dto.chatId)) {
      throw new BadRequestException(
        'Cannot send to this chat type. Use a personal or group chat, not status/broadcast.',
      );
    }

    const body = `📍 ${dto.description || dto.address || `${dto.latitude}, ${dto.longitude}`}`;
    await this.assertOutboundSafety(sessionId, dto.chatId, body, {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);

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
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    if (!isInboxChat(dto.chatId)) {
      throw new BadRequestException(
        'Cannot send to this chat type. Use a personal or group chat, not status/broadcast.',
      );
    }

    const body = `📇 ${dto.contactName} (${dto.contactNumber})`;
    await this.assertOutboundSafety(sessionId, dto.chatId, body, {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);

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

  async sendSticker(sessionId: string, dto: SendMediaMessageDto, options?: OutboundSendContext): Promise<MessageResponseDto> {
    await this.assertOutboundSafety(sessionId, dto.chatId, dto.caption || '[sticker]', {
      ...options,
      messageType: options?.messageType ?? WhatsAppMessageType.UTILITY,
    });
    const engine = await this.getEngineForSend(sessionId);
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
      await this.persistOutboundMediaFromInput(sessionId, message, media);

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
    options?: OutboundSendContext,
  ): Promise<MessageResponseDto> {
    const safetyOptions = this.buildSafetyOptions(options);
    const guardCheck = await this.whatsappOutbound.checkBeforeSend({
      sessionId,
      chatId: dto.chatId,
      body: dto.text,
      options: safetyOptions,
    });
    this.whatsappOutbound.assertCanSend(guardCheck);

    const engine = await this.getEngineForSend(sessionId);

    // Save message as pending BEFORE sending
    const message = await this.saveOutgoingMessage(sessionId, {
      chatId: dto.chatId,
      body: dto.text,
      type: 'text',
      metadata: this.buildOutboundMetadata(options),
      isAiGenerated: Boolean(options?.ai || options?.source === 'ai-auto-reply'),
      aiProvider: options?.ai?.provider ?? null,
      aiModel: options?.ai?.model ?? null,
      aiTokensUsed: options?.ai?.tokensUsed ?? null,
      aiLatencyMs: options?.ai?.latencyMs ?? null,
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
      rethrowWhatsAppSendError(error);
    }
  }

  async forward(
    sessionId: string,
    dto: { fromChatId: string; toChatId: string; messageId: string },
    options?: { actorStaffId?: string },
  ): Promise<MessageResponseDto> {
    const safetyOptions = this.buildSafetyOptions({ actorStaffId: options?.actorStaffId });
    const guardCheck = await this.whatsappOutbound.checkBeforeSend({
      sessionId,
      chatId: dto.toChatId,
      body: '[Forwarded]',
      options: safetyOptions,
    });
    this.whatsappOutbound.assertCanSend(guardCheck);

    const engine = await this.getEngineForSend(sessionId);

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
    return this.messageRepository.save(message).then(saved => {
      this.touchThreadSummary(saved);
      return saved;
    });
  }

  /**
   * Save outgoing message to database.
   * When called before sending, creates a record with PENDING status.
   */
  private buildOutboundMetadata(
    options?: OutboundSendContext,
  ): Record<string, unknown> | undefined {
    if (!options) return undefined;
    const meta: Record<string, unknown> = {};
    if (options.source) meta.source = options.source;
    if (options.detectedIntent) meta.detectedIntent = options.detectedIntent;
    if (options.repliedToWaMessageId) meta.repliedToWaMessageId = options.repliedToWaMessageId;
    if (options.burstMessageIds?.length) meta.burstMessageIds = options.burstMessageIds;
    if (options.burstWaMessageIds?.length) meta.burstWaMessageIds = options.burstWaMessageIds;
    return Object.keys(meta).length > 0 ? meta : undefined;
  }

  private async saveOutgoingMessage(
    sessionId: string,
    data: {
      waMessageId?: string;
      chatId: string;
      body?: string;
      type: string;
      timestamp?: number;
      status?: MessageStatus;
      metadata?: Record<string, unknown>;
      isAiGenerated?: boolean;
      aiProvider?: string | null;
      aiModel?: string | null;
      aiTokensUsed?: number | null;
      aiLatencyMs?: number | null;
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
      metadata: data.metadata,
      status: data.status ?? MessageStatus.PENDING,
      isAiGenerated: data.isAiGenerated ?? false,
      aiProvider: data.aiProvider ?? null,
      aiModel: data.aiModel ?? null,
      aiTokensUsed: data.aiTokensUsed ?? null,
      aiLatencyMs: data.aiLatencyMs ?? null,
    });
    return this.messageRepository.save(message).then(saved => {
      this.touchThreadSummary(saved);
      return saved;
    });
  }

  // ========== Phase 3: Reactions ==========

  async reactToMessage(sessionId: string, dto: { chatId: string; messageId: string; emoji: string }): Promise<void> {
    const engine = await this.getEngineForSend(sessionId);
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
    const engine = await this.getEngineForSend(sessionId);
    await engine.deleteMessage(dto.chatId, dto.messageId, dto.forEveryone ?? true);
  }

  /** Search stored WhatsApp message bodies across inbox chats and groups. */
  async searchInboxMessages(options: {
    query: string;
    sessionId?: string;
    chatId?: string;
    groupsOnly?: boolean;
    mediaOnly?: boolean;
    allowedSessionIds?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{
    matches: InboxMessageSearchHit[];
    total: number;
    returned: number;
    offset: number;
    truncated: boolean;
  }> {
    const q = options.query.trim();
    if (!q) return { matches: [], total: 0, returned: 0, offset: 0, truncated: false };

    const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);
    const like = `%${q}%`;

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.body LIKE :like', { like })
      .andWhere('message.body IS NOT NULL')
      .andWhere("TRIM(message.body) != ''")
      .andWhere('message.type NOT IN (:...skipTypes)', {
        skipTypes: ['notification_template', 'e2e_notification', 'gp2', 'protocol', 'call_log', 'ciphertext', 'revoked'],
      })
      .andWhere('message.chatId NOT LIKE :broadcast', { broadcast: '%@broadcast%' })
      .andWhere('message.chatId NOT LIKE :newsletter', { newsletter: '%@newsletter%' });

    if (options.sessionId) {
      qb.andWhere('message.sessionId = :sessionId', { sessionId: options.sessionId });
    }
    if (options.allowedSessionIds?.length) {
      qb.andWhere('message.sessionId IN (:...allowedSessionIds)', {
        allowedSessionIds: options.allowedSessionIds,
      });
    }
    if (options.chatId) {
      qb.andWhere('message.chatId = :chatId', { chatId: options.chatId });
    }
    if (options.groupsOnly) {
      qb.andWhere('message.chatId LIKE :groupSuffix', { groupSuffix: '%@g.us' });
    }
    if (options.mediaOnly) {
      qb.andWhere('message.type IN (:...mediaTypes)', { mediaTypes: ['image', 'sticker'] });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy('message.timestamp', 'DESC')
      .addOrderBy('message.createdAt', 'DESC')
      .skip(offset)
      .take(limit)
      .getMany();

    const sessionNames = new Map(
      (await this.sessionService.findAll()).map((s) => [s.id, s.name]),
    );

    const eligibleRows = rows.filter(row => isInboxChat(row.chatId));
    const chatIdsBySession = new Map<string, string[]>();
    for (const row of eligibleRows) {
      const list = chatIdsBySession.get(row.sessionId) ?? [];
      if (!list.includes(row.chatId)) list.push(row.chatId);
      chatIdsBySession.set(row.sessionId, list);
    }

    const titleBySessionChat = new Map<string, string>();
    await Promise.all(
      [...chatIdsBySession.entries()].map(async ([sessionId, chatIds]) => {
        const [namesFromMessages, displayNames] = await Promise.all([
          this.batchThreadChatNames(sessionId, chatIds),
          this.inboxThreadSummaryService.findDisplayNamesForChats(sessionId, chatIds),
        ]);
        for (const chatId of chatIds) {
          const key = `${sessionId}:${chatId}`;
          const waName = namesFromMessages.get(chatId);
          const storedDisplay = displayNames.get(chatId);
          const displayName =
            waName ??
            (storedDisplay && isUsableWhatsAppChatTitle(storedDisplay, chatId)
              ? storedDisplay
              : null);
          titleBySessionChat.set(key, resolveInboxChatTitle({ chatId, displayName }));
        }
      }),
    );

    const matches: InboxMessageSearchHit[] = [];
    for (const row of eligibleRows) {
      const key = `${row.sessionId}:${row.chatId}`;
      const meta = row.metadata as { chatName?: string } | null;
      const rawMetaName =
        meta?.chatName && isUsableWhatsAppChatTitle(meta.chatName, row.chatId)
          ? meta.chatName
          : null;
      const chatName =
        titleBySessionChat.get(key) ||
        (rawMetaName
          ? resolveInboxChatTitle({ chatId: row.chatId, displayName: rawMetaName })
          : this.fallbackChatLabel(row.chatId));
      matches.push({
        id: row.id,
        sessionId: row.sessionId,
        sessionName: sessionNames.get(row.sessionId) ?? row.sessionId,
        chatId: row.chatId,
        chatName,
        isGroup: row.chatId.endsWith('@g.us'),
        direction: row.direction,
        type: row.type,
        body: row.body ?? '',
        bodyPreview: this.truncateForSearch(row.body ?? '', q),
        timestamp: row.timestamp,
        createdAt: row.createdAt,
        matchReason: 'message_body',
      });
    }

    return {
      matches,
      total,
      returned: matches.length,
      offset,
      truncated: offset + matches.length < total,
    };
  }

  /** Recent messages in one inbox chat (for AI context). */
  async getChatMessagesForAi(
    sessionId: string,
    chatId: string,
    limit = 30,
  ): Promise<{ sessionId: string; chatId: string; total: number; messages: ChatMessageForAi[] }> {
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Not a valid inbox chat ID');
    }
    const capped = Math.min(Math.max(limit, 1), 50);
    const { messages, total } = await this.getMessages(sessionId, { chatId, limit: capped });
    return {
      sessionId,
      chatId,
      total,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        direction: m.direction,
        type: m.type,
        timestamp: m.timestamp,
        createdAt: m.createdAt,
        status: m.status,
      })),
    };
  }

  private truncateForSearch(body: string, query: string, radius = 80): string {
    const text = body.replace(/\s+/g, ' ').trim();
    if (text.length <= radius * 2) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return `${text.slice(0, radius * 2)}…`;
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + query.length + radius);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < text.length ? '…' : '';
    return `${prefix}${text.slice(start, end)}${suffix}`;
  }

  /** WhatsApp typing indicator — failures are ignored (session may be offline). */
  async sendTyping(sessionId: string, chatId: string): Promise<void> {
    try {
      const engine = this.sessionService.getEngine(sessionId);
      if (!engine) return;
      await engine.sendTyping(chatId);
    } catch {
      // Non-critical for UX
    }
  }

  async clearTyping(sessionId: string, chatId: string): Promise<void> {
    try {
      const engine = this.sessionService.getEngine(sessionId);
      if (!engine) return;
      await engine.clearTyping(chatId);
    } catch {
      // Non-critical for UX
    }
  }

  private buildSafetyOptions(options?: OutboundSendContext): OutboundSafetyOptions {
    const sourceStr = options?.source;
    let source: WhatsAppSendSource | undefined;
    if (sourceStr === 'ai-auto-reply' || sourceStr === 'ai') source = WhatsAppSendSource.AI;
    else if (sourceStr === 'followup') source = WhatsAppSendSource.FOLLOWUP;
    else if (sourceStr === 'campaign') source = WhatsAppSendSource.CAMPAIGN;
    else if (sourceStr === 'bulk') source = WhatsAppSendSource.BULK;
    else if (sourceStr === 'product_send' || sourceStr === 'product-send') source = WhatsAppSendSource.PRODUCT_SEND;
    else if (sourceStr === 'quote') source = WhatsAppSendSource.MANUAL;
    else if (sourceStr === 'ai-opt-out-ack') source = WhatsAppSendSource.AI;
    else if (sourceStr === 'transfer-notify') source = WhatsAppSendSource.MANUAL;
    else if (options?.actorStaffId) source = WhatsAppSendSource.MANUAL;

    let messageType: WhatsAppMessageType | undefined = options?.messageType;
    if (sourceStr === 'ai-auto-reply') messageType = WhatsAppMessageType.AI_AUTO_REPLY;
    else if (sourceStr === 'campaign') messageType = WhatsAppMessageType.CAMPAIGN;
    else if (sourceStr === 'bulk') messageType = WhatsAppMessageType.BULK;
    else if (sourceStr === 'ai-opt-out-ack') messageType = WhatsAppMessageType.OPT_OUT_ACK;
    else if (sourceStr === 'transfer-notify') messageType = WhatsAppMessageType.UTILITY;
    else if (sourceStr === 'product_send' || sourceStr === 'product-send') messageType = WhatsAppMessageType.PRODUCT_SEND;
    else if (sourceStr === 'quote') messageType = WhatsAppMessageType.QUOTE_REMINDER;
    else if (sourceStr === 'followup') messageType = WhatsAppMessageType.FOLLOW_UP;

    return {
      source,
      messageType,
      isManualStaffSend: Boolean(options?.actorStaffId),
      skipGuard: options?.skipGuard,
      templateId: options?.templateId,
      aiConfidence: options?.aiConfidence,
      isHighRiskIntent: options?.isHighRiskIntent,
      detectedIntent: options?.detectedIntent,
      aiUnrestrictedMode: options?.aiUnrestrictedMode,
      actorStaffId: options?.actorStaffId,
    };
  }

  private async assertOutboundSafety(
    sessionId: string,
    chatId: string,
    body: string,
    options?: OutboundSendContext,
  ): Promise<OutboundSafetyOptions> {
    if (!isInboxChat(chatId)) {
      throw new BadRequestException(
        'Cannot send to this chat type. Use a personal or group chat, not status/broadcast.',
      );
    }
    const safetyOptions = this.buildSafetyOptions(options);
    const guardCheck = await this.whatsappOutbound.checkBeforeSend({
      sessionId,
      chatId,
      body,
      options: safetyOptions,
    });
    this.whatsappOutbound.assertCanSend(guardCheck);
    return safetyOptions;
  }

  private async assertSendSession(sessionId: string): Promise<Session> {
    if (!sessionId?.trim()) {
      throw new BadRequestException('sessionId is required for outbound messages');
    }
    const session = await this.sessionService.findOne(sessionId);
    if (session.status !== SessionStatus.READY) {
      throw new BadRequestException(
        `Session '${sessionId}' is not connected (status: ${session.status}). Start or reconnect the WhatsApp session first.`,
      );
    }
    return session;
  }

  private getEngine(sessionId: string) {
    const engine = this.sessionService.getEngine(sessionId);
    if (!engine) {
      throw new BadRequestException(
        `Session '${sessionId}' has no active WhatsApp engine. Start the session first.`,
      );
    }
    return engine;
  }

  private async getEngineForSend(sessionId: string): Promise<IWhatsAppEngine> {
    await this.assertSendSession(sessionId);
    return this.getEngine(sessionId);
  }

  private queueMediaCache(sessionId: string, message: Message): void {
    if (!this.messageNeedsMediaCache(message)) {
      return;
    }
    void (async () => {
      const allowed = await this.storagePolicyService.shouldAutoDownload(message);
      if (!allowed) {
        await this.setMediaStatus(message, 'not_downloaded');
        return;
      }
      await this.cacheMessageMedia(sessionId, message.id).catch(err => {
        this.logger.debug(`Background media cache failed for ${message.id}: ${String(err)}`);
      });
    })();
  }

  private messageNeedsMediaCache(message: Message): boolean {
    const hasMedia =
      isMediaMessageType(message.type) ||
      Boolean((message.metadata as { media?: MediaFileMeta } | null)?.media?.hasMedia);
    if (!hasMedia) {
      return false;
    }
    const meta = (message.metadata as { media?: MediaFileMeta } | null)?.media;
    if (meta?.mediaStatus === 'deleted') return false;
    return !meta?.storagePath;
  }

  private async persistInboundMediaIfPresent(
    message: Message,
    incoming: IncomingMessage,
  ): Promise<void> {
    const raw = incoming.media?.data;
    if (!raw) return;

    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'base64');
    if (buffer.length === 0) return;

    await this.writeMessageMedia(message, {
      mimetype: incoming.media?.mimetype || defaultMimetypeForMessageType(message.type),
      data: buffer,
      filename: incoming.media?.filename,
    });
  }

  private async readCachedMessageMedia(
    message: Message,
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
    const meta = (message.metadata as { media?: MediaFileMeta } | null)?.media;
    if (!meta?.storagePath) {
      return null;
    }
    try {
      const buffer = await this.storageService.getFile(meta.storagePath);
      return {
        buffer,
        mimetype: meta.mimetype || defaultMimetypeForMessageType(message.type),
        filename: meta.filename,
      };
    } catch {
      return null;
    }
  }

  private async setMediaStatus(message: Message, status: MediaStatus): Promise<void> {
    const meta = (message.metadata as { media?: MediaFileMeta } | null)?.media ?? {
      hasMedia: true,
    };
    message.metadata = {
      ...(message.metadata ?? {}),
      media: {
        ...meta,
        hasMedia: true,
        mediaStatus: status,
      },
    };
    await this.messageRepository.save(message);
  }

  private async writeMessageMedia(
    message: Message,
    downloaded: { mimetype: string; data: Buffer; filename?: string },
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string }> {
    const ext = extensionForMimetype(downloaded.mimetype);
    const storagePath = `inbox/${message.sessionId}/${message.id}.${ext}`;
    await this.storageService.putFile(storagePath, downloaded.data);

    message.metadata = {
      ...(message.metadata ?? {}),
      media: {
        mimetype: downloaded.mimetype,
        filename: downloaded.filename,
        hasData: true,
        hasMedia: true,
        storagePath,
        mediaStatus: 'downloaded',
        sizeBytes: downloaded.data.length,
      },
    };
    await this.messageRepository.save(message);

    return {
      buffer: downloaded.data,
      mimetype: downloaded.mimetype,
      filename: downloaded.filename,
    };
  }

  private bufferFromMediaInput(media: MediaInput): Buffer | null {
    if (Buffer.isBuffer(media.data)) {
      return media.data;
    }
    const raw = typeof media.data === 'string' ? media.data.trim() : '';
    if (!raw || /^https?:\/\//i.test(raw)) {
      return null;
    }
    const payload = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    try {
      return Buffer.from(payload, 'base64');
    } catch {
      return null;
    }
  }

  private async persistOutboundMediaFromInput(
    sessionId: string,
    message: Message,
    media: MediaInput,
  ): Promise<void> {
    const buffer = this.bufferFromMediaInput(media);
    if (!buffer) {
      return;
    }
    const mimetype = media.mimetype || defaultMimetypeForMessageType(message.type);
    const ext = extensionForMimetype(mimetype);
    const storagePath = `inbox/${sessionId}/${message.id}.${ext}`;
    await this.storageService.putFile(storagePath, buffer);
    message.metadata = {
      ...(message.metadata ?? {}),
      media: {
        mimetype,
        filename: media.filename,
        hasData: true,
        hasMedia: true,
        storagePath,
        mediaStatus: 'downloaded',
        sizeBytes: buffer.length,
      },
    };
    await this.messageRepository.save(message);
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
      quotedMessageId: dto.quotedMessageId?.trim() || undefined,
    };
  }

  private mergeMediaOutboundOptions(
    dto: SendMediaMessageDto,
    options?: OutboundSendContext,
  ): OutboundSendContext | undefined {
    const quoted = dto.quotedMessageId?.trim();
    if (!quoted && !options) return options;
    return {
      ...options,
      repliedToWaMessageId: quoted ?? options?.repliedToWaMessageId,
      source: options?.source ?? (quoted ? 'inbox-quote' : undefined),
    };
  }

  /** Best-effort phone digits for a thread (chat id, message alt jids, stored CRM hints). */
  async resolveThreadPhoneHint(sessionId: string, chatId: string): Promise<string | null> {
    const fromChat = phoneDigitsFromChatId(chatId);
    if (fromChat) return fromChat;

    const rows = await this.messageRepository.find({
      where: { sessionId, chatId },
      order: { createdAt: 'DESC' },
      take: 40,
      select: ['from', 'to', 'direction', 'metadata'],
    });

    for (const row of rows) {
      const meta = row.metadata as {
        remoteJidAlt?: string;
        participantAlt?: string;
      } | null;
      for (const alt of [meta?.remoteJidAlt, meta?.participantAlt]) {
        const digits = alt ? phoneDigitsFromChatId(alt) : null;
        if (digits) return digits;
      }
      const peer = row.direction === MessageDirection.INCOMING ? row.from : row.to;
      const peerDigits = phoneDigitsFromChatId(peer);
      if (peerDigits) return peerDigits;
    }

    return null;
  }
}
