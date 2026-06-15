import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { FollowupConversation } from './entities/followup-conversation.entity';
import {
  ConversationSource,
  ConversationStage,
  ConversationPriority,
  LostReason,
} from './followup.enums';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import {
  isGenericWhatsAppContactLabel,
  isInternalLidUserId,
  looksLikePersonLabel,
  phoneDigitsFromChatId,
  resolveCustomerName,
  resolveThreadIdentity,
  sanitizeStoredPhone,
} from '../../common/utils/inbox-display.util';
import { CloseLostDto, CreateManualLeadDto, LinkSaleDto, UpdateConversationDto } from './dto/followup.dto';
import { normalizeLeadSource } from './utils/lead-source.util';
import { SaleAttributionService } from './sale-attribution.service';
import { FollowupQueueService } from './followup-queue.service';
import { FollowupInboxEnrichment } from './followup-inbox-enrichment.types';
import { Message } from '../message/entities/message.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';

const MANUAL_SESSION = 'manual';

@Injectable()
export class FollowupConversationService {
  constructor(
    @InjectRepository(FollowupConversation, 'data')
    private readonly repo: Repository<FollowupConversation>,
    @InjectRepository(Message, 'data')
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(InboxThreadCrm, 'data')
    private readonly crmRepo: Repository<InboxThreadCrm>,
    private readonly saleAttribution: SaleAttributionService,
    @Inject(forwardRef(() => FollowupQueueService))
    private readonly queueService: FollowupQueueService,
  ) {}

  async getOrCreate(sessionId: string, chatId: string): Promise<FollowupConversation> {
    if (!isInboxChat(chatId)) {
      throw new BadRequestException('Invalid chat id');
    }
    let row = await this.repo.findOne({ where: { sessionId, chatId } });
    if (!row) {
      row = this.repo.create({
        sessionId,
        chatId,
        source: ConversationSource.WHATSAPP,
        channel: ConversationSource.WHATSAPP,
        stage: ConversationStage.NEW_LEAD,
        priority: ConversationPriority.NORMAL,
      });
      this.applyIdentityHints(row, chatId);
      row = await this.repo.save(row);
    }
    return row;
  }

  async createManualLead(dto: CreateManualLeadDto, staffId?: string): Promise<FollowupConversation> {
    const chatId = `manual-${randomUUID()}`;
    const row = this.repo.create({
      sessionId: MANUAL_SESSION,
      chatId,
      isManual: true,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone ?? null,
      customerHandle: dto.customerHandle ?? null,
      customerId: dto.customerId ?? null,
      source: normalizeLeadSource(dto.source),
      channel: dto.channel ?? normalizeLeadSource(dto.source),
      branchId: dto.branchId ?? null,
      assignedStaffId: dto.assignedStaffId ?? staffId ?? null,
      stage: ConversationStage.NEW_LEAD,
      priority: dto.priority ?? ConversationPriority.NORMAL,
      productInterest: dto.productInterest ?? null,
      budget: dto.budget ?? null,
      internalNote: dto.notes ?? null,
      firstMessageAt: dto.firstMessageAt ? new Date(dto.firstMessageAt) : new Date(),
    });
    return this.repo.save(row);
  }

