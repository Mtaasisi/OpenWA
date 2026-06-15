import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { InboxThreadSummary } from './entities/inbox-thread-summary.entity';
import { InboxThreadCrm } from './entities/inbox-thread-crm.entity';
import { FollowupConversation } from '../followup/entities/followup-conversation.entity';
import { Message, MessageDirection } from './entities/message.entity';
import {
  InboxConversationSort,
  InboxConversationStatusFilter,
  InboxConversationsQueryDto,
  InboxQueryContext,
} from './dto/inbox-conversations-query.dto';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import {
  formatMessagePreview,
  isInboxChat,
} from '../../common/utils/inbox-chat.util';
import { isUsableWhatsAppChatTitle } from '../../common/utils/inbox-display.util';
import { InboxThreadRead } from './entities/inbox-thread-read.entity';
import { decodeInboxCursor } from './inbox-cursor.util';
import { resolveInboxViewerStaffId } from './inbox-viewer-staff.util';
import { applyInboxQueueSqlFilter } from './inbox-queue-sql.util';

@Injectable()
export class InboxThreadSummaryService {
  constructor(
    @InjectRepository(InboxThreadSummary, 'data')
    private readonly summaryRepository: Repository<InboxThreadSummary>,
    @InjectRepository(Message, 'data')
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(InboxThreadRead, 'data')
    private readonly threadReadRepository: Repository<InboxThreadRead>,
  ) {}

  async touchFromMessage(message: Message): Promise<void> {
    if (!isInboxChat(message.chatId)) return;

    const lastMessageAt = this.resolveActivityDate(message.timestamp, message.createdAt);
    const preview = formatMessagePreview(message.body, message.type);
    const chatName = (message.metadata as { chatName?: string } | null)?.chatName?.trim();
    const displayName =
      chatName && isUsableWhatsAppChatTitle(chatName, message.chatId) ? chatName : null;

    let row = await this.summaryRepository.findOne({
      where: { sessionId: message.sessionId, chatId: message.chatId },
    });

    if (!row) {
      row = this.summaryRepository.create({
        sessionId: message.sessionId,
        chatId: message.chatId,
        messageCount: 1,
        unreadCount: message.direction === MessageDirection.INCOMING ? 1 : 0,
        lastMessageAt,
        lastTimestamp: message.timestamp ?? null,
        lastPreview: preview,
        lastMessageType: message.type,
        lastMessageId: message.id,
        lastDirection: message.direction,
        displayName,
        lastInboundBroadcast:
          message.direction === MessageDirection.INCOMING &&
          Boolean((message.metadata as { broadcast?: boolean } | null)?.broadcast),
      });
      await this.summaryRepository.save(row);
      return;
    }

    row.messageCount += 1;
    if (lastMessageAt >= row.lastMessageAt) {
      row.lastMessageAt = lastMessageAt;
      row.lastTimestamp = message.timestamp ?? null;
      row.lastPreview = preview;
      row.lastMessageType = message.type;
      row.lastMessageId = message.id;
      row.lastDirection = message.direction;
      if (displayName) row.displayName = displayName;
    }
    if (message.direction === MessageDirection.INCOMING) {
      row.lastInboundBroadcast = Boolean(
        (message.metadata as { broadcast?: boolean } | null)?.broadcast,
      );
      row.unreadCount += 1;
    }
    await this.summaryRepository.save(row);
  }

  async resetUnread(sessionId: string, chatId: string): Promise<void> {
    await this.summaryRepository.update({ sessionId, chatId }, { unreadCount: 0 });
  }

