import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  WhatsAppSessionAutomationState,
  WhatsAppSessionHealthEvent,
} from '../entities/whatsapp-session-health-event.entity';
import {
  WhatsAppSessionHealthEventType,
  WhatsAppSessionHealthSeverity,
} from '../enums/whatsapp-safety.enums';

@Injectable()
export class WhatsAppSessionHealthService {
  private readonly logger = new Logger(WhatsAppSessionHealthService.name);

  constructor(
    @InjectRepository(WhatsAppSessionHealthEvent, 'data')
    private readonly eventRepo: Repository<WhatsAppSessionHealthEvent>,
    @InjectRepository(WhatsAppSessionAutomationState, 'data')
    private readonly stateRepo: Repository<WhatsAppSessionAutomationState>,
  ) {}

  async getOrCreateState(sessionId: string): Promise<WhatsAppSessionAutomationState> {
    let state = await this.stateRepo.findOne({ where: { sessionId } });
    if (!state) {
      state = this.stateRepo.create({ sessionId });
      await this.stateRepo.save(state);
    }
    return state;
  }

  async recordEvent(params: {
    sessionId: string;
    eventType: WhatsAppSessionHealthEventType;
    severity?: WhatsAppSessionHealthSeverity;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<WhatsAppSessionHealthEvent> {
    const row = this.eventRepo.create({
      sessionId: params.sessionId,
      eventType: params.eventType,
      severity: params.severity ?? WhatsAppSessionHealthSeverity.INFO,
      message: params.message,
      metadata: params.metadata ?? null,
    });
    return this.eventRepo.save(row);
  }

  async isAutomationPaused(sessionId: string): Promise<boolean> {
    const state = await this.stateRepo.findOne({ where: { sessionId } });
    return state?.automationPaused === true;
  }

  async isStartupSafeMode(sessionId: string): Promise<boolean> {
    const state = await this.stateRepo.findOne({ where: { sessionId } });
    if (!state?.startupSafeMode) return false;
    if (state.startupSafeModeUntil && state.startupSafeModeUntil.getTime() < Date.now()) {
      state.startupSafeMode = false;
      state.startupSafeModeUntil = null;
      await this.stateRepo.save(state);
      return false;
    }
    return true;
  }

  async enterStartupSafeMode(sessionId: string, delayMinutes: number): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.startupSafeMode = true;
    state.startupSafeModeUntil = new Date(Date.now() + delayMinutes * 60 * 1000);
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
    await this.recordEvent({
      sessionId,
      eventType: WhatsAppSessionHealthEventType.STARTUP_SAFE_MODE,
      severity: WhatsAppSessionHealthSeverity.INFO,
      message: `Session just linked — AI auto-reply paused for ${delayMinutes} min`,
    });
  }

  async pauseAutomation(sessionId: string, reason: string): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.automationPaused = true;
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
    await this.recordEvent({
      sessionId,
      eventType: WhatsAppSessionHealthEventType.AUTOMATION_PAUSED,
      severity: WhatsAppSessionHealthSeverity.WARNING,
      message: reason,
    });
  }

  async exitStartupSafeMode(sessionId: string): Promise<void> {
    const state = await this.stateRepo.findOne({ where: { sessionId } });
    if (!state?.startupSafeMode) return;
    state.startupSafeMode = false;
    state.startupSafeModeUntil = null;
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
    await this.recordEvent({
      sessionId,
      eventType: WhatsAppSessionHealthEventType.STARTUP_SAFE_MODE,
      severity: WhatsAppSessionHealthSeverity.INFO,
      message: 'Startup safe mode cleared',
    });
  }

  async resumeAutomation(sessionId: string): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.automationPaused = false;
    state.startupSafeMode = false;
    state.startupSafeModeUntil = null;
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
  }

  async recordSendFailure(sessionId: string): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.sendFailuresRecent += 1;
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
    await this.recordEvent({
      sessionId,
      eventType: WhatsAppSessionHealthEventType.SEND_FAILED,
      severity: WhatsAppSessionHealthSeverity.WARNING,
      message: 'Outbound send failed',
    });
  }

  async recordSendBlocked(sessionId: string, reason: string): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.sendBlockedRecent += 1;
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
    await this.recordEvent({
      sessionId,
      eventType: WhatsAppSessionHealthEventType.SEND_BLOCKED,
      severity: WhatsAppSessionHealthSeverity.INFO,
      message: reason,
    });
  }

  async recordSuccessfulSend(sessionId: string): Promise<void> {
    const state = await this.getOrCreateState(sessionId);
    state.sendsRecentHour += 1;
    state.sendsRecentDay += 1;
    state.updatedAt = new Date();
    await this.stateRepo.save(state);
  }

  async checkFailureRate(sessionId: string, threshold: number): Promise<boolean> {
    const state = await this.stateRepo.findOne({ where: { sessionId } });
    if (!state) return false;
    const total = state.sendFailuresRecent + state.sendsRecentHour;
    if (total < 10) return false;
    return state.sendFailuresRecent / total >= threshold;
  }

  async recentEvents(sessionId?: string, limit = 50): Promise<WhatsAppSessionHealthEvent[]> {
    const qb = this.eventRepo.createQueryBuilder('e').orderBy('e.createdAt', 'DESC').take(limit);
    if (sessionId) qb.where('e.sessionId = :sessionId', { sessionId });
    return qb.getMany();
  }

  async criticalAlerts(limit = 20): Promise<WhatsAppSessionHealthEvent[]> {
    return this.eventRepo.find({
      where: { severity: WhatsAppSessionHealthSeverity.CRITICAL },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