  async findById(id: string): Promise<FollowupConversation> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Conversation ${id} not found`);
    return row;
  }

  async findByThread(sessionId: string, chatId: string): Promise<FollowupConversation | null> {
    return this.repo.findOne({ where: { sessionId, chatId } });
  }

  resolveIdentity(
    row: {
      chatId: string;
      customerName?: string | null;
      customerPhone?: string | null;
      customerHandle?: string | null;
    },
    crm?: { customerName?: string | null; customerPhone?: string | null } | null,
    extra?: { displayName?: string | null; chatTitle?: string | null },
  ): { customerName: string | null; customerPhone: string | null } {
    return resolveThreadIdentity({
      chatId: row.chatId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      crmName: crm?.customerName,
      crmPhone: crm?.customerPhone,
      displayName: row.customerHandle ?? extra?.displayName,
      chatTitle: extra?.chatTitle,
    });
  }

  async resolveIdentityForThread(
    sessionId: string,
    chatId: string,
    row?: {
      customerName?: string | null;
      customerPhone?: string | null;
      customerHandle?: string | null;
    } | null,
  ): Promise<{ customerName: string | null; customerPhone: string | null }> {
    const conv =
      row ??
      (await this.findByThread(sessionId, chatId));
    if (!conv) {
      return resolveThreadIdentity({ chatId, customerName: null, customerPhone: null });
    }
    const crm =
      sessionId !== MANUAL_SESSION
        ? await this.crmRepo.findOne({ where: { sessionId, chatId } })
        : null;
    return this.resolveIdentity({ ...conv, chatId }, crm);
  }

  async enrichConversationForApi(row: FollowupConversation): Promise<FollowupConversation> {
    let identity = await this.resolveIdentityForThread(row.sessionId, row.chatId, row);
    if (!identity.customerName?.trim() && row.sessionId !== MANUAL_SESSION) {
      const titles = await this.loadStoredChatTitles([row]);
      const chatTitle = titles.get(`${row.sessionId}:${row.chatId}`);
      const fromMessages = chatTitle ? resolveCustomerName(row.chatId, chatTitle) : null;
      if (fromMessages) {
        identity = { ...identity, customerName: fromMessages };
      }
    }
    return { ...row, customerName: identity.customerName, customerPhone: identity.customerPhone };
  }

  /** Batch CRM rows keyed by `sessionId:chatId` for queue/pipeline enrichment. */
  async getCrmMapForConversations(
    rows: FollowupConversation[],
  ): Promise<Map<string, InboxThreadCrm>> {
    const map = new Map<string, InboxThreadCrm>();
    const bySession = new Map<string, Set<string>>();
    for (const row of rows) {
      if (row.sessionId === MANUAL_SESSION || !row.chatId) continue;
      const chatIds = bySession.get(row.sessionId) ?? new Set<string>();
      chatIds.add(row.chatId);
      bySession.set(row.sessionId, chatIds);
    }
    for (const [sessionId, chatIds] of bySession) {
      const crmRows = await this.crmRepo.find({
        where: { sessionId, chatId: In([...chatIds]) },
      });
      for (const crm of crmRows) {
        map.set(`${sessionId}:${crm.chatId}`, crm);
      }
    }
    return map;
  }

  /** Batch lookup lead sources for inbox thread list (no auto-create). */
  async getLeadSourceMapForThreads(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, ConversationSource>> {
    const unique = [...new Set(chatIds.filter(Boolean))];
    if (unique.length === 0) return new Map();

    const rows = await this.repo.find({
      where: { sessionId, chatId: In(unique) },
      select: ['chatId', 'source'],
    });
    return new Map(rows.map(r => [r.chatId, r.source]));
  }

  /** Batch lookup assignee for inbox thread list (no auto-create). */
  async getAssigneeMapForThreads(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, string | null>> {
    const map = await this.getInboxEnrichmentMapForThreads(sessionId, chatIds);
    return new Map([...map.entries()].map(([chatId, row]) => [chatId, row.assignedStaffId]));
  }

  /** Batch pipeline + CRM fields for inbox list enrichment (no auto-create). */
  async getInboxEnrichmentMapForThreads(
    sessionId: string,
    chatIds: string[],
  ): Promise<Map<string, FollowupInboxEnrichment>> {
    const unique = [...new Set(chatIds.filter(Boolean))];
    if (unique.length === 0) return new Map();

    const rows = await this.repo.find({
      where: { sessionId, chatId: In(unique) },
    });
    const crmRows = await this.crmRepo.find({
      where: { sessionId, chatId: In(unique) },
    });
    const crmMap = new Map(crmRows.map(c => [c.chatId, c]));

    return new Map(
      rows.map(r => [
        r.chatId,
        {
          customerName: r.customerName ?? null,
          customerPhone: r.customerPhone ?? null,
          source: r.source,
          branchId: r.branchId,
          assignedStaffId: r.assignedStaffId,
          stage: r.stage,
          priority: r.priority,
          productInterest: r.productInterest,
          outcome: r.outcome,
          lostReason: r.lostReason,
          lastCustomerMessageAt: r.lastCustomerMessageAt,
          lastStaffMessageAt: r.lastStaffMessageAt,
          responseTimeSeconds: r.responseTimeSeconds,
          nextFollowupAt: r.nextFollowupAt,
          followupAutopilotPaused: crmMap.get(r.chatId)?.followupAutopilotPaused ?? false,
        },
      ]),
    );
  }

  async update(id: string, dto: UpdateConversationDto): Promise<FollowupConversation> {
    const row = await this.findById(id);
    if (dto.nextFollowupAt !== undefined) {
      row.nextFollowupAt = dto.nextFollowupAt ? new Date(dto.nextFollowupAt) : null;
    }
    const { nextFollowupAt: _nfa, customerPhone: rawPhone, ...rest } = dto;
    Object.assign(row, rest);
    if (rawPhone !== undefined) {
      const trimmed = rawPhone?.trim() || null;
      row.customerPhone = trimmed ? sanitizeStoredPhone(row.chatId, trimmed) : null;
    }
    if (dto.followupCompleted !== undefined) {
      row.followupCompletedBeforeClose = dto.followupCompleted;
    }
    if (dto.source && !dto.channel) {
      row.channel = dto.source;
    }
    if (dto.source) {
      row.source = normalizeLeadSource(dto.source);
    }
    return this.repo.save(row);
  }

  async updateLeadSource(id: string, source: ConversationSource): Promise<FollowupConversation> {
    const row = await this.findById(id);
    row.source = normalizeLeadSource(source);
    row.channel = row.source;
    return this.repo.save(row);
  }

  async updateStage(id: string, stage: ConversationStage): Promise<FollowupConversation> {
    const row = await this.findById(id);
    row.stage = this.normalizeStage(stage);
    if (stage === ConversationStage.WON || stage === ConversationStage.LOST) {
      row.closedAt = row.closedAt ?? new Date();
      await this.queueService.cancelPendingForConversation(row.id, `stage_${stage}`);
    }
    return this.repo.save(row);
  }

  async recordCustomerMessage(
    sessionId: string,
    chatId: string,
    hints?: { notifyName?: string | null; chatName?: string | null },
  ): Promise<FollowupConversation> {
    const row = await this.getOrCreate(sessionId, chatId);
    const now = new Date();
    if (!row.firstMessageAt) row.firstMessageAt = now;
    row.lastCustomerMessageAt = now;

    this.applyIdentityHints(row, chatId, hints);

    if (row.stage === ConversationStage.WAITING_CUSTOMER_REPLY) {
      row.stage = ConversationStage.CONTACTED;
    } else if (
      row.stage === ConversationStage.CONTACTED ||
      row.stage === ConversationStage.REPLIED ||
      [
        ConversationStage.PRICE_SENT,
        ConversationStage.NEGOTIATING,
        ConversationStage.PRODUCT_SUGGESTED,
      ].includes(row.stage)
    ) {
      row.stage = ConversationStage.WAITING_CUSTOMER_REPLY;
    }

    return this.repo.save(row);
  }

  async recordStaffMessage(
    sessionId: string,
    chatId: string,
    staffId?: string,
  ): Promise<FollowupConversation> {
    const row = await this.getOrCreate(sessionId, chatId);
    const now = new Date();
    row.lastStaffMessageAt = now;

    if (!row.firstResponseAt) {
      row.firstResponseAt = now;
      if (row.firstMessageAt) {
        row.responseTimeSeconds = Math.round(
          (now.getTime() - row.firstMessageAt.getTime()) / 1000,
        );
      }
    }

    if (row.stage === ConversationStage.NEW_LEAD) {
      row.stage = ConversationStage.CONTACTED;
    }

    if (staffId && !row.assignedStaffId) {
      row.assignedStaffId = staffId;
    }

    return this.repo.save(row);
  }

  async closeAsLost(id: string, dto: CloseLostDto): Promise<FollowupConversation> {
    const row = await this.findById(id);

    if (!dto.lostReason) {
      throw new BadRequestException('Lost reason is required');
    }
    if (!dto.lostNotes?.trim()) {
      throw new BadRequestException('Notes are required when closing as lost');
    }

    const attemptCount = await this.repo.manager
      .createQueryBuilder()
      .select('COUNT(*)', 'cnt')
      .from('followup_attempts', 'a')
      .where('a.conversationId = :id', { id })
      .getRawOne<{ cnt: string }>();

    const hasFollowupHistory = parseInt(attemptCount?.cnt ?? '0', 10) > 0;
    const skipFollowupCheck = dto.customerRefusedFollowup || row.customerRefusedFollowup;

    if (
      !skipFollowupCheck &&
      !hasFollowupHistory &&
      !row.followupCompleted &&
      !row.followupCompletedBeforeClose
    ) {
      if (dto.lostReason === LostReason.STOPPED_REPLYING) {
        throw new BadRequestException(
          'Cannot close stopped-replying leads without completed follow-up',
        );
      }
      throw new BadRequestException(
        'Cannot close as lost without follow-up history or completed follow-up',
      );
    }

    const needsAlternative =
      dto.lostReason === LostReason.PRICE_TOO_HIGH ||
      dto.lostReason === LostReason.OUT_OF_STOCK ||
      row.stage === ConversationStage.PRODUCT_SUGGESTED;
    if (needsAlternative && !dto.alternativeOffered && !row.alternativeOffered) {
      throw new BadRequestException(
        'Must confirm alternative was offered when price was high or product out of stock',
      );
    }

    row.stage = ConversationStage.LOST;
    row.lostReason = dto.lostReason;
    row.lostNotes = dto.lostNotes;
    row.alternativeOffered = dto.alternativeOffered || row.alternativeOffered;
    row.customerRefusedFollowup = dto.customerRefusedFollowup ?? row.customerRefusedFollowup;
    row.nextFollowupAt = null;
    row.closedAt = new Date();
    const saved = await this.repo.save(row);
    await this.queueService.cancelPendingForConversation(saved.id, 'closed_lost');
    return saved;
  }

  async markWon(id: string, linkedSaleId?: string): Promise<FollowupConversation> {
    const row = await this.findById(id);
    row.stage = ConversationStage.WON;
    if (linkedSaleId) row.linkedSaleId = linkedSaleId;
    row.nextFollowupAt = null;
    row.closedAt = new Date();
    row.outcome = 'customer_bought';
    const saved = await this.repo.save(row);
    await this.queueService.cancelPendingForConversation(saved.id, 'won');
    return saved;
  }

  async linkSale(id: string, dto: LinkSaleDto): Promise<FollowupConversation> {
    const row = await this.findById(id);
    row.linkedSaleId = dto.saleId;
    if (dto.leadSource) row.source = normalizeLeadSource(dto.leadSource);
    if (dto.assignedStaffId) row.assignedStaffId = dto.assignedStaffId;
    if (dto.customerId) row.customerId = dto.customerId;
    if (row.stage !== ConversationStage.WON) {
      row.stage = ConversationStage.WON;
      row.closedAt = new Date();
      row.outcome = 'customer_bought';
    }
    const saved = await this.repo.save(row);
    await this.queueService.cancelPendingForConversation(saved.id, 'won');
    await this.saleAttribution.recordFromLinkSale(saved, dto);
    return saved;
  }

  /** Fill empty CRM fields only — never overwrite staff-edited names/phones. */
  async syncIdentityIfEmpty(
    sessionId: string,
    chatId: string,
    hints?: { customerName?: string | null; customerPhone?: string | null },
  ): Promise<void> {
    const row = await this.findByThread(sessionId, chatId);
    if (!row) return;
    const before = `${row.customerName ?? ''}|${row.customerPhone ?? ''}`;
    this.applyIdentityHints(row, chatId, {
      notifyName: hints?.customerName ?? null,
      customerPhone: hints?.customerPhone ?? null,
    });
    const after = `${row.customerName ?? ''}|${row.customerPhone ?? ''}`;
    if (before !== after) await this.repo.save(row);
  }

  async backfillIdentity(options?: {
    dryRun?: boolean;
    limit?: number;
  }): Promise<{ scanned: number; phonesFilled: number; namesFilled: number }> {
    const limit = Math.min(Math.max(options?.limit ?? 5000, 1), 10_000);
    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.sessionId != :manual', { manual: MANUAL_SESSION })
      .andWhere("c.chatId NOT LIKE '%@g.us'")
      .take(limit)
      .getMany();

    const titleMap = await this.loadStoredChatTitles(rows);
    let phonesFilled = 0;
    let namesFilled = 0;

    for (const row of rows) {
      const beforePhone = row.customerPhone?.trim() ?? '';
      const beforeName = row.customerName?.trim() ?? '';
      this.applyIdentityHints(row, row.chatId);
      const chatTitle = titleMap.get(`${row.sessionId}:${row.chatId}`);
      if (!row.customerName?.trim() && chatTitle) {
        row.customerName = chatTitle;
      }
      if (!beforePhone && row.customerPhone?.trim()) phonesFilled++;
      if (!beforeName && row.customerName?.trim()) namesFilled++;
      const afterPhone = row.customerPhone?.trim() ?? '';
      const afterName = row.customerName?.trim() ?? '';
      if (!options?.dryRun && (afterPhone !== beforePhone || afterName !== beforeName)) {
        await this.repo.save(row);
      }
    }

    return { scanned: rows.length, phonesFilled, namesFilled };
  }

  private applyIdentityHints(
    row: FollowupConversation,
    chatId: string,
    hints?: {
      notifyName?: string | null;
      chatName?: string | null;
      customerPhone?: string | null;
    },
  ): void {
    const cleaned = sanitizeStoredPhone(chatId, row.customerPhone);
    if (cleaned) {
      row.customerPhone = cleaned;
    } else if (row.customerPhone?.trim()) {
      row.customerPhone = null;
    }

    if (!row.customerPhone?.trim()) {
      const hinted = hints?.customerPhone?.trim();
      const sanitized = hinted ? sanitizeStoredPhone(chatId, hinted) : null;
      if (sanitized) {
        row.customerPhone = sanitized;
      } else {
        const digits = phoneDigitsFromChatId(chatId);
        if (digits) row.customerPhone = `+${digits}`;
      }
    }

    if (!row.customerName?.trim()) {
      const notify = hints?.notifyName?.trim();
      if (
        notify &&
        !isInternalLidUserId(notify, chatId) &&
        looksLikePersonLabel(notify) &&
        !isGenericWhatsAppContactLabel(notify)
      ) {
        row.customerName = notify;
        return;
      }
      const chatTitle = hints?.chatName?.trim();
      if (
        chatTitle &&
        !chatId.endsWith('@g.us') &&
        !isInternalLidUserId(chatTitle, chatId) &&
        looksLikePersonLabel(chatTitle) &&
        !isGenericWhatsAppContactLabel(chatTitle)
      ) {
        row.customerName = chatTitle;
      }
    } else if (isGenericWhatsAppContactLabel(row.customerName)) {
      const notify = hints?.notifyName?.trim();
      if (
        notify &&
        !isInternalLidUserId(notify, chatId) &&
        looksLikePersonLabel(notify) &&
        !isGenericWhatsAppContactLabel(notify)
      ) {
        row.customerName = notify;
      } else {
        const cleanedName = resolveCustomerName(chatId, row.customerName);
        row.customerName = cleanedName;
      }
    } else {
      const cleanedName = resolveCustomerName(chatId, row.customerName);
      row.customerName = cleanedName;
    }
  }

  async chatTitlesForThreads(rows: FollowupConversation[]): Promise<Map<string, string>> {
    return this.loadStoredChatTitles(rows);
  }

  private async loadStoredChatTitles(
    rows: FollowupConversation[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const bySession = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!row.sessionId || row.sessionId === MANUAL_SESSION) continue;
      if (!bySession.has(row.sessionId)) bySession.set(row.sessionId, new Set());
      bySession.get(row.sessionId)!.add(row.chatId);
    }

    for (const [sessionId, chatIdSet] of bySession) {
      const chatIds = [...chatIdSet];
      if (chatIds.length === 0) continue;
      const messages = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.sessionId = :sessionId', { sessionId })
        .andWhere('m.chatId IN (:...chatIds)', { chatIds })
        .orderBy('m.createdAt', 'DESC')
        .getMany();

      for (const msg of messages) {
        const key = `${sessionId}:${msg.chatId}`;
        if (map.has(key)) continue;
        const meta = msg.metadata as { chatName?: string; notifyName?: string } | null;
        const notify = meta?.notifyName?.trim();
        if (
          notify &&
          !msg.chatId.endsWith('@g.us') &&
          !isInternalLidUserId(notify, msg.chatId) &&
          looksLikePersonLabel(notify) &&
          !isGenericWhatsAppContactLabel(notify)
        ) {
          map.set(key, notify);
          continue;
        }
        const title = meta?.chatName?.trim();
        if (
          title &&
          !msg.chatId.endsWith('@g.us') &&
          !isInternalLidUserId(title, msg.chatId) &&
          looksLikePersonLabel(title) &&
          !isGenericWhatsAppContactLabel(title)
        ) {
          map.set(key, title);
        }
      }
    }

    return map;
  }

  async listByStage(stage: ConversationStage, branchId?: string): Promise<FollowupConversation[]> {
    const qb = this.repo.createQueryBuilder('c').where('c.stage = :stage', { stage });
    if (branchId) qb.andWhere('(c.branchId = :branchId OR c.branchId IS NULL)', { branchId });
    return qb.getMany();
  }

  private normalizeStage(stage: ConversationStage): ConversationStage {
    if (stage === ConversationStage.REPLIED) return ConversationStage.CONTACTED;
    return stage;
  }
}
