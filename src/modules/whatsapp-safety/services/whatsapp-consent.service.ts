import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppContactConsent } from '../entities/whatsapp-contact-consent.entity';
import {
  WhatsAppOptInSource,
  WhatsAppOptInStatus,
} from '../enums/whatsapp-safety.enums';
import { detectOptOutKeyword } from '../utils/opt-out-keywords.util';

export interface CustomerServiceWindow {
  within24h: boolean;
  lastCustomerMessageAt: Date | null;
  expiresAt: Date | null;
  requiresTemplate: boolean;
}

@Injectable()
export class WhatsAppConsentService {
  constructor(
    @InjectRepository(WhatsAppContactConsent, 'data')
    private readonly repo: Repository<WhatsAppContactConsent>,
  ) {}

  normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits || phone;
  }

  async findConsent(sessionId: string | null, phone: string): Promise<WhatsAppContactConsent | null> {
    const normalizedPhone = this.normalizePhone(phone);
    if (sessionId) {
      const bySession = await this.repo.findOne({ where: { sessionId, normalizedPhone } });
      if (bySession) return bySession;
    }
    return this.repo.findOne({ where: { normalizedPhone, sessionId: null as unknown as string } });
  }

  async upsertFromInbound(params: {
    sessionId: string;
    phone: string;
    chatId: string;
    messageAt: Date;
  }): Promise<WhatsAppContactConsent> {
    const normalizedPhone = this.normalizePhone(params.phone);
    let row = await this.repo.findOne({ where: { sessionId: params.sessionId, normalizedPhone } });
    if (!row) {
      row = this.repo.create({
        sessionId: params.sessionId,
        phone: params.phone,
        normalizedPhone,
        optInStatus: WhatsAppOptInStatus.OPTED_IN,
        optInSource: WhatsAppOptInSource.CUSTOMER_INITIATED,
        optInAt: params.messageAt,
        canMarketing: false,
        canUtility: true,
        canFollowup: true,
      });
    }
    row.lastUserMessageAt = params.messageAt;
    if (row.optInStatus === WhatsAppOptInStatus.UNKNOWN) {
      row.optInStatus = WhatsAppOptInStatus.OPTED_IN;
      row.optInSource = WhatsAppOptInSource.CUSTOMER_INITIATED;
      row.optInAt = params.messageAt;
    }
    return this.repo.save(row);
  }

  async recordOutbound(sessionId: string, phone: string): Promise<void> {
    const normalizedPhone = this.normalizePhone(phone);
    const row = await this.repo.findOne({ where: { sessionId, normalizedPhone } });
    if (row) {
      row.lastOutboundMessageAt = new Date();
      await this.repo.save(row);
    }
  }

  async handleOptOut(params: {
    sessionId: string;
    phone: string;
    reason: string;
  }): Promise<WhatsAppContactConsent> {
    const normalizedPhone = this.normalizePhone(params.phone);
    let row = await this.repo.findOne({ where: { sessionId: params.sessionId, normalizedPhone } });
    if (!row) {
      row = this.repo.create({
        sessionId: params.sessionId,
        phone: params.phone,
        normalizedPhone,
      });
    }
    row.optInStatus = WhatsAppOptInStatus.OPTED_OUT;
    row.optOutAt = new Date();
    row.optOutReason = params.reason;
    row.canMarketing = false;
    row.canFollowup = false;
    return this.repo.save(row);
  }

  isOptedOut(consent: WhatsAppContactConsent | null): boolean {
    if (!consent) return false;
    return (
      consent.optInStatus === WhatsAppOptInStatus.OPTED_OUT ||
      consent.optInStatus === WhatsAppOptInStatus.SUPPRESSED
    );
  }

  canSendMarketing(consent: WhatsAppContactConsent | null): boolean {
    if (this.isOptedOut(consent)) return false;
    return consent?.canMarketing === true;
  }

  canSendFollowup(consent: WhatsAppContactConsent | null): boolean {
    if (this.isOptedOut(consent)) return false;
    return consent?.canFollowup !== false;
  }

  canSendOptOutAck(consent: WhatsAppContactConsent | null): boolean {
    if (!consent) return true;
    return !consent.optOutAckSent;
  }

  async markOptOutAckSent(sessionId: string, phone: string): Promise<void> {
    const row = await this.findConsent(sessionId, phone);
    if (row) {
      row.optOutAckSent = true;
      await this.repo.save(row);
    }
  }

  processInboundForOptOut(message: string): boolean {
    return detectOptOutKeyword(message);
  }

  async listOptedOut(limit = 100): Promise<WhatsAppContactConsent[]> {
    return this.repo.find({
      where: { optInStatus: WhatsAppOptInStatus.OPTED_OUT },
      order: { optOutAt: 'DESC' },
      take: limit,
    });
  }

  async listMarketingGaps(limit = 50): Promise<WhatsAppContactConsent[]> {
    return this.repo.find({
      where: { optInStatus: WhatsAppOptInStatus.OPTED_IN, canMarketing: false },
      order: { updatedAt: 'DESC' },
      take: limit,
    });
  }

  async countOptedOut(): Promise<number> {
    return this.repo.count({ where: { optInStatus: WhatsAppOptInStatus.OPTED_OUT } });
  }
}

@Injectable()
export class WhatsAppServiceWindowService {
  constructor(private readonly consentService: WhatsAppConsentService) {}

  getWindowFromLastMessage(lastCustomerMessageAt: Date | null): CustomerServiceWindow {
    if (!lastCustomerMessageAt) {
      return {
        within24h: false,
        lastCustomerMessageAt: null,
        expiresAt: null,
        requiresTemplate: true,
      };
    }
    const windowMs = 24 * 60 * 60 * 1000;
    const expiresAt = new Date(lastCustomerMessageAt.getTime() + windowMs);
    const within24h = Date.now() < expiresAt.getTime();
    return {
      within24h,
      lastCustomerMessageAt,
      expiresAt,
      requiresTemplate: !within24h,
    };
  }

  async getCustomerServiceWindow(sessionId: string, phone: string): Promise<CustomerServiceWindow> {
    const consent = await this.consentService.findConsent(sessionId, phone);
    return this.getWindowFromLastMessage(consent?.lastUserMessageAt ?? null);
  }
}
