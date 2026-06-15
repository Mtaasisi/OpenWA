import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WHATSAPP_SAFETY_SAFE_DEFAULTS } from '../constants/whatsapp-safety-safe-defaults';
import { WhatsAppSafetySettings } from '../entities/whatsapp-safety-settings.entity';
import { WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID } from '../enums/whatsapp-safety.enums';
import { OPT_OUT_KEYWORDS } from '../utils/opt-out-keywords.util';

@Injectable()
export class WhatsAppSafetySettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(WhatsAppSafetySettings, 'data')
    private readonly repo: Repository<WhatsAppSafetySettings>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  async ensureDefaults(): Promise<WhatsAppSafetySettings> {
    let row = await this.repo.findOne({ where: { id: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID } });
    if (!row) {
      row = this.repo.create({
        id: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID,
        ...WHATSAPP_SAFETY_SAFE_DEFAULTS,
        optOutKeywords: [...OPT_OUT_KEYWORDS],
      });
      await this.repo.save(row);
      return row;
    }
    return row;
  }

  /** Admin: restore global settings to safe-by-default values. */
  async resetGlobalToSafeDefaults(): Promise<WhatsAppSafetySettings> {
    const row = await this.getGlobal();
    Object.assign(row, WHATSAPP_SAFETY_SAFE_DEFAULTS, {
      id: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID,
      optOutKeywords: row.optOutKeywords?.length ? row.optOutKeywords : [...OPT_OUT_KEYWORDS],
    });
    return this.repo.save(row);
  }

  async getGlobal(): Promise<WhatsAppSafetySettings> {
    return (await this.repo.findOne({ where: { id: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID } })) ?? this.ensureDefaults();
  }

  async getForSession(sessionId: string): Promise<WhatsAppSafetySettings> {
    const sessionRow = await this.repo.findOne({ where: { sessionId } });
    if (sessionRow) return sessionRow;
    return this.getGlobal();
  }

  async updateGlobal(patch: Partial<WhatsAppSafetySettings>): Promise<WhatsAppSafetySettings> {
    const row = await this.getGlobal();
    Object.assign(row, patch, { id: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID });
    return this.repo.save(row);
  }

  async updateForSession(
    sessionId: string,
    patch: Partial<WhatsAppSafetySettings>,
  ): Promise<WhatsAppSafetySettings> {
    let row = await this.repo.findOne({ where: { sessionId } });
    if (!row) {
      const global = await this.getGlobal();
      row = this.repo.create({ ...global, id: undefined as unknown as string, sessionId });
    }
    Object.assign(row, patch, { sessionId });
    return this.repo.save(row);
  }
}
