import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FollowupAutopilotSettings,
  FOLLOWUP_AUTOPILOT_SETTINGS_ID,
} from './entities/followup-autopilot-settings.entity';
import { FollowUpAutopilotMode } from './followup.enums';
import type { Session } from '../session/entities/session.entity';

export interface SessionHealthEntry {
  pausedUntil?: string;
  failureCount?: number;
  blockedCount?: number;
  lastFailureAt?: string;
}

export interface UpdateAutopilotSettingsDto {
  enabled?: boolean;
  autopilotMode?: FollowUpAutopilotMode;
  businessHoursOnly?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  maxFollowupsPerCustomerPerDay?: number;
  maxFollowupsPerLead?: number;
  requireApprovalForMediumRisk?: boolean;
  requireApprovalForHighRisk?: boolean;
  allowSmsFallback?: boolean;
  allowWhatsAppSmsBoth?: boolean;
  allowGroupAutopilot?: boolean;
  pauseOnHighFailureRate?: boolean;
  pauseOnCustomerComplaint?: boolean;
  staffTakeoverPauseMinutes?: number;
}

@Injectable()
export class FollowupAutopilotSettingsService {
  constructor(
    @InjectRepository(FollowupAutopilotSettings, 'data')
    private readonly settingsRepo: Repository<FollowupAutopilotSettings>,
  ) {}

  async getSettings(): Promise<FollowupAutopilotSettings> {
    return this.ensureSettings();
  }

  async updateSettings(dto: UpdateAutopilotSettingsDto): Promise<FollowupAutopilotSettings> {
    const settings = await this.ensureSettings();
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  resolveEffectiveMode(
    settings: FollowupAutopilotSettings,
    session: Session | null,
    aiConfigured: boolean,
  ): FollowUpAutopilotMode {
    if (!settings.enabled) return FollowUpAutopilotMode.OFF;
    if (!session?.config?.followupAutopilotEnabled) return FollowUpAutopilotMode.OFF;
    if (session && this.isSessionPaused(settings, session.id)) {
      return FollowUpAutopilotMode.OFF;
    }
    if (!aiConfigured) return FollowUpAutopilotMode.SUGGEST_ONLY;
    return settings.autopilotMode;
  }

  isSessionPaused(settings: FollowupAutopilotSettings, sessionId: string): boolean {
    const health = this.parseHealth(settings);
    const entry = health[sessionId];
    if (!entry?.pausedUntil) return false;
    return new Date(entry.pausedUntil).getTime() > Date.now();
  }

  async pauseSession(sessionId: string, until: Date, reason: string): Promise<void> {
    const settings = await this.ensureSettings();
    const health = this.parseHealth(settings);
    health[sessionId] = {
      ...health[sessionId],
      pausedUntil: until.toISOString(),
      lastFailureAt: new Date().toISOString(),
    };
    settings.sessionHealthJson = JSON.stringify({ ...health, _lastReason: reason });
    await this.settingsRepo.save(settings);
  }

  async recordFailure(sessionId: string): Promise<void> {
    const settings = await this.ensureSettings();
    if (!settings.pauseOnHighFailureRate) return;
    const health = this.parseHealth(settings);
    const entry = health[sessionId] ?? {};
    entry.failureCount = (entry.failureCount ?? 0) + 1;
    entry.lastFailureAt = new Date().toISOString();
    health[sessionId] = entry;
    if ((entry.failureCount ?? 0) >= 5) {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
      entry.pausedUntil = until.toISOString();
    }
    settings.sessionHealthJson = JSON.stringify(health);
    await this.settingsRepo.save(settings);
  }

  async recordSuccess(sessionId: string): Promise<void> {
    const settings = await this.ensureSettings();
    const health = this.parseHealth(settings);
    if (health[sessionId]) {
      health[sessionId].failureCount = 0;
      settings.sessionHealthJson = JSON.stringify(health);
      await this.settingsRepo.save(settings);
    }
  }

  async unpauseSession(sessionId: string): Promise<void> {
    const settings = await this.ensureSettings();
    const health = this.parseHealth(settings);
    if (health[sessionId]) {
      delete health[sessionId].pausedUntil;
      health[sessionId].failureCount = 0;
      settings.sessionHealthJson = JSON.stringify(health);
      await this.settingsRepo.save(settings);
    }
  }

  getSessionHealthSummary(settings: FollowupAutopilotSettings): {
    pausedAccounts: string[];
  } {
    const health = this.parseHealth(settings);
    const pausedAccounts = Object.entries(health)
      .filter(([key, v]) => key !== '_lastReason' && v.pausedUntil && new Date(v.pausedUntil).getTime() > Date.now())
      .map(([sessionId]) => sessionId);
    return { pausedAccounts };
  }

  private parseHealth(settings: FollowupAutopilotSettings): Record<string, SessionHealthEntry> {
    if (!settings.sessionHealthJson) return {};
    try {
      return JSON.parse(settings.sessionHealthJson) as Record<string, SessionHealthEntry>;
    } catch {
      return {};
    }
  }

  private async ensureSettings(): Promise<FollowupAutopilotSettings> {
    let settings = await this.settingsRepo.findOne({ where: { id: FOLLOWUP_AUTOPILOT_SETTINGS_ID } });
    if (!settings) {
      settings = this.settingsRepo.create({ id: FOLLOWUP_AUTOPILOT_SETTINGS_ID });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }
}
