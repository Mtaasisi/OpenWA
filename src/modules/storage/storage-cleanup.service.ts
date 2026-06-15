import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { Message } from '../message/entities/message.entity';
import { Quote } from '../quote/entities/quote.entity';
import { StorageService } from '../../common/storage/storage.service';
import { inferStorageChatType } from '../../common/utils/conversation-type.util';
import { jsonPathIsNotNull } from '../../common/utils/sql-dialect.util';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { StorageSettingsService } from './storage-settings.service';
import type { MessageMediaMeta } from './storage-policy.service';
import type { CleanupOptionsDto } from './dto/cleanup.dto';

export interface CleanupPreviewResult {
  confirmToken: string;
  candidateCount: number;
  bytesToFree: number;
  breakdown: {
    byMediaType: Record<string, number>;
    bySession: Record<string, number>;
  };
  sampleMessageIds: string[];
}

@Injectable()
export class StorageCleanupService {
  private readonly pendingTokens = new Map<string, { options: CleanupOptionsDto; expiresAt: number }>();

  constructor(
    @InjectRepository(Message, 'data')
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Quote, 'data')
    private readonly quoteRepo: Repository<Quote>,
    private readonly storageService: StorageService,
    private readonly settingsService: StorageSettingsService,
    private readonly auditService: AuditService,
  ) {}

  async preview(options: CleanupOptionsDto): Promise<CleanupPreviewResult> {
    const candidates = await this.findCandidates(options);
    const bytesToFree = candidates.reduce((sum, m) => {
      const meta = this.getMediaMeta(m);
      return sum + (meta?.sizeBytes ?? 0);
    }, 0);

    const byMediaType: Record<string, number> = {};
    const bySession: Record<string, number> = {};
    for (const msg of candidates) {
      byMediaType[msg.type] = (byMediaType[msg.type] ?? 0) + 1;
      bySession[msg.sessionId] = (bySession[msg.sessionId] ?? 0) + 1;
    }

    const confirmToken = randomBytes(16).toString('hex');
    this.pendingTokens.set(confirmToken, {
      options,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    return {
      confirmToken,
      candidateCount: candidates.length,
      bytesToFree,
      breakdown: { byMediaType, bySession },
      sampleMessageIds: candidates.slice(0, 20).map(m => m.id),
    };
  }

  async run(options: CleanupOptionsDto, confirmToken: string, apiKeyId?: string): Promise<{
    deletedCount: number;
    bytesFreed: number;
  }> {
    const pending = this.pendingTokens.get(confirmToken);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new BadRequestException('Invalid or expired confirm token. Run preview first.');
    }

    const optionsHash = createHash('sha256').update(JSON.stringify(options)).digest('hex');
    const pendingHash = createHash('sha256').update(JSON.stringify(pending.options)).digest('hex');
    if (optionsHash !== pendingHash) {
      throw new BadRequestException('Cleanup options changed since preview. Run preview again.');
    }

    this.pendingTokens.delete(confirmToken);

    const candidates = await this.findCandidates(options);
    let deletedCount = 0;
    let bytesFreed = 0;

    for (const message of candidates) {
      const meta = this.getMediaMeta(message);
      if (!meta?.storagePath) continue;

      try {
        await this.storageService.deleteFile(meta.storagePath);
      } catch {
        // File may already be missing — still update metadata
      }

      const size = meta.sizeBytes ?? 0;
      bytesFreed += size;
      deletedCount += 1;

      message.metadata = {
        ...(message.metadata ?? {}),
        media: {
          ...meta,
          storagePath: undefined,
          hasData: false,
          mediaStatus: 'deleted',
        },
      };
      await this.messageRepo.save(message);
    }

    await this.auditService.logInfo(AuditAction.STORAGE_CLEANUP_RUN, {
      metadata: { apiKeyId, deletedCount, bytesFreed, options },
    });

    return { deletedCount, bytesFreed };
  }

  private getMediaMeta(message: Message): MessageMediaMeta | null {
    return (message.metadata as { media?: MessageMediaMeta } | null)?.media ?? null;
  }

  private async findCandidates(options: CleanupOptionsDto): Promise<Message[]> {
    const settings = await this.settingsService.getSettings();
    const keepStarred = options.keepStarred ?? settings.global.excludeStarredMediaFromCleanup;
    const cutoff = options.olderThanDays
      ? new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000)
      : null;

    const quoteProtectedKeys =
      options.keepQuoteLinked !== false ? await this.getQuoteProtectedThreadKeys() : new Set<string>();

    const rows = await this.messageRepo
      .createQueryBuilder('m')
      .where(jsonPathIsNotNull('m.metadata', '$.media.storagePath'))
      .getMany();

    return rows.filter(msg => {
      const meta = this.getMediaMeta(msg);
      if (!meta?.storagePath) return false;
      if (keepStarred && meta.starred) return false;
      if (quoteProtectedKeys.has(`${msg.sessionId}:${msg.chatId}`)) return false;
      if (cutoff && msg.createdAt > cutoff) return false;
      if (options.groupMediaOnly && inferStorageChatType(msg.chatId) !== 'group') return false;
      if (options.failedDownloadsOnly && meta.mediaStatus !== 'failed') return false;
      if (options.videosOnly && msg.type !== 'video') return false;
      if (options.documentsOnly && msg.type !== 'document') return false;
      return true;
    });
  }

  private async getQuoteProtectedThreadKeys(): Promise<Set<string>> {
    const quotes = await this.quoteRepo.find({ select: ['sessionId', 'chatId'] });
    return new Set(quotes.map(q => `${q.sessionId}:${q.chatId}`));
  }
}
