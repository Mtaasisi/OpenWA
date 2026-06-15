import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppAccountWarmup } from '../entities/whatsapp-account-warmup.entity';
import { WhatsAppWarmupStatus } from '../enums/whatsapp-safety.enums';
import { WhatsAppMessageType } from '../enums/whatsapp-safety.enums';

const WARMUP_PLAN: Record<number, Partial<WhatsAppAccountWarmup>> = {
  1: { maxOutboundToday: 30, maxCampaignToday: 0, maxAutoRepliesToday: 5, maxFollowupsToday: 0, repliesOnly: true, allowCampaigns: false, allowFollowupAutoSend: false, allowAiAutoReply: true },
  2: { maxOutboundToday: 50, maxCampaignToday: 0, maxAutoRepliesToday: 8, maxFollowupsToday: 0, repliesOnly: true, allowCampaigns: false, allowFollowupAutoSend: false, allowAiAutoReply: true },
  3: { maxOutboundToday: 80, maxCampaignToday: 0, maxAutoRepliesToday: 10, maxFollowupsToday: 2, repliesOnly: false, allowCampaigns: false, allowFollowupAutoSend: false, allowAiAutoReply: true },
  4: { maxOutboundToday: 120, maxCampaignToday: 0, maxAutoRepliesToday: 15, maxFollowupsToday: 5, repliesOnly: false, allowCampaigns: false, allowFollowupAutoSend: true, allowAiAutoReply: true },
  5: { maxOutboundToday: 150, maxCampaignToday: 5, maxAutoRepliesToday: 20, maxFollowupsToday: 8, repliesOnly: false, allowCampaigns: false, allowFollowupAutoSend: true, allowAiAutoReply: true },
  6: { maxOutboundToday: 180, maxCampaignToday: 10, maxAutoRepliesToday: 25, maxFollowupsToday: 10, repliesOnly: false, allowCampaigns: true, allowFollowupAutoSend: true, allowAiAutoReply: true },
  7: { maxOutboundToday: 200, maxCampaignToday: 15, maxAutoRepliesToday: 30, maxFollowupsToday: 15, repliesOnly: false, allowCampaigns: true, allowFollowupAutoSend: true, allowAiAutoReply: true },
};

@Injectable()
export class WhatsAppWarmupService {
  private readonly logger = new Logger(WhatsAppWarmupService.name);

  constructor(
    @InjectRepository(WhatsAppAccountWarmup, 'data')
    private readonly repo: Repository<WhatsAppAccountWarmup>,
  ) {}

  async startWarmup(sessionId: string): Promise<WhatsAppAccountWarmup> {
    const existing = await this.repo.findOne({ where: { sessionId } });
    if (existing) return existing;

    const plan = WARMUP_PLAN[1];
    const row = this.repo.create({
      sessionId,
      status: WhatsAppWarmupStatus.ACTIVE,
      startedAt: new Date(),
      dayNumber: 1,
      ...plan,
    });
    return this.repo.save(row);
  }

  async getWarmup(sessionId: string): Promise<WhatsAppAccountWarmup | null> {
    return this.repo.findOne({ where: { sessionId } });
  }

  async getOrCreate(sessionId: string): Promise<WhatsAppAccountWarmup> {
    return (await this.getWarmup(sessionId)) ?? this.startWarmup(sessionId);
  }