  /** Stored WhatsApp titles for a batch of threads (message search enrichment). */
  async findDisplayNamesForChats(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, string | null>> {
    if (chatIds.length === 0) return new Map();
    const rows = await this.summaryRepository.find({
      where: { sessionId, chatId: In(chatIds) },
      select: ['chatId', 'displayName'],
    });
    return new Map(rows.map(row => [row.chatId, row.displayName]));
  }

  /** Persist WhatsApp group subject / contact title on the thread summary row. */
  async upsertDisplayName(sessionId: string, chatId: string, displayName: string): Promise<void> {
    const trimmed = displayName.trim();
    if (!trimmed || !isUsableWhatsAppChatTitle(trimmed, chatId)) return;
    await this.summaryRepository.update({ sessionId, chatId }, { displayName: trimmed });
  }

  async recomputeUnread(sessionId: string, chatId: string): Promise<void> {
    const unread = await this.countUnreadIncoming(sessionId, chatId);
    await this.summaryRepository.update({ sessionId, chatId }, { unreadCount: unread });
  }

  async countThreads(sessionIds: string[]): Promise<number> {
    if (sessionIds.length === 0) return 0;
    return this.summaryRepository
      .createQueryBuilder('s')
      .where('s.sessionId IN (:...sessionIds)', { sessionIds })
      .getCount();
  }

  async listHistorySyncCandidates(
    sessionId: string,
    offset: number,
    limit: number,
    options?: { hotTierOnly?: boolean; hotTierDays?: number },
  ): Promise<{ chatIds: string[]; total: number }> {
    const qb = this.summaryRepository
      .createQueryBuilder('s')
      .where('s.sessionId = :sessionId', { sessionId });

    if (options?.hotTierOnly && options.hotTierDays != null && options.hotTierDays > 0) {
      const hotSince = new Date(Date.now() - options.hotTierDays * 24 * 60 * 60 * 1000);
      qb.andWhere('s.lastMessageAt >= :hotSince', { hotSince });
    }

    qb.orderBy('CASE WHEN s.messageCount = 0 THEN 0 WHEN s.messageCount < 5 THEN 1 ELSE 2 END', 'ASC')
      .addOrderBy('s.unreadCount', 'DESC')
      .addOrderBy('s.lastMessageAt', 'DESC');

    const total = await qb.getCount();
    const rows = await qb.skip(Math.max(0, offset)).take(limit).getMany();
    return { chatIds: rows.map(row => row.chatId), total };
  }

  async searchThreadsLight(
    sessionIds: string[],
    options: { q: string; sessionId?: string; limit?: number },
    ctx: InboxQueryContext,
  ): Promise<{ rows: InboxThreadSummary[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
    const scopedIds = options.sessionId
      ? sessionIds.filter(id => id === options.sessionId)
      : sessionIds;
    if (scopedIds.length === 0) return { rows: [], total: 0 };

    const baseQb = this.summaryRepository
      .createQueryBuilder('s')
      .leftJoin(InboxThreadCrm, 'crm', 'crm.sessionId = s.sessionId AND crm.chatId = s.chatId')
      .leftJoin(
        FollowupConversation,
        'fc',
        'fc.sessionId = s.sessionId AND fc.chatId = s.chatId',
      )
      .where('s.sessionId IN (:...sessionIds)', { sessionIds: scopedIds });

    this.applyFilters(baseQb, { search: options.q } as InboxConversationsQueryDto, ctx);

    const total = await baseQb.getCount();
    this.applySort(baseQb, InboxConversationSort.NEWEST);
    const rows = await baseQb.select('s').take(limit).getMany();
    return { rows, total };
  }

  async queryPage(
    sessionIds: string[],
    query: InboxConversationsQueryDto,
    ctx: InboxQueryContext,
    options?: { skipExactTotal?: boolean },
  ): Promise<{ summaries: InboxThreadSummary[]; total: number }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const baseQb = this.summaryRepository
      .createQueryBuilder('s')
      .leftJoin(InboxThreadCrm, 'crm', 'crm.sessionId = s.sessionId AND crm.chatId = s.chatId')
      .leftJoin(
        FollowupConversation,
        'fc',
        'fc.sessionId = s.sessionId AND fc.chatId = s.chatId',
      )
      .where('s.sessionId IN (:...sessionIds)', { sessionIds });

    this.applyFilters(baseQb, query, ctx);

    const total = options?.skipExactTotal
      ? -1
      : await baseQb.getCount();

    const pageQb = baseQb.clone().select('s');
    this.applySort(pageQb, query.sort ?? InboxConversationSort.NEWEST);

    const cursor = decodeInboxCursor(query.cursor);
    if (cursor) {
      pageQb.andWhere(
        new Brackets(sub => {
          sub
            .where('s.lastMessageAt < :cursorAt', { cursorAt: new Date(cursor.lastMessageAt) })
            .orWhere(
              new Brackets(inner => {
                inner
                  .where('s.lastMessageAt = :cursorAtEq', {
                    cursorAtEq: new Date(cursor.lastMessageAt),
                  })
                  .andWhere(
                    '(s.sessionId > :cursorSession OR (s.sessionId = :cursorSession AND s.chatId > :cursorChat))',
                    {
                      cursorSession: cursor.sessionId,
                      cursorChat: cursor.chatId,
                    },
                  );
              }),
            );
        }),
      );
      pageQb.take(limit);
    } else {
      pageQb.skip(offset).take(limit);
    }

    const summaries = await pageQb.getMany();
    return { summaries, total };
  }

  async backfillFromMessages(batchSize = 500, offset = 0): Promise<{ processed: number; hasMore: boolean }> {
    const aggregates = await this.messageRepository
      .createQueryBuilder('message')
      .select('message.sessionId', 'sessionId')
      .addSelect('message.chatId', 'chatId')
      .addSelect('COUNT(message.id)', 'messageCount')
      .groupBy('message.sessionId')
      .addGroupBy('message.chatId')
      .offset(offset)
      .limit(batchSize)
      .getRawMany<{ sessionId: string; chatId: string; messageCount: string }>();

    if (aggregates.length === 0) {
      return { processed: 0, hasMore: false };
    }

    for (const row of aggregates) {
      if (!isInboxChat(row.chatId)) continue;
      const latest = await this.messageRepository.findOne({
        where: { sessionId: row.sessionId, chatId: row.chatId },
        order: { timestamp: 'DESC', createdAt: 'DESC' },
      });
      if (!latest) continue;

      const unread = await this.countUnreadIncoming(row.sessionId, row.chatId);
      const chatName = (latest.metadata as { chatName?: string } | null)?.chatName?.trim();
      const displayName =
        chatName && isUsableWhatsAppChatTitle(chatName, row.chatId) ? chatName : null;

      await this.summaryRepository.upsert(
        {
          id: randomUUID(),
          sessionId: row.sessionId,
          chatId: row.chatId,
          lastMessageAt: this.resolveActivityDate(latest.timestamp, latest.createdAt),
          lastTimestamp: latest.timestamp ?? null,
          lastPreview: formatMessagePreview(latest.body, latest.type),
          lastMessageType: latest.type,
          lastMessageId: latest.id,
          lastDirection: latest.direction,
          messageCount: parseInt(row.messageCount, 10) || 0,
          displayName,
          unreadCount: unread,
        },
        ['sessionId', 'chatId'],
      );
    }

    return { processed: aggregates.length, hasMore: aggregates.length === batchSize };
  }

  private applyFilters(
    qb: ReturnType<Repository<InboxThreadSummary>['createQueryBuilder']>,
    query: InboxConversationsQueryDto,
    ctx: InboxQueryContext,
  ): void {
    const isAdmin = ctx.role === ApiKeyRole.ADMIN;
    const staffId = resolveInboxViewerStaffId(query, ctx);

    if (!isAdmin && ctx.apiKeyId) {
      qb.andWhere('(fc.assignedStaffId IS NULL OR fc.assignedStaffId = :viewerStaffId)', {
        viewerStaffId: ctx.apiKeyId,
      });
    }
    if (staffId) {
      qb.andWhere('fc.assignedStaffId = :assignedStaffId', { assignedStaffId: staffId });
    }
    if (query.unassigned) {
      qb.andWhere('fc.assignedStaffId IS NULL');
    }
    if (query.branchId) {
      qb.andWhere('(fc.branchId = :branchId OR fc.branchId IS NULL)', { branchId: query.branchId });
    }
    if (query.status === InboxConversationStatusFilter.OPEN) {
      qb.andWhere('(crm.resolved IS NULL OR crm.resolved = :openResolved)', { openResolved: false });
    } else if (query.status === InboxConversationStatusFilter.RESOLVED) {
      qb.andWhere('crm.resolved = :resolved', { resolved: true });
    }
    if (query.stage) {
      qb.andWhere('fc.stage = :stage', { stage: query.stage });
    }
    if (query.priority) {
      qb.andWhere('fc.priority = :priority', { priority: query.priority });
    }
    if (query.aiStatus) {
      qb.andWhere('crm.aiHandlingState = :aiStatus', { aiStatus: query.aiStatus });
    }
    if (query.overdueFollowup) {
      qb.andWhere('fc.nextFollowupAt IS NOT NULL AND fc.nextFollowupAt <= :now', {
        now: new Date(),
      });
    }
    if (query.unread === true) {
      qb.andWhere('s.unreadCount > 0');
    } else if (query.unread === false) {
      qb.andWhere('s.unreadCount = 0');
    }
    if (query.search?.trim()) {
      const q = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where('LOWER(s.displayName) LIKE :q', { q })
            .orWhere('LOWER(s.chatId) LIKE :q', { q })
            .orWhere('LOWER(s.lastPreview) LIKE :q', { q })
            .orWhere('LOWER(crm.customerName) LIKE :q', { q })
            .orWhere('LOWER(crm.customerPhone) LIKE :q', { q })
            .orWhere('LOWER(fc.customerName) LIKE :q', { q })
            .orWhere('LOWER(fc.productInterest) LIKE :q', { q });
        }),
      );
    }
    if (query.leadSource?.trim()) {
      qb.andWhere('fc.source = :leadSource', { leadSource: query.leadSource.trim() });
    }
    if (query.conversationType?.trim()) {
      this.applyConversationTypeFilter(qb, query.conversationType.trim());
    }
    if (query.queue) {
      applyInboxQueueSqlFilter(qb, query.queue, staffId);
    }
    if (query.activeSinceDays != null && query.activeSinceDays > 0) {
      const since = new Date(Date.now() - query.activeSinceDays * 24 * 60 * 60 * 1000);
      qb.andWhere('s.lastMessageAt >= :activeSince', { activeSince: since });
    }
    if (query.excludeColdResolved) {
      const coldDays = query.coldResolvedDays ?? 180;
      const coldSince = new Date(Date.now() - coldDays * 24 * 60 * 60 * 1000);
      qb.andWhere(
        new Brackets(sub => {
          sub
            .where('crm.resolved IS NULL')
            .orWhere('crm.resolved = :openResolvedCold', { openResolvedCold: false })
            .orWhere('s.lastMessageAt >= :coldSince', { coldSince });
        }),
      );
    }
  }

  private applyConversationTypeFilter(
    qb: ReturnType<Repository<InboxThreadSummary>['createQueryBuilder']>,
    conversationType: string,
  ): void {
    switch (conversationType) {
      case 'group':
        qb.andWhere('s.chatId LIKE :groupSuffix', { groupSuffix: '%@g.us' });
        return;
      case 'broadcast':
        qb.andWhere(
          new Brackets(sub => {
            sub
              .where('s.chatId LIKE :broadcastSuffix', { broadcastSuffix: '%@broadcast%' })
              .orWhere('s.chatId LIKE :newsletterSuffix', { newsletterSuffix: '%@newsletter' })
              .orWhere('s.lastInboundBroadcast = :broadcastList', { broadcastList: true });
          }),
        );
        return;
      case 'direct_customer':
        qb.andWhere('s.chatId NOT LIKE :groupSuffix', { groupSuffix: '%@g.us' });
        qb.andWhere('s.chatId NOT LIKE :broadcastSuffix', { broadcastSuffix: '%@broadcast%' });
        qb.andWhere('s.chatId NOT LIKE :newsletterSuffix', { newsletterSuffix: '%@newsletter' });
        qb.andWhere('s.chatId != :statusBroadcast', { statusBroadcast: 'status@broadcast' });
        qb.andWhere('s.lastInboundBroadcast = :notBroadcastList', { notBroadcastList: false });
        return;
      case 'system':
        qb.andWhere(
          new Brackets(sub => {
            sub
              .where('s.chatId = :statusBroadcast', { statusBroadcast: 'status@broadcast' })
              .orWhere('s.chatId LIKE :sWhatsappSuffix', { sWhatsappSuffix: '%@s.whatsapp.net' });
          }),
        );
        return;
      case 'internal':
        qb.andWhere('s.chatId LIKE :lidSuffix', { lidSuffix: '%@lid' });
        return;
      case 'spam':
        qb.andWhere('fc.stage = :spamStage', { spamStage: 'spam' });
        return;
      default:
        return;
    }
  }

  private applySort(
    qb: ReturnType<Repository<InboxThreadSummary>['createQueryBuilder']>,
    sort: InboxConversationSort,
  ): void {
    if (sort === InboxConversationSort.OLDEST) {
      qb.orderBy('s.lastMessageAt', 'ASC');
      return;
    }
    if (sort === InboxConversationSort.PRIORITY) {
      qb.orderBy(
        `CASE fc.priority WHEN 'hot' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`,
        'ASC',
      ).addOrderBy('s.lastMessageAt', 'DESC');
      return;
    }
    if (sort === InboxConversationSort.OVERDUE) {
      qb.orderBy('CASE WHEN fc.nextFollowupAt IS NOT NULL AND fc.nextFollowupAt <= :sortNow THEN 0 ELSE 1 END', 'ASC')
        .addOrderBy('fc.nextFollowupAt', 'ASC')
        .addOrderBy('s.lastMessageAt', 'DESC')
        .setParameter('sortNow', new Date());
      return;
    }
    qb.orderBy('s.lastMessageAt', 'DESC');
  }

  private resolveActivityDate(
    timestamp: number | string | null | undefined,
    createdAt: Date | string,
  ): Date {
    const ts = timestamp != null ? Number(timestamp) : NaN;
    if (Number.isFinite(ts) && ts > 0) {
      return new Date(ts * 1000);
    }
    return new Date(createdAt);
  }

  private async countUnreadIncoming(sessionId: string, chatId: string): Promise<number> {
    const read = await this.threadReadRepository.findOne({
      where: { sessionId, chatId },
    });

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .where('message.sessionId = :sessionId', { sessionId })
      .andWhere('message.chatId = :chatId', { chatId })
      .andWhere('message.direction = :direction', { direction: MessageDirection.INCOMING });

    const lastReadAt = read?.lastReadAt;
    if (lastReadAt) {
      qb.andWhere('message.createdAt > :lastReadAt', { lastReadAt });
    }
    return qb.getCount();
  }
}
