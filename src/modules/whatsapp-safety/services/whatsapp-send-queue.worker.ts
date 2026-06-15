import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageService } from '../../message/message.service';
import { WhatsAppSendQueueService } from './whatsapp-send-queue.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { WhatsAppSessionHealthService } from './whatsapp-session-health.service';
import { WhatsAppWarmupService } from './whatsapp-warmup.service';
import { WhatsAppConsentService } from './whatsapp-consent.service';
import { WhatsAppSendAuditService } from './whatsapp-send-audit.service';
import {
  WhatsAppSendAuditDecision,
  WhatsAppMessageType,
} from '../enums/whatsapp-safety.enums';
import { randomDelayMs } from '../utils/send-delay.util';

@Injectable()
export class WhatsAppSendQueueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppSendQueueWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private processing = false;
  private lastSendBySession = new Map<string, number>();
  private lastSendByContact = new Map<string, number>();
  private readonly pollMs: number;

  constructor(
    private readonly queueService: WhatsAppSendQueueService,
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly healthService: WhatsAppSessionHealthService,
    private readonly warmupService: WhatsAppWarmupService,
    private readonly consentService: WhatsAppConsentService,
    private readonly auditService: WhatsAppSendAuditService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
  ) {
    this.pollMs = Math.max(2000, Number(this.config.get('WHATSAPP_QUEUE_POLL_MS') ?? 5000));
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.pollMs);
    this.timer.unref?.();
    this.logger.log(`Send queue worker polling every ${this.pollMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const ready = await this.queueService.findReady(100);

      const bySession = new Map<string, typeof ready>();
      for (const item of ready) {
        const list = bySession.get(item.sessionId) ?? [];
        list.push(item);
        bySession.set(item.sessionId, list);
      }

      for (const [sessionId, items] of bySession) {
        if (await this.healthService.isAutomationPaused(sessionId)) continue;
        const settings = await this.settingsService.getForSession(sessionId);
        const lastSessionSend = this.lastSendBySession.get(sessionId) ?? 0;
        const minGap = settings.minDelayBetweenMessagesMs;
        if (Date.now() - lastSessionSend < minGap) continue;

        const item = items[0];
        await this.processItem(item, settings.minDelayBetweenMessagesMs, settings.maxDelayBetweenMessagesMs, settings.perContactCooldownMinutes);
      }
    } catch (err) {
      this.logger.warn(`Queue worker tick failed: ${String(err)}`);
    } finally {
      this.processing = false;
    }
  }

  private async processItem(
    item: Awaited<ReturnType<WhatsAppSendQueueService['findReady']>>[0],
    minDelay: number,
    maxDelay: number,
    contactCooldownMin: number,
  ): Promise<void> {
    const contactKey = `${item.sessionId}:${item.chatId}`;
    const lastContact = this.lastSendByContact.get(contactKey) ?? 0;
    if (Date.now() - lastContact < contactCooldownMin * 60 * 1000) {
      return;
    }

    await this.queueService.markSending(item.id);
    try {
      const sendOpts = { source: item.source, skipGuard: true };

      if (item.mediaUrls?.length) {
        if (item.mediaUrls.length === 1) {
          await this.messageService.sendImage(
            item.sessionId,
            { chatId: item.chatId, url: item.mediaUrls[0], caption: item.messageBody },
            sendOpts,
          );
        } else {
          await this.messageService.sendImageAlbum(
            item.sessionId,
            { chatId: item.chatId, urls: item.mediaUrls, caption: item.messageBody },
            sendOpts,
          );
        }
      } else {
        await this.messageService.sendTextInternal(
          item.sessionId,
          { chatId: item.chatId, text: item.messageBody },
          { ...sendOpts, templateId: item.templateId },
        );
      }

      await this.queueService.markSent(item.id);
      await this.warmupService.recordOutbound(item.sessionId, item.messageType as WhatsAppMessageType);
      if (item.phone) await this.consentService.recordOutbound(item.sessionId, item.phone);
      await this.healthService.recordSuccessfulSend(item.sessionId);
      await this.auditService.log({
        sessionId: item.sessionId,
        chatId: item.chatId,
        phone: item.phone,
        source: item.source,
        messageType: item.messageType as WhatsAppMessageType,
        decision: WhatsAppSendAuditDecision.SENT,
        reason: 'Sent from queue',
        queueItemId: item.id,
        body: item.messageBody,
      });

      const delay = randomDelayMs(minDelay, maxDelay);
      this.lastSendBySession.set(item.sessionId, Date.now() + delay);
      this.lastSendByContact.set(contactKey, Date.now());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.queueService.markFailed(item.id, msg);
      await this.healthService.recordSendFailure(item.sessionId);
      await this.auditService.log({
        sessionId: item.sessionId,
        chatId: item.chatId,
        phone: item.phone,
        source: item.source,
        messageType: item.messageType as WhatsAppMessageType,
        decision: WhatsAppSendAuditDecision.FAILED,
        reason: msg,
        queueItemId: item.id,
      });

      const settings = await this.settingsService.getForSession(item.sessionId);
      if (await this.healthService.checkFailureRate(item.sessionId, settings.failureRatePauseThreshold)) {
        await this.healthService.pauseAutomation(item.sessionId, 'High failure rate — automation paused');
      }
    }
  }
}