  async advanceDayIfNeeded(sessionId: string): Promise<WhatsAppAccountWarmup | null> {
    const row = await this.getWarmup(sessionId);
    if (!row || row.status !== WhatsAppWarmupStatus.ACTIVE) return row;

    const daysSinceStart = Math.floor(
      (Date.now() - row.startedAt.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1;

    if (daysSinceStart <= row.dayNumber) return row;

    const newDay = Math.min(daysSinceStart, 7);
    const plan = WARMUP_PLAN[newDay] ?? WARMUP_PLAN[7];
    row.dayNumber = newDay;
    Object.assign(row, plan);
    row.outboundSentToday = 0;
    row.autoReplySentToday = 0;
    row.followupSentToday = 0;
    row.campaignSentToday = 0;

    if (newDay >= 7) {
      row.status = WhatsAppWarmupStatus.COMPLETED;
    }

    return this.repo.save(row);
  }

  async recordOutbound(sessionId: string, messageType?: WhatsAppMessageType): Promise<void> {
    const row = await this.getOrCreate(sessionId);
    row.outboundSentToday += 1;
    if (messageType === WhatsAppMessageType.AI_AUTO_REPLY) row.autoReplySentToday += 1;
    if (messageType === WhatsAppMessageType.FOLLOW_UP) row.followupSentToday += 1;
    if (messageType === WhatsAppMessageType.CAMPAIGN || messageType === WhatsAppMessageType.MARKETING) {
      row.campaignSentToday += 1;
    }
    await this.repo.save(row);
  }

  async resetWarmup(sessionId: string): Promise<WhatsAppAccountWarmup> {
    await this.repo.delete({ sessionId });
    return this.startWarmup(sessionId);
  }

  checkWarmupAllows(params: {
    warmup: WhatsAppAccountWarmup | null;
    messageType: WhatsAppMessageType;
    isManualStaffSend?: boolean;
  }): { allowed: boolean; reason: string } {
    const { warmup, messageType, isManualStaffSend } = params;
    if (!warmup || warmup.status === WhatsAppWarmupStatus.COMPLETED || warmup.status === WhatsAppWarmupStatus.DISABLED) {
      return { allowed: true, reason: 'Warm-up not active' };
    }
    if (warmup.status === WhatsAppWarmupStatus.PAUSED) {
      return { allowed: false, reason: 'Account warm-up is paused' };
    }

    if (warmup.outboundSentToday >= warmup.maxOutboundToday) {
      return { allowed: false, reason: `Warm-up daily limit reached (${warmup.maxOutboundToday})` };
    }

    if (warmup.repliesOnly && !isManualStaffSend && messageType !== WhatsAppMessageType.CUSTOMER_REPLY && messageType !== WhatsAppMessageType.MANUAL) {
      if ([WhatsAppMessageType.CAMPAIGN, WhatsAppMessageType.MARKETING, WhatsAppMessageType.FOLLOW_UP].includes(messageType)) {
        return { allowed: false, reason: 'Warm-up day: replies only — campaigns and follow-ups blocked' };
      }
    }

    if (messageType === WhatsAppMessageType.CAMPAIGN || messageType === WhatsAppMessageType.MARKETING) {
      if (!warmup.allowCampaigns) {
        return { allowed: false, reason: 'Campaigns not allowed during warm-up' };
      }
    }

    if (messageType === WhatsAppMessageType.FOLLOW_UP && !warmup.allowFollowupAutoSend) {
      return { allowed: false, reason: 'Follow-up auto-send not allowed during warm-up' };
    }

    if (messageType === WhatsAppMessageType.AI_AUTO_REPLY && !warmup.allowAiAutoReply) {
      return { allowed: false, reason: 'AI auto-reply not allowed during warm-up' };
    }

    if (messageType === WhatsAppMessageType.AI_AUTO_REPLY && warmup.autoReplySentToday >= warmup.maxAutoRepliesToday) {
      return { allowed: false, reason: 'Warm-up daily AI reply limit reached' };
    }

    if (messageType === WhatsAppMessageType.FOLLOW_UP && warmup.followupSentToday >= warmup.maxFollowupsToday && !isManualStaffSend) {
      return { allowed: false, reason: 'Warm-up daily follow-up limit reached' };
    }

    if ((messageType === WhatsAppMessageType.CAMPAIGN || messageType === WhatsAppMessageType.MARKETING) && warmup.campaignSentToday >= warmup.maxCampaignToday) {
      return { allowed: false, reason: 'Warm-up daily campaign limit reached' };
    }

    return { allowed: true, reason: 'Warm-up allows send' };
  }

  async pause(sessionId: string): Promise<WhatsAppAccountWarmup | null> {
    const row = await this.getWarmup(sessionId);
    if (!row) return null;
    row.status = WhatsAppWarmupStatus.PAUSED;
    return this.repo.save(row);
  }

  async resume(sessionId: string): Promise<WhatsAppAccountWarmup | null> {
    const row = await this.getWarmup(sessionId);
    if (!row) return null;
    row.status = WhatsAppWarmupStatus.ACTIVE;
    return this.repo.save(row);
  }

  async listActive(): Promise<WhatsAppAccountWarmup[]> {
    return this.repo.find({
      where: [{ status: WhatsAppWarmupStatus.ACTIVE }, { status: WhatsAppWarmupStatus.PAUSED }],
    });
  }

  async updateWarmup(sessionId: string, patch: Partial<WhatsAppAccountWarmup>): Promise<WhatsAppAccountWarmup> {
    const row = await this.getOrCreate(sessionId);
    Object.assign(row, patch);
    return this.repo.save(row);
  }
}
