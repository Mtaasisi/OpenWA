import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit, forwardRef } from '@nestjs/common';
import { HookManager } from '../../core/hooks';
import type { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';
import { AiSettingsService } from './ai-settings.service';
import { MessageService } from '../message/message.service';
import { InboxSendPipelineService } from '../message/inbox-send-pipeline.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { SessionService } from '../session/session.service';
import { EventsGateway } from '../events/events.gateway';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import { shouldAutoReplyForBusinessHours } from './utils/ai-business-hours.util';
import { AiInboxAgentService } from './ai-inbox-agent.service';
import { AiCircuitBreakerService } from './ai-circuit-breaker.service';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import { isAllowedStaffPhone } from './utils/phone-match.util';
import { AiAuditService } from './ai-audit.service';
import type { CustomerAgentRunResult } from './ai-inbox-agent.service';
import { detectCustomerAiOptOut } from './utils/ai-customer-opt-out.util';
import { pickOptOutAckMessage } from './ai-opt-out.constants';
import { AiSignalService } from './ai-signal.service';
import { AiLearningInboxService } from './ai-learning-inbox.service';
import { CustomerProfileEnrichmentService } from './customer-profile-enrichment.service';
import { customerRejectedAlternative } from './utils/customer-name-detector.util';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';
import { AiCustomerIntent, AiEscalationReason } from './ai-signal.enums';
import { isPureGreeting, isPresenceIntent } from './utils/ai-intent-detector.util';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import {
  AiSendPermission,
  AiSendPermissionService,
} from '../whatsapp-safety/services/ai-send-permission.service';
import { WhatsAppSendQueueService } from '../whatsapp-safety/services/whatsapp-send-queue.service';
import {
  GREETING_ONLY_REPLY,
  REPEATED_DISCOUNT_ACK_REPLY,
  isInternalReasoningLeak,
  pickBurstQuotedMessageId,
  pickPresenceReply,
  pickRepeatedGreetingReply,
  sanitizeCustomerAiReply,
  shouldSendFullGreeting,
} from './utils/ai-behavior.util';
import {
  AiHumanTimingService,
  buildBurstCombinedText,
  buildBurstPromptInstruction,
  humanTimingConfigFromAiConfig,
  INSTANT_BURST_DEBOUNCE_MS,
} from './services/ai-human-timing.service';
import { AiProductNotFoundService } from './ai-product-not-found.service';
import { looksLikeProductQuery } from './utils/product-not-found-fallback.util';
import type { AiConfig } from './entities/ai-config.entity';
import { isAiUnrestricted } from './utils/ai-unrestricted.util';
import { AiProcessedMessageService } from './cost/ai-processed-message.service';
import { AiBudgetGuardService } from './cost/ai-budget-guard.service';
import { AiCostTrackerService } from './cost/ai-cost-tracker.service';
import { AiLearnedIntentService } from './learning/ai-learned-intent.service';
import { AiMessageBufferService } from './cost/ai-message-buffer.service';
import { AiIntentLearningService } from './learning/ai-intent-learning.service';
import { AiConfigCacheService } from './cost/ai-config-cache.service';
import { AiUsageFeature, AiUsageSource, AiUsageStatus } from './cost/ai-cost.types';
import { analyzeMessageContent } from '../whatsapp-safety/utils/whatsapp-content-safety.util';
import { randomUUID } from 'crypto';

/** WhatsApp typing state expires after ~25s — refresh while showing typing before send. */
const TYPING_REFRESH_MS = 20_000;

interface PendingAutoReply {
  timer: ReturnType<typeof setTimeout>;
  firstMessageAt: number;
  lastMessageAt: number;
  messages: IncomingMessage[];
  incomingTexts: string[];
  latestMsg: IncomingMessage;
  firstMsg: IncomingMessage;
  generation: number;
  conversationState?: string;
  waitReason?: string;
  waitBeforeProcessingMs?: number;
}

@Injectable()
export class AiInboxAutoReplyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiInboxAutoReplyService.name);
  /** Last AI send time per chat — only used when cooldown minutes > 0. */
  private readonly cooldownMap = new Map<string, number>();
  private readonly pendingReplies = new Map<string, PendingAutoReply>();
  /** Bumped when a newer customer message supersedes an in-flight auto-reply. */
  private readonly replyGeneration = new Map<string, number>();
  private readonly typingRefreshTimers = new Map<string, ReturnType<typeof setInterval>>();
  /** Chats where a staff member replied — skip AI until the customer writes again. */
  private readonly staffPausedChats = new Set<string>();

  constructor(
    private readonly hookManager: HookManager,
    private readonly aiSettings: AiSettingsService,
    private readonly inboxAgent: AiInboxAgentService,
    private readonly circuitBreaker: AiCircuitBreakerService,
    private readonly humanTiming: AiHumanTimingService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => InboxSendPipelineService))
    private readonly sendPipeline: InboxSendPipelineService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    private readonly eventsGateway: EventsGateway,
    private readonly aiAudit: AiAuditService,
    private readonly signalService: AiSignalService,
    @Inject(forwardRef(() => InauzwaSyncPreferencesService))
    private readonly inauzwaPreferences: InauzwaSyncPreferencesService,
    private readonly learningInbox: AiLearningInboxService,
    private readonly profileEnrichment: CustomerProfileEnrichmentService,
    private readonly aiSendPermission: AiSendPermissionService,
    private readonly safetySettings: WhatsAppSafetySettingsService,
    private readonly sendQueueService: WhatsAppSendQueueService,
    private readonly productNotFound: AiProductNotFoundService,
    private readonly processedMessages: AiProcessedMessageService,
    private readonly budgetGuard: AiBudgetGuardService,
    private readonly costTracker: AiCostTrackerService,
    private readonly learnedIntent: AiLearnedIntentService,
    private readonly messageBuffer: AiMessageBufferService,
    private readonly intentLearning: AiIntentLearningService,
    private readonly configCache: AiConfigCacheService,
  ) {}

  onModuleInit(): void {
    this.messageBuffer.registerProcessor(async payload => {
      const key = this.chatKey(payload.sessionId, payload.chatId);
      const generation = this.bumpReplyGeneration(key);
      const config = await this.aiSettings.getActiveConfig();
      const timingConfig = humanTimingConfigFromAiConfig(config ?? ({} as AiConfig));

      let waitMs = 0;
      try {
        const recent = await this.messageService.getChatMessagesForAi(
          payload.sessionId,
          payload.chatId,
          8,
        );
        const decision = this.humanTiming.decideProcessingWait({
          config: timingConfig,
          messages: recent.messages,
          burst: {
            firstMessageAt: Date.now() - 5000,
            lastMessageAt: Date.now(),
            messageCount: payload.messageIds.length,
          },
          incomingText: payload.combinedText,
        });
        waitMs = Math.min(decision.waitBeforeProcessingMs, 18_000);
      } catch {
        waitMs = 0;
      }
      if (waitMs > 0) await this.sleep(waitMs);
      if (this.isStaleReply(key, generation)) return;

      const texts = payload.combinedText.split('\n').filter(Boolean);
      const syntheticMessages: IncomingMessage[] = (payload.messageIds ?? []).map((id, i) => ({
        id,
        chatId: payload.chatId,
        body: texts[i] ?? texts[texts.length - 1] ?? '',
        fromMe: false,
        type: 'text',
      })) as IncomingMessage[];
      const latest =
        syntheticMessages[syntheticMessages.length - 1] ??
        ({
          id: payload.messageIds?.[payload.messageIds.length - 1],
          chatId: payload.chatId,
          body: payload.combinedText,
          fromMe: false,
          type: 'text',
        } as IncomingMessage);
      const burst: PendingAutoReply = {
        timer: setTimeout(() => undefined, 0),
        firstMessageAt: Date.now(),
        lastMessageAt: Date.now(),
        messages: syntheticMessages.length ? syntheticMessages : [latest],
        incomingTexts: texts.length ? texts : [payload.combinedText],
        latestMsg: latest,
        firstMsg: syntheticMessages[0] ?? latest,
        generation,
        waitReason: 'message_buffer',
      };
      await this.processAutoReply(payload.sessionId, payload.chatId, burst, generation, payload.batchId);
    });

    void this.inboxCrmService.healAllStaleAutoReplyStates().catch(err => {
      this.logger.warn(
        `Stale AI handling heal skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    this.hookManager.register(
      'ai-inbox-auto-reply',
      'message:sent',
      async ctx => {
        const data = ctx.data as {
          chatId?: string;
          staffId?: string;
          isAiGenerated?: boolean;
          source?: string | null;
        };
        const sessionId = ctx.sessionId;
        if (!sessionId || !data.chatId || !data.staffId) return { continue: true };
        if (data.isAiGenerated || data.source === 'ai-auto-reply') return { continue: true };
        const staffKey = `${sessionId}:${data.chatId}`;
        this.staffPausedChats.add(staffKey);
        const config = await this.aiSettings.getActiveConfig();
        const minutes = config?.manualTakeoverMinutes ?? 15;
        void this.inboxCrmService.takeOverFromStaffReply(sessionId, data.chatId, minutes);
        const sentText = (ctx.data as { text?: string }).text;
        if (sentText?.trim()) {
          void this.learningInbox.handleStaffCorrection(sessionId, data.chatId, sentText);
        }
        return { continue: true };
      },
      119,
    );

    this.hookManager.register(
      'ai-failed-message-retry',
      'message:failed',
      async ctx => {
        const data = ctx.data as {
          messageId?: string;
          isAiGenerated?: boolean;
          chatId?: string;
          error?: string;
        };
        const sessionId = ctx.sessionId;
        if (!sessionId || !data.messageId || !data.isAiGenerated) return { continue: true };
        void this.scheduleFailedAiRetry(sessionId, data.messageId, data.chatId ?? '', data.error ?? '');
        return { continue: true };
      },
      118,
    );

    this.hookManager.register(
      'ai-inbox-auto-reply',
      'message:received',
      async ctx => {
        const msg = ctx.data as IncomingMessage;
        const sessionId = ctx.sessionId;
        if (!sessionId || !msg?.chatId) return { continue: true };
        if (msg.fromMe || !isInboxChat(msg.chatId)) return { continue: true };
        if (msg.broadcast) return { continue: true };

        let incomingText = msg.body?.trim() ?? '';
        if (!incomingText && msg.media && msg.type && msg.type !== 'text') {
          incomingText = `[${msg.type}]`;
        }
        if (!incomingText) return { continue: true };

        void this.inboxCrmService.refreshAutoReplyGate(sessionId, msg.chatId);

        const session = await this.sessionService.findOne(sessionId);
        if (
          isAllowedStaffPhone(
            msg.from || msg.chatId,
            this.sessionService.getStaffAiAllowedNumbers(session),
          )
        ) {
          return { continue: true };
        }

        if (detectCustomerAiOptOut(incomingText, (await this.safetySettings.getForSession(sessionId)).optOutKeywords ?? [])) {
          const alreadyOptedOut = await this.inboxCrmService.isAiOptOut(sessionId, msg.chatId);
          if (!alreadyOptedOut) {
            await this.inboxCrmService.customerOptOutOfAi(sessionId, msg.chatId);
            this.eventsGateway.emitAiOptOut(sessionId, { chatId: msg.chatId, source: 'customer_message' });
            this.logger.log(`Customer opt-out of AI for ${sessionId}:${msg.chatId}`);
            void this.sendOptOutAcknowledgment(sessionId, msg.chatId, incomingText);
          }
          return { continue: true };
        }

        const key = `${sessionId}:${msg.chatId}`;
        if (this.staffPausedChats.has(key)) {
          this.staffPausedChats.delete(key);
        }

        void this.scheduleAutoReply(sessionId, msg.chatId, incomingText, msg);
        return { continue: true };
      },
      120,
    );
  }

  onModuleDestroy(): void {
    for (const pending of this.pendingReplies.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingReplies.clear();
    for (const key of [...this.typingRefreshTimers.keys()]) {
      const [sessionId, ...rest] = key.split(':');
      const chatId = rest.join(':');
      this.stopTypingIndicator(sessionId, chatId);
    }
  }

  private chatKey(sessionId: string, chatId: string): string {
    return `${sessionId}:${chatId}`;
  }

  private bumpReplyGeneration(key: string): number {
    const next = (this.replyGeneration.get(key) ?? 0) + 1;
    this.replyGeneration.set(key, next);
    return next;
  }

  private isStaleReply(key: string, generation: number): boolean {
    return this.replyGeneration.get(key) !== generation;
  }

  private async scheduleAutoReply(
    sessionId: string,
    chatId: string,
    incomingText: string,
    msg: IncomingMessage,
  ): Promise<void> {
    const key = this.chatKey(sessionId, chatId);
    const generation = this.bumpReplyGeneration(key);
    this.stopTypingIndicator(sessionId, chatId);
    this.eventsGateway.emitAiTyping(sessionId, { chatId, active: false });

    const config = await this.configCache.getActiveConfig();
    if (config?.messageBufferEnabled !== false) {
      try {
        await this.messageBuffer.enqueue({
          sessionId,
          chatId,
          messageId: msg.id ?? randomUUID(),
          text: incomingText,
          contactId: chatId,
        });
        if (msg.id && config?.ignoreDuplicateMessageIds !== false) {
          await this.processedMessages.markProcessed(
            sessionId,
            msg.id,
            AiUsageFeature.WHATSAPP_AUTO_REPLY,
            'buffered',
          );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Message buffer enqueue failed: ${errMsg}`);
      }
      return;
    }

    const now = Date.now();
    const existing = this.pendingReplies.get(key);

    if (existing) {
      clearTimeout(existing.timer);
      existing.incomingTexts.push(incomingText);
      existing.messages.push(msg);
      existing.latestMsg = msg;
      existing.lastMessageAt = now;
      existing.generation = generation;
    } else {
      this.pendingReplies.set(key, {
        timer: setTimeout(() => undefined, 0),
        firstMessageAt: now,
        lastMessageAt: now,
        messages: [msg],
        incomingTexts: [incomingText],
        latestMsg: msg,
        firstMsg: msg,
        generation,
      });
    }

    const pending = this.pendingReplies.get(key)!;
    const timingConfig = humanTimingConfigFromAiConfig(config ?? ({} as AiConfig));

    const burst = {
      firstMessageAt: pending.firstMessageAt,
      lastMessageAt: pending.lastMessageAt,
      messageCount: pending.incomingTexts.length,
    };
    const instantFallback =
      burst.messageCount > 1 && !timingConfig.humanTimingEnabled
        ? INSTANT_BURST_DEBOUNCE_MS
        : 0;
    let waitMs = instantFallback;
    let timingReason = 'fallback';
    let conversationState = 'unknown';
    try {
      const recent = await this.messageService.getChatMessagesForAi(sessionId, chatId, 12);
      const decision = this.humanTiming.decideProcessingWait({
        config: timingConfig,
        messages: recent.messages,
        burst,
        incomingText: pending.incomingTexts[pending.incomingTexts.length - 1] ?? incomingText,
      });
      waitMs = decision.waitBeforeProcessingMs;
      timingReason = decision.reason;
      conversationState = decision.conversationState;
      pending.conversationState = decision.conversationState;
      pending.waitReason = decision.reason;
      pending.waitBeforeProcessingMs = waitMs;
    } catch {
      waitMs = instantFallback;
    }

    this.logger.debug(
      `AI timing schedule ${this.maskChatKey(key)}: state=${conversationState} wait=${waitMs}ms burst=${pending.incomingTexts.length} reason=${timingReason}`,
    );

    pending.timer = setTimeout(() => {
      if (this.isStaleReply(key, generation)) return;
      const burst = this.pendingReplies.get(key);
      this.pendingReplies.delete(key);
      if (!burst) return;
      void this.processAutoReply(sessionId, chatId, burst, generation);
    }, waitMs);
  }

  private startTypingIndicator(sessionId: string, chatId: string): void {
    const key = this.chatKey(sessionId, chatId);
    if (this.typingRefreshTimers.has(key)) return;

    const pulse = (): void => {
      void this.messageService.sendTyping(sessionId, chatId);
    };
    pulse();

    const interval = setInterval(pulse, TYPING_REFRESH_MS);
    this.typingRefreshTimers.set(key, interval);
  }

  private stopTypingIndicator(sessionId: string, chatId: string): void {
    const key = this.chatKey(sessionId, chatId);
    const interval = this.typingRefreshTimers.get(key);
    if (interval) {
      clearInterval(interval);
      this.typingRefreshTimers.delete(key);
    }
    void this.messageService.clearTyping(sessionId, chatId);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private logSkip(key: string, reason: string): void {
    this.logger.debug(`AI auto-reply skipped (${this.maskChatKey(key)}): ${reason}`);
  }

  private maskChatKey(key: string): string {
    const parts = key.split(':');
    if (parts.length < 2) return key;
    const chatId = parts.slice(1).join(':');
    const masked = chatId.replace(/\d{4,}/g, m => `${m.slice(0, 2)}***${m.slice(-2)}`);
    return `${parts[0]}:${masked}`;
  }

  private async finalizeZeroCostReply(
    key: string,
    sessionId: string,
    burst: PendingAutoReply,
    latestMessageId?: string,
    config?: AiConfig | null,
  ): Promise<void> {
    await this.markBurstProcessed(sessionId, burst.messages, latestMessageId);
    const cooldownSeconds = config?.autoReplyCooldownSeconds ?? 60;
    if (cooldownSeconds > 0) {
      this.cooldownMap.set(key, Date.now());
    } else {
      const cooldownMinutes = config?.autoReplyCooldownMinutes ?? 0;
      if (cooldownMinutes > 0) {
        this.cooldownMap.set(key, Date.now());
      }
    }
  }

  private async markBurstProcessed(
    sessionId: string,
    messages: IncomingMessage[],
    latestMessageId?: string,
  ): Promise<void> {
    const ids = new Set<string>();
    for (const m of messages) {
      if (m.id) ids.add(m.id);
    }
    if (latestMessageId) ids.add(latestMessageId);
    for (const id of ids) {
      await this.processedMessages.markProcessed(sessionId, id, AiUsageFeature.WHATSAPP_AUTO_REPLY);
    }
  }

  private async sendOptOutAcknowledgment(
    sessionId: string,
    chatId: string,
    customerMessage: string,
  ): Promise<void> {
    try {
      const config = await this.aiSettings.getActiveConfig();
      if (!config?.autoReplyEnabled) return;

      const text = pickOptOutAckMessage(config.autoReplyOptOutMessage, customerMessage);
      await this.sendPipeline.sendAutomated({
        sessionId,
        chatId,
        text,
        source: 'ai-opt-out-ack',
      });
      this.aiAudit.logAiReply(sessionId, chatId, { source: 'opt_out_ack' });
    } catch (err: unknown) {
      this.logger.warn(
        `Opt-out acknowledgment failed for ${sessionId}:${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private isQueuedSendError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.includes('queued for safe delivery');
  }

  private async handleQueuedAiSend(sessionId: string, chatId: string): Promise<void> {
    const item = await this.sendQueueService.findLatestPendingForChat(sessionId, chatId);
    const scheduledAt = item?.scheduledAt ?? new Date(Date.now() + 30_000);
    const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());
    this.eventsGateway.emitAiSendQueued(sessionId, {
      chatId,
      queueItemId: item?.id ?? '',
      scheduledAt: scheduledAt.toISOString(),
      delayMs,
    });
  }

  private async scheduleFailedAiRetry(
    sessionId: string,
    messageId: string,
    chatId: string,
    error: string,
  ): Promise<void> {
    const lower = error.toLowerCase();
    if (
      lower.includes('qr') ||
      lower.includes('scan') ||
      lower.includes('safety') ||
      lower.includes('blocked') ||
      lower.includes('not connected')
    ) {
      return;
    }
    const config = await this.aiSettings.getActiveConfig();
    const maxRetries = config?.aiFailedSendMaxRetries ?? 3;
    const delayMs = 15_000;
    await this.sleep(delayMs);
    try {
      const message = await this.messageService.findMessageById(messageId);
      const meta = (message.metadata ?? {}) as Record<string, unknown>;
      const retryCount = Number(meta.retryCount ?? 0);
      if (retryCount >= maxRetries || meta.retryable === false) return;
      await this.messageService.resendExistingOutgoingMessage(message, { source: 'ai-auto-retry' });
    } catch (err: unknown) {
      this.logger.warn(
        `AI auto-retry failed for ${sessionId}:${chatId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      void this.inboxCrmService.recordAiFailure(sessionId, chatId);
    }
  }

  private pickBurstFocusText(texts: string[], predicate: (t: string) => boolean): string | null {
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      if (predicate(texts[i])) return texts[i];
    }
    return null;
  }

  private async tryProductNotFoundFallback(params: {
    sessionId: string;
    chatId: string;
    incomingText: string;
    branchId?: string | null;
    messageId?: string | null;
    key: string;
    generation: number;
    sendCtx: Record<string, unknown>;
    processStartedAt: number;
  }): Promise<boolean> {
    const resolved = await this.productNotFound.tryResolveNotFoundReply({
      sessionId: params.sessionId,
      chatId: params.chatId,
      incomingText: params.incomingText,
      branchId: params.branchId,
      messageId: params.messageId,
    });
    if (!resolved?.reply) return false;
    if (this.staffPausedChats.has(params.key) || this.isStaleReply(params.key, params.generation)) {
      return false;
    }
    const result: CustomerAgentRunResult = {
      content: resolved.reply,
      escalated: false,
      actions: [],
    };
    await this.sendCustomerAiReply(params.sessionId, params.chatId, resolved.reply, result, {
      ...(params.sendCtx ?? {}),
      detectedIntent: AiCustomerIntent.PRODUCT_SEARCH,
      generationMs: Date.now() - params.processStartedAt,
      delayReason: 'product_not_found_fallback',
    });
    void this.signalService.recordReply({
      sessionId: params.sessionId,
      chatId: params.chatId,
      incomingText: params.incomingText,
      replyText: resolved.reply,
      escalated: false,
      branchId: params.branchId ?? null,
      detectedIntent: AiCustomerIntent.PRODUCT_SEARCH,
    });
    await this.inboxCrmService.resetAiFailures(params.sessionId, params.chatId);
    await this.inboxCrmService.setAiHandlingState(
      params.sessionId,
      params.chatId,
      InboxAiHandlingState.IDLE,
    );
    return true;
  }

  private async sendCustomerAiReply(
    sessionId: string,
    chatId: string,
    text: string,
    agentResult: CustomerAgentRunResult,
    extras?: {
      detectedIntent?: string | null;
      isOptedOut?: boolean;
      quotedMessageId?: string | null;
      burstMessageIds?: string[];
      burstWaMessageIds?: string[];
      hasComplexLookup?: boolean;
      config?: AiConfig | null;
      replyGeneration?: number;
      chatKey?: string;
      burstWaitMs?: number;
      generationMs?: number;
      delayReason?: string;
      conversationState?: string;
      timingReason?: string;
      waitBeforeProcessingMs?: number;
      burstMessageCount?: number;
    },
  ): Promise<'sent' | 'queued' | 'skipped'> {
    const key = extras?.chatKey ?? this.chatKey(sessionId, chatId);
    const generation = extras?.replyGeneration;
    const sendStartedAt = Date.now();

    if (generation != null && this.isStaleReply(key, generation)) {
      this.logSkip(key, 'superseded before send prep');
      return 'skipped';
    }

    if (isInternalReasoningLeak(text)) {
      this.logger.warn(`AI internal reasoning blocked for ${sessionId}:${chatId}`);
      await this.inboxCrmService.escalateToHuman(sessionId, chatId, 'AI reasoning leak blocked');
      this.eventsGateway.emitAiEscalated(sessionId, { chatId, reason: 'AI reasoning leak blocked' });
      return 'skipped';
    }

    const outboundText = sanitizeCustomerAiReply(text);
    if (!outboundText.trim()) {
      this.logger.warn(`AI reply empty after sanitization for ${sessionId}:${chatId}`);
      return 'skipped';
    }

    const permission = await this.aiSendPermission.evaluate({
      sessionId,
      chatId,
      proposedReply: outboundText,
      aiConfidence: agentResult.escalated ? 0.4 : 0.85,
      isHighRiskIntent: agentResult.escalated,
      detectedIntent: extras?.detectedIntent ?? null,
      isGroup: false,
      isOptedOut: extras?.isOptedOut,
      aiUnrestrictedMode: isAiUnrestricted(extras?.config),
    });

    if (permission.permission === AiSendPermission.BLOCK_SEND) {
      this.logger.debug(`AI send blocked for ${sessionId}:${chatId}: ${permission.reason}`);
      await this.inboxCrmService.escalateToHuman(sessionId, chatId, permission.reason);
      this.eventsGateway.emitAiEscalated(sessionId, { chatId, reason: permission.reason });
      return 'skipped';
    }

    if (permission.permission === AiSendPermission.REQUIRE_ADMIN_APPROVAL) {
      await this.inboxCrmService.escalateToHuman(sessionId, chatId, permission.reason);
      this.eventsGateway.emitAiEscalated(sessionId, { chatId, reason: permission.reason });
      if (permission.suggestedStaffReply) {
        void this.learningInbox.handleLowConfidence({
          sessionId,
          chatId,
          incomingText: permission.suggestedStaffReply,
          branchId: null,
          confidenceScore: agentResult.escalated ? 0.4 : 0.85,
          detectedIntent: extras?.detectedIntent ?? null,
          whyUnsure: permission.reason,
        });
      }
      return 'skipped';
    }

    const timingConfig = humanTimingConfigFromAiConfig(extras?.config ?? ({} as AiConfig));
    const unrestricted = isAiUnrestricted(extras?.config);
    const typingDecision = unrestricted
      ? { shouldShowTyping: false, typingDurationMs: 0, reason: 'unrestricted' }
      : this.humanTiming.decideTyping({
          config: timingConfig,
          replyText: outboundText,
          hasComplexLookup: extras?.hasComplexLookup,
        });

    let typingMs = 0;
    try {
      if (typingDecision.shouldShowTyping) {
        if (generation != null && this.isStaleReply(key, generation)) {
          this.logSkip(key, 'superseded before typing');
          return 'skipped';
        }
        this.startTypingIndicator(sessionId, chatId);
        this.eventsGateway.emitAiTyping(sessionId, { chatId, active: true });
        typingMs = typingDecision.typingDurationMs;
        await this.sleep(typingMs);
        if (generation != null && this.isStaleReply(key, generation)) {
          this.logSkip(key, 'superseded during typing');
          return 'skipped';
        }
      }

      const useQuoted =
        extras?.config?.autoReplyUseQuotedReply !== false && !!extras?.quotedMessageId?.trim();

      const sendMeta = {
        source: 'ai-auto-reply' as const,
        aiConfidence: unrestricted ? 0.85 : agentResult.escalated ? 0.4 : 0.85,
        isHighRiskIntent: unrestricted ? false : agentResult.escalated,
        detectedIntent: extras?.detectedIntent ?? undefined,
        aiUnrestrictedMode: unrestricted || undefined,
        ai: {
          provider: agentResult.provider,
          model: agentResult.model,
          latencyMs: agentResult.latencyMs,
        },
        repliedToWaMessageId: extras?.quotedMessageId ?? undefined,
        burstMessageIds: extras?.burstMessageIds,
        burstWaMessageIds: extras?.burstWaMessageIds,
      };

      const sendAt = Date.now();
      let sendOutcome: 'sent' | 'queued' = 'sent';
      try {
        if (useQuoted && extras?.quotedMessageId) {
          await this.sendPipeline.sendAutomated({
            sessionId,
            chatId,
            text: outboundText,
            quotedMessageId: extras.quotedMessageId,
            source: 'ai-auto-reply',
            sendContext: sendMeta,
          });
        } else {
          await this.sendPipeline.sendAutomated({
            sessionId,
            chatId,
            text: outboundText,
            source: 'ai-auto-reply',
            sendContext: sendMeta,
          });
        }
      } catch (err: unknown) {
        if (this.isQueuedSendError(err)) {
          await this.handleQueuedAiSend(sessionId, chatId);
          sendOutcome = 'queued';
        } else if (useQuoted) {
          this.logger.warn(
            `Quoted AI reply failed for ${sessionId}:${chatId}, falling back to normal send: ${err instanceof Error ? err.message : String(err)}`,
          );
          try {
            await this.sendPipeline.sendAutomated({
              sessionId,
              chatId,
              text: outboundText,
              source: 'ai-auto-reply',
              sendContext: sendMeta,
            });
          } catch (fallbackErr: unknown) {
            if (this.isQueuedSendError(fallbackErr)) {
              await this.handleQueuedAiSend(sessionId, chatId);
              sendOutcome = 'queued';
            } else {
              throw fallbackErr;
            }
          }
        } else {
          throw err;
        }
      }

      const sendMs = Date.now() - sendAt;
      const totalMs = Date.now() - sendStartedAt;
      if (sendOutcome === 'queued') {
        this.logger.log(
          `AI reply queued for safe delivery ${this.maskChatKey(key)}: generation=${extras?.generationMs ?? 0}ms typing=${typingMs}ms queueWait=${sendMs}ms total=${totalMs}ms intent=${extras?.detectedIntent ?? 'n/a'}`,
        );
      } else {
        this.logger.log(
          `AI reply timing ${this.maskChatKey(key)}: state=${extras?.conversationState ?? 'n/a'} wait=${extras?.waitBeforeProcessingMs ?? extras?.burstWaitMs ?? 0}ms burst=${extras?.burstMessageCount ?? 0} generation=${extras?.generationMs ?? 0}ms typing=${typingMs}ms send=${sendMs}ms total=${totalMs}ms reason=${extras?.timingReason ?? extras?.delayReason ?? 'n/a'} intent=${extras?.detectedIntent ?? 'n/a'}`,
        );
      }

      this.aiAudit.logAiReply(sessionId, chatId, {
        provider: agentResult.provider,
        model: agentResult.model,
        latencyMs: agentResult.latencyMs,
        escalated: agentResult.escalated,
        source: 'customer_agent',
      });
      return sendOutcome;
    } finally {
      this.stopTypingIndicator(sessionId, chatId);
      this.eventsGateway.emitAiTyping(sessionId, { chatId, active: false });
    }
  }

  private async processAutoReply(
    sessionId: string,
    chatId: string,
    burst: PendingAutoReply,
    generation: number,
    batchId?: string,
  ): Promise<void> {
    const key = this.chatKey(sessionId, chatId);
    const processStartedAt = Date.now();
    const burstWaitMs = processStartedAt - burst.firstMessageAt;
    const incomingText =
      burst.incomingTexts.length > 1
        ? buildBurstCombinedText(burst.incomingTexts)
        : burst.incomingTexts[0] ?? '';
    const msg = burst.latestMsg;
    const burstWaMessageIds = burst.messages.map(m => m.id).filter(Boolean);
    const burstMessageIds = burstWaMessageIds;

    try {
      if (this.isStaleReply(key, generation)) {
        this.logSkip(key, 'superseded by newer customer message');
        return;
      }
      const config = await this.configCache.getActiveConfig();
      const quotedMessageId = pickBurstQuotedMessageId(
        burst.messages,
        config?.replyToBurstLatestMessage !== false,
      );
      const sendCtx = {
        config,
        quotedMessageId,
        burstMessageIds,
        burstWaMessageIds,
        replyGeneration: generation,
        chatKey: key,
        burstWaitMs,
        conversationState: burst.conversationState,
        timingReason: burst.waitReason,
        waitBeforeProcessingMs: burst.waitBeforeProcessingMs,
        burstMessageCount: burst.incomingTexts.length,
      };
      this.logger.debug(
        `AI auto-reply processing ${this.maskChatKey(key)}: burst=${burst.incomingTexts.length} state=${burst.conversationState ?? 'n/a'} wait=${burst.waitBeforeProcessingMs ?? burstWaitMs}ms reason=${burst.waitReason ?? 'n/a'}`,
      );
      if (!config?.autoReplyEnabled) {
        this.logSkip(key, 'auto-reply disabled globally');
        return;
      }
      if (config.autoReplyPaused) {
        this.logSkip(key, 'auto-reply paused (budget or manual)');
        return;
      }
      if (config.aiBudgetPaused && config.stopAutoReplyWhenBudgetExceeded) {
        this.logSkip(key, 'budget_paused');
        return;
      }
      if (msg.isGroup) {
        const leadCaptured = await this.signalService.processGroupLead(
          sessionId,
          chatId,
          incomingText,
        );
        this.logSkip(key, leadCaptured ? 'group chat — lead captured' : 'group chat');
        return;
      }

      const session = await this.sessionService.findOne(sessionId);
      if (!this.sessionService.isAiAutoReplyEnabledForSession(session)) {
        this.logSkip(key, 'disabled for session');
        return;
      }

      const autoReplyGate = await this.inboxCrmService.refreshAutoReplyGate(sessionId, chatId);
      if (!autoReplyGate.canAutoReply) {
        this.logSkip(key, autoReplyGate.blockReason ?? 'auto-reply blocked for chat');
        return;
      }

      if (this.circuitBreaker.isOpen(sessionId)) {
        this.logSkip(key, 'circuit breaker open');
        await this.inboxCrmService.escalateToHuman(sessionId, chatId, 'AI temporarily unavailable');
        this.eventsGateway.emitAiEscalated(sessionId, { chatId, reason: 'circuit_breaker' });
        return;
      }

      if (
        !shouldAutoReplyForBusinessHours(
          {
            timezone: config.autoReplyTimezone ?? 'Africa/Dar_es_Salaam',
            startHour: config.autoReplyStartHour ?? 9,
            endHour: config.autoReplyEndHour ?? 17,
            weekdays: config.autoReplyWeekdays ?? [1, 2, 3, 4, 5],
          },
          config.autoReplyOutsideHoursOnly,
        )
      ) {
        this.logSkip(key, 'outside configured business hours');
        return;
      }

      const cooldownSeconds = config.autoReplyCooldownSeconds ?? 60;
      if (cooldownSeconds > 0) {
        const bounded = Math.min(Math.max(cooldownSeconds, 1), 86400);
        const cooldownMs = bounded * 1000;
        const now = Date.now();
        const lastSent = this.cooldownMap.get(key) ?? 0;
        if (now - lastSent < cooldownMs) {
          this.logSkip(
            key,
            `cooldown (${bounded}s, ${Math.ceil((cooldownMs - (now - lastSent)) / 1000)}s left)`,
          );
          return;
        }
      } else {
        const cooldownMinutes = config.autoReplyCooldownMinutes ?? 0;
        if (cooldownMinutes > 0) {
          const bounded = Math.min(Math.max(cooldownMinutes, 1), 1440);
          const cooldownMs = bounded * 60 * 1000;
          const now = Date.now();
          const lastSent = this.cooldownMap.get(key) ?? 0;
          if (now - lastSent < cooldownMs) {
            this.logSkip(
              key,
              `cooldown (${bounded} min, ${Math.ceil((cooldownMs - (now - lastSent)) / 1000)}s left)`,
            );
            return;
          }
        }
      }

      if (config.ignoreDuplicateMessageIds !== false && msg.id) {
        const already = await this.processedMessages.wasProcessed(
          sessionId,
          msg.id,
          AiUsageFeature.WHATSAPP_AUTO_REPLY,
        );
        if (already) {
          this.logSkip(key, 'duplicate message id already processed');
          void this.costTracker.recordUsage({
            context: {
              feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
              source: AiUsageSource.CUSTOMER_MESSAGE,
              conversationId: chatId,
              messageId: msg.id,
            },
            provider: 'none',
            model: 'none',
            inputTokens: 0,
            outputTokens: 0,
            status: AiUsageStatus.DUPLICATE_SKIPPED,
          });
          return;
        }
      }

      if (config.ignorePromotionalMessages !== false) {
        const contentSafety = analyzeMessageContent(incomingText);
        if (!contentSafety.safe && contentSafety.riskLevel === 'high') {
          this.logSkip(key, `promotional/suspicious content (${contentSafety.flags.join(',')})`);
          return;
        }
      }

      await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.AI_HANDLING);

      const prefs = await this.inauzwaPreferences.get();
      const branchId =
        (await this.inboxCrmService.getPreferredBranchId(sessionId, chatId)) ??
        prefs.branchId?.trim() ??
        null;

      void this.intentLearning.extractAndPersistFacts({
        conversationId: `${sessionId}:${chatId}`,
        text: incomingText,
        branchId,
        contactId: chatId,
        messageId: msg.id,
      });

      const recentForCompat = await this.messageService.getChatMessagesForAi(sessionId, chatId, 12);
      const lastAssistantMessage = [...recentForCompat.messages]
        .reverse()
        .find(m => m.direction === 'outgoing')
        ?.body;

      const latestCustomerText = burst.incomingTexts[burst.incomingTexts.length - 1] ?? incomingText;
      const productFocusText =
        this.pickBurstFocusText(burst.incomingTexts, looksLikeProductQuery) ?? latestCustomerText;
      const presenceFocusText =
        this.pickBurstFocusText(burst.incomingTexts, isPresenceIntent) ?? latestCustomerText;

      const profileDecision = await this.profileEnrichment.processIncomingMessage({
        sessionId,
        chatId,
        incomingText: latestCustomerText,
        messageId: msg.id,
        previousAiMessage: lastAssistantMessage,
        isGroup: false,
        customerAskedUrgentProductQuestion: !isPureGreeting(latestCustomerText),
        alternativeRejected: customerRejectedAlternative(latestCustomerText),
        wantedProduct: null,
        profileContext: 'general',
      });

      if (profileDecision?.replyText && profileDecision.skipAgent) {
        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          const profResult: CustomerAgentRunResult = {
            content: profileDecision.replyText,
            escalated: false,
            actions: [],
          };
          await this.sendCustomerAiReply(sessionId, chatId, profileDecision.replyText, profResult, {
            ...sendCtx,
            generationMs: Date.now() - processStartedAt,
            delayReason: 'profile_enrichment',
          });
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText: latestCustomerText,
            replyText: profileDecision.replyText,
            escalated: false,
            branchId,
            detectedIntent: null,
          });
          if (profileDecision.recordQuestionAsked) {
            await this.profileEnrichment.recordQuestionAsked(
              sessionId,
              chatId,
              profileDecision.recordQuestionAsked,
            );
          }
        }
        await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }

      const profileQuestionHint = profileDecision?.profileQuestionHint;

      const latestHasMedia =
        Boolean(msg.media) && msg.type != null && msg.type !== 'text';
      const signal = await this.signalService.processIncoming(
        sessionId,
        chatId,
        latestCustomerText,
        branchId,
        {
          lastAssistantMessage,
          unrestricted: isAiUnrestricted(config),
          hasMedia: latestHasMedia,
        },
      );

      if (signal.deterministicReply) {
        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          const det: CustomerAgentRunResult = {
            content: signal.deterministicReply,
            escalated: false,
            actions: [],
          };
          await this.sendCustomerAiReply(sessionId, chatId, signal.deterministicReply, det, {
            ...sendCtx,
            detectedIntent: signal.intent,
            hasComplexLookup: true,
            generationMs: Date.now() - processStartedAt,
            delayReason: 'deterministic_signal',
          });
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText: latestCustomerText,
            replyText: signal.deterministicReply,
            escalated: false,
            branchId: signal.branchId ?? branchId,
            signalType: signal.signalType,
            detectedIntent: signal.intent,
          });
        }
        await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }

      if (config.presenceIntentEnabled !== false && isPresenceIntent(presenceFocusText)) {
        const presenceReply = pickPresenceReply({
          incomingText: presenceFocusText,
          messages: recentForCompat.messages,
          customerWaitingAfterDelay: burst.incomingTexts.length > 1,
        });
        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          const presenceResult: CustomerAgentRunResult = {
            content: presenceReply,
            escalated: false,
            actions: [],
          };
          await this.sendCustomerAiReply(sessionId, chatId, presenceReply, presenceResult, {
            ...sendCtx,
            detectedIntent: AiCustomerIntent.PRESENCE,
            generationMs: Date.now() - processStartedAt,
            delayReason: 'presence_fast_path',
          });
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText: presenceFocusText,
            replyText: presenceReply,
            escalated: false,
            branchId,
            detectedIntent: AiCustomerIntent.PRESENCE,
          });
        }
        await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }

      if (isPureGreeting(latestCustomerText) && !looksLikeProductQuery(productFocusText)) {
        const greetingCooldown = config.greetingRepeatCooldownMinutes ?? 240;
        const sendFull = shouldSendFullGreeting({
          incomingText: latestCustomerText,
          isPureGreeting: true,
          messages: recentForCompat.messages,
          greetingCooldownMinutes: greetingCooldown,
        });
        const greetingReply = sendFull
          ? GREETING_ONLY_REPLY
          : pickRepeatedGreetingReply(recentForCompat.messages);

        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          const greetingResult: CustomerAgentRunResult = {
            content: greetingReply,
            escalated: false,
            actions: [],
          };
          await this.sendCustomerAiReply(sessionId, chatId, greetingReply, greetingResult, {
            ...sendCtx,
            detectedIntent: AiCustomerIntent.GREETING,
            generationMs: Date.now() - processStartedAt,
            delayReason: 'greeting_fast_path',
          });
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText: latestCustomerText,
            replyText: greetingReply,
            escalated: false,
            branchId,
            detectedIntent: AiCustomerIntent.GREETING,
          });
          void this.intentLearning.maybeLearnFromPhrase({
            phrase: latestCustomerText,
            suggestedReply: greetingReply,
            branchId,
            conversationId: `${sessionId}:${chatId}`,
            messageId: msg.id,
            intentOverride: 'greeting',
          });
        }
        await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }

      if (
        looksLikeProductQuery(productFocusText) &&
        (await this.tryProductNotFoundFallback({
          sessionId,
          chatId,
          incomingText: productFocusText,
          branchId,
          messageId: msg.id,
          key,
          generation,
          sendCtx,
          processStartedAt,
        }))
      ) {
        return;
      }

      if (signal.skipAgent) {
        if (signal.escalate) {
          await this.inboxCrmService.escalateToHuman(
            sessionId,
            chatId,
            signal.escalationReason ?? 'AI escalated',
          );
          this.eventsGateway.emitAiEscalated(sessionId, {
            chatId,
            reason: signal.escalationReason ?? 'signal',
          });
          const ack =
            signal.escalationReason === AiEscalationReason.REPEATED_DISCOUNT
              ? REPEATED_DISCOUNT_ACK_REPLY
              : 'Thanks for your patience — a team member will assist you shortly.';
          if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
            await this.sendCustomerAiReply(
              sessionId,
              chatId,
              ack,
              { content: ack, escalated: true, actions: [] },
              {
                ...sendCtx,
                generationMs: Date.now() - processStartedAt,
                delayReason: 'escalation_ack',
              },
            );
          }
        }
        return;
      }

      const learnedHit = await this.learnedIntent.tryReply({
        text: incomingText,
        branchId,
        contactId: chatId,
        conversationId: `${sessionId}:${chatId}`,
      });

      if (learnedHit.hit) {
        const cached: CustomerAgentRunResult = {
          content: learnedHit.reply,
          escalated: false,
          actions: [],
        };
        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          await this.sendCustomerAiReply(sessionId, chatId, learnedHit.reply, cached, {
            ...sendCtx,
            generationMs: Date.now() - processStartedAt,
            delayReason: 'learned_intent_cache',
          });
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText,
            replyText: learnedHit.reply,
            escalated: false,
            branchId,
            detectedIntent: learnedHit.intent as AiCustomerIntent,
          });
        }
        void this.costTracker.recordUsage({
          context: {
            feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
            source: AiUsageSource.CUSTOMER_MESSAGE,
            branchId,
            conversationId: chatId,
            messageId: msg.id,
          },
          provider: 'cache',
          model: 'learned_intent',
          inputTokens: 0,
          outputTokens: 0,
          status: AiUsageStatus.CACHE_HIT,
          metadata: {
            intentId: learnedHit.intentId,
            intent: learnedHit.intent,
            matchType: learnedHit.matchType,
          },
        });
        await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }

      void this.costTracker.recordUsage({
        context: {
          feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
          source: AiUsageSource.CUSTOMER_MESSAGE,
          branchId,
          conversationId: chatId,
          messageId: msg.id,
          batchId: batchId ?? undefined,
        },
        provider: 'cache',
        model: 'learned_intent',
        inputTokens: 0,
        outputTokens: 0,
        status: AiUsageStatus.CACHE_MISS,
      });

      if (
        signal.intent === AiCustomerIntent.UNKNOWN &&
        incomingText.length < 120 &&
        config.learnedReplyCacheEnabled !== false
      ) {
        const classifierHit = await this.intentLearning.tryClassifierBeforeAgent({
          text: incomingText,
          branchId: signal.branchId ?? branchId,
          conversationId: `${sessionId}:${chatId}`,
          contactId: chatId,
          messageId: msg.id,
        });
        if (classifierHit.hit) {
          const classified: CustomerAgentRunResult = {
            content: classifierHit.reply,
            escalated: false,
            actions: [],
          };
          if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
            await this.sendCustomerAiReply(sessionId, chatId, classifierHit.reply, classified, {
              ...sendCtx,
              generationMs: Date.now() - processStartedAt,
              delayReason: 'classifier_fast_path',
            });
            void this.signalService.recordReply({
              sessionId,
              chatId,
              incomingText,
              replyText: classifierHit.reply,
              escalated: false,
              branchId,
              detectedIntent: classifierHit.intent as AiCustomerIntent,
            });
          }
          void this.costTracker.recordUsage({
            context: {
              feature: AiUsageFeature.WHATSAPP_AUTO_REPLY,
              source: AiUsageSource.CUSTOMER_MESSAGE,
              branchId,
              conversationId: chatId,
              messageId: msg.id,
              batchId: batchId ?? undefined,
            },
            provider: 'cache',
            model: 'learned_intent_classifier',
            inputTokens: 0,
            outputTokens: 0,
            status: AiUsageStatus.CACHE_HIT,
            metadata: {
              intent: classifierHit.intent,
              confidence: classifierHit.confidence,
              source: 'classifier_fast_path',
            },
          });
          await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
          await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
          return;
        }
      }

      const learningDecision = await this.learningInbox.decideBeforeAgent(
        sessionId,
        chatId,
        incomingText,
        0.5,
        isAiUnrestricted(config),
      );

      if (learningDecision.useApprovedAnswer) {
        const approved: CustomerAgentRunResult = {
          content: learningDecision.useApprovedAnswer,
          escalated: false,
          actions: [],
        };
        if (learningDecision.knowledgeId) {
          void this.learningInbox.markPendingKnowledgeOutcome(
            sessionId,
            chatId,
            learningDecision.knowledgeId,
            learningDecision.sourceItemId,
          );
        }
        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          await this.sendCustomerAiReply(
            sessionId,
            chatId,
            learningDecision.useApprovedAnswer,
            approved,
            {
              ...sendCtx,
              generationMs: Date.now() - processStartedAt,
              delayReason: 'approved_knowledge',
            },
          );
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText,
            replyText: learningDecision.useApprovedAnswer,
            escalated: false,
            branchId,
            signalType: signal.signalType,
            detectedIntent: signal.intent,
          });
        }
        await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }

      if (learningDecision.shouldEscalateLowConfidence && learningDecision.waitingReply) {
        const wait: CustomerAgentRunResult = {
          content: learningDecision.waitingReply,
          escalated: false,
          actions: [],
        };
        if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
          await this.sendCustomerAiReply(sessionId, chatId, learningDecision.waitingReply, wait, {
            ...sendCtx,
            generationMs: Date.now() - processStartedAt,
            delayReason: 'low_confidence_wait',
          });
          void this.signalService.recordReply({
            sessionId,
            chatId,
            incomingText,
            replyText: learningDecision.waitingReply,
            escalated: false,
            branchId,
            signalType: signal.signalType,
            detectedIntent: signal.intent,
          });
        }
        void this.learningInbox.handleLowConfidence({
          sessionId,
          chatId,
          incomingText,
          branchId: signal.branchId ?? branchId,
          confidenceScore: learningDecision.confidenceScore,
          detectedIntent: signal.intent,
          whyUnsure: 'No approved knowledge match and low RAG confidence',
        });
        return;
      }

      const burstPrompt =
        burst.incomingTexts.length > 1 ? buildBurstPromptInstruction() : undefined;

      const requestId = randomUUID();
      const generationStartedAt = Date.now();
      const agentResult = await this.inboxAgent.runCustomerAgent({
        sessionId,
        chatId,
        incomingText,
        branchId: signal.branchId ?? branchId,
        messageId: msg.id,
        requestId,
        batchId: batchId ?? undefined,
        injectPromptBlock: [signal.injectPromptBlock, burstPrompt].filter(Boolean).join('\n\n') || undefined,
        profileQuestionHint,
        onEscalate: async reason => {
          await this.inboxCrmService.escalateToHuman(sessionId, chatId, reason);
          this.eventsGateway.emitAiEscalated(sessionId, { chatId, reason });
        },
      });

      if (agentResult.exceededAiCallLimit) {
        await this.inboxCrmService.escalateToHuman(
          sessionId,
          chatId,
          'needs_human_review — complex request exceeded AI call limit',
        );
      }

      if (agentResult.escalated) {
        this.circuitBreaker.recordSuccess(sessionId);
        if (agentResult.content) {
          if (!this.staffPausedChats.has(key) && !this.isStaleReply(key, generation)) {
            await this.sendCustomerAiReply(sessionId, chatId, agentResult.content, agentResult, {
              ...sendCtx,
              detectedIntent: signal.intent,
              hasComplexLookup: (agentResult.actions?.length ?? 0) > 0,
              generationMs: Date.now() - generationStartedAt,
              delayReason: 'agent_escalation',
            });
          }
        }
        this.logger.log(`AI escalated to human for ${key}`);
        return;
      }

      const reply = agentResult.content;
      if (!reply) {
        const fallbackSent = await this.tryProductNotFoundFallback({
          sessionId,
          chatId,
          incomingText: productFocusText,
          branchId,
          messageId: msg.id,
          key,
          generation,
          sendCtx,
          processStartedAt,
        });
        if (!fallbackSent) {
          this.logSkip(key, 'agent returned empty reply');
        }
        await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
        return;
      }
      if (this.staffPausedChats.has(key)) {
        this.logSkip(key, 'staff replied while generating');
        return;
      }
      if (this.isStaleReply(key, generation)) {
        this.logSkip(key, 'superseded before send');
        return;
      }

      const sendOutcome = await this.sendCustomerAiReply(sessionId, chatId, reply, agentResult, {
        ...sendCtx,
        detectedIntent: signal.intent,
        hasComplexLookup: (agentResult.actions?.length ?? 0) > 0,
        generationMs: Date.now() - generationStartedAt,
        delayReason: 'agent_generation',
      });
      void this.signalService.recordReply({
        sessionId,
        chatId,
        incomingText,
        replyText: reply,
        escalated: agentResult.escalated,
        branchId,
        signalType: signal.signalType,
        detectedIntent: signal.intent,
      });
      if (signal.intent === AiCustomerIntent.UNKNOWN && incomingText.length >= 120) {
        void this.intentLearning.classifyAndQueueUnknown({
          text: incomingText,
          branchId: signal.branchId ?? branchId,
          conversationId: `${sessionId}:${chatId}`,
          contactId: chatId,
          messageId: msg.id,
        });
      }
      this.circuitBreaker.recordSuccess(sessionId);
      await this.inboxCrmService.resetAiFailures(sessionId, chatId);
      await this.inboxCrmService.setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE);
      await this.finalizeZeroCostReply(key, sessionId, burst, msg.id, config);
      this.logger.log(
        sendOutcome === 'queued'
          ? `AI auto-reply queued for safe delivery for ${key}`
          : `AI auto-reply sent for ${key}`,
      );
    } catch (error) {
      const opened = this.circuitBreaker.recordFailure(sessionId);
      await this.inboxCrmService.recordAiFailure(sessionId, chatId);
      if (opened) {
        await this.inboxCrmService.escalateToHuman(sessionId, chatId, 'AI provider errors');
        this.eventsGateway.emitAiEscalated(sessionId, {
          chatId,
          reason: 'circuit_breaker',
        });
      }
      this.logger.warn(
        `AI auto-reply failed for ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const errText = burst?.incomingTexts?.length
        ? (this.pickBurstFocusText(burst.incomingTexts, looksLikeProductQuery) ??
          burst.incomingTexts[burst.incomingTexts.length - 1])
        : incomingText;
      if (errText) {
        await this.tryProductNotFoundFallback({
          sessionId,
          chatId,
          incomingText: errText,
          branchId: null,
          messageId: msg?.id,
          key,
          generation,
          sendCtx: {},
          processStartedAt: Date.now(),
        }).catch(() => undefined);
      }
      await this.inboxCrmService
        .setAiHandlingState(sessionId, chatId, InboxAiHandlingState.IDLE)
        .catch(() => undefined);
    } finally {
      this.eventsGateway.emitAiTyping(sessionId, { chatId, active: false });
      this.stopTypingIndicator(sessionId, chatId);
    }
  }
}
