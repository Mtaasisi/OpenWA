import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  AiMessageBuffer,
  AiMessageBufferStatus,
  type BufferedRawMessage,
} from '../entities/ai-message-buffer.entity';
import { AiSettingsService } from '../ai-settings.service';
import { normalizeCombinedCustomerText } from '../learning/ai-text-normalizer.util';

export interface EnqueueBufferedMessageInput {
  sessionId: string;
  chatId: string;
  messageId: string;
  text: string;
  branchId?: string | null;
  contactId?: string | null;
  customerId?: string | null;
  receivedAt?: Date;
}

export type BufferedMessageProcessor = (payload: {
  sessionId: string;
  chatId: string;
  batchId: string;
  combinedText: string;
  normalizedText: string;
  messageIds: string[];
  bufferId: string;
}) => Promise<void>;

@Injectable()
export class AiMessageBufferService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AiMessageBufferService.name);
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private processor: BufferedMessageProcessor | null = null;
  private processing = false;

  constructor(
    @InjectRepository(AiMessageBuffer, 'data')
    private readonly repo: Repository<AiMessageBuffer>,
    private readonly aiSettings: AiSettingsService,
  ) {}

  onModuleInit(): void {
    this.pollTimer = setInterval(() => {
      void this.processDueBuffers().catch(err => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Buffer poll failed: ${msg}`);
      });
    }, 2000);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  registerProcessor(processor: BufferedMessageProcessor): void {
    this.processor = processor;
  }

  conversationKey(sessionId: string, chatId: string): string {
    return `${sessionId}:${chatId}`;
  }

  async enqueue(input: EnqueueBufferedMessageInput): Promise<AiMessageBuffer> {
    const config = await this.aiSettings.getActiveConfig();
    if (config?.messageBufferEnabled === false) {
      throw new Error('Message buffer disabled');
    }

    const conversationId = this.conversationKey(input.sessionId, input.chatId);
    const now = input.receivedAt ?? new Date();
    const debounceSec = config?.messageBufferDebounceSeconds ?? 10;
    const maxWaitSec = config?.messageBufferMaxWaitSeconds ?? 30;
    const maxMessages = config?.messageBufferMaxMessages ?? 10;
    const maxChars = config?.messageBufferMaxCharacters ?? 4000;

    let buffer = await this.repo.findOne({
      where: { conversationId, status: AiMessageBufferStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    const incoming: BufferedRawMessage = {
      messageId: input.messageId,
      text: input.text,
      receivedAt: now.toISOString(),
    };

    if (!buffer) {
      const scheduledProcessAt = new Date(now.getTime() + debounceSec * 1000);
      buffer = this.repo.create({
        conversationId,
        batchId: randomUUID(),
        branchId: input.branchId ?? null,
        contactId: input.contactId ?? null,
        customerId: input.customerId ?? null,
        status: AiMessageBufferStatus.PENDING,
        messageIds: [input.messageId],
        rawMessages: [incoming],
        combinedText: input.text.trim(),
        normalizedCombinedText: normalizeCombinedCustomerText([input.text]),
        firstMessageAt: now,
        lastMessageAt: now,
        scheduledProcessAt,
      });
      return this.repo.save(buffer);
    }

    const messageIds = [...(buffer.messageIds ?? [])];
    if (!messageIds.includes(input.messageId)) messageIds.push(input.messageId);

    const rawMessages = [...(buffer.rawMessages ?? []), incoming];
    const texts = rawMessages.map(m => m.text.trim()).filter(Boolean);
    const combinedText = texts.join('\n');

    buffer.messageIds = messageIds.slice(-maxMessages);
    buffer.rawMessages = rawMessages.slice(-maxMessages);
    buffer.combinedText = combinedText.slice(0, maxChars);
    buffer.normalizedCombinedText = normalizeCombinedCustomerText(texts).slice(0, maxChars);
    buffer.lastMessageAt = now;

    const maxDeadline = new Date(buffer.firstMessageAt.getTime() + maxWaitSec * 1000);
    const debounced = new Date(now.getTime() + debounceSec * 1000);
    buffer.scheduledProcessAt = debounced < maxDeadline ? debounced : maxDeadline;

    if (messageIds.length >= maxMessages || combinedText.length >= maxChars) {
      buffer.scheduledProcessAt = now;
    }

    return this.repo.save(buffer);
  }

  async processDueBuffers(): Promise<number> {
    if (this.processing || !this.processor) return 0;
    this.processing = true;
    try {
      const now = new Date();
      const due = await this.repo.find({
        where: {
          status: AiMessageBufferStatus.PENDING,
          scheduledProcessAt: LessThanOrEqual(now),
        },
        order: { scheduledProcessAt: 'ASC' },
        take: 5,
      });

      for (const buffer of due) {
        await this.processOne(buffer);
      }
      return due.length;
    } finally {
      this.processing = false;
    }
  }

  async findByBatchId(batchId: string): Promise<AiMessageBuffer | null> {
    return this.repo.findOne({ where: { batchId } });
  }

  async listRecent(limit = 20): Promise<AiMessageBuffer[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 100),
    });
  }

  async getStats(): Promise<{
    processedToday: number;
    pendingNow: number;
    failedToday: number;
  }> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const processedToday = await this.repo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: AiMessageBufferStatus.PROCESSED })
      .andWhere('b.processedAt >= :dayStart', { dayStart })
      .getCount();

    const pendingNow = await this.repo.count({
      where: { status: AiMessageBufferStatus.PENDING },
    });

    const failedToday = await this.repo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: AiMessageBufferStatus.FAILED })
      .andWhere('b.updatedAt >= :dayStart', { dayStart })
      .getCount();

    return { processedToday, pendingNow, failedToday };
  }

  private async processOne(buffer: AiMessageBuffer): Promise<void> {
    const claim = await this.repo
      .createQueryBuilder()
      .update(AiMessageBuffer)
      .set({ status: AiMessageBufferStatus.PROCESSING })
      .where('id = :id AND status = :status', {
        id: buffer.id,
        status: AiMessageBufferStatus.PENDING,
      })
      .execute();

    if (!claim.affected) return;

    const [sessionId, chatId] = buffer.conversationId.split(':');
    const combinedText = buffer.combinedText?.trim() ?? '';
    const normalizedText = buffer.normalizedCombinedText?.trim() ?? combinedText;

    try {
      if (this.processor && combinedText) {
        await this.processor({
          sessionId,
          chatId,
          batchId: buffer.batchId,
          combinedText,
          normalizedText,
          messageIds: buffer.messageIds ?? [],
          bufferId: buffer.id,
        });
      }

      buffer.status = AiMessageBufferStatus.PROCESSED;
      buffer.processedAt = new Date();
      await this.repo.save(buffer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Buffer ${buffer.batchId} failed: ${msg}`);
      buffer.status = AiMessageBufferStatus.FAILED;
      buffer.metadata = { ...(buffer.metadata ?? {}), error: msg.slice(0, 500) };
      await this.repo.save(buffer);
    }
  }
}
