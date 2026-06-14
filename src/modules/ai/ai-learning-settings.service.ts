import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AI_LEARNING_SETTINGS_ID,
  AiLearningSettings,
} from './entities/ai-learning-settings.entity';

@Injectable()
export class AiLearningSettingsService {
  constructor(
    @InjectRepository(AiLearningSettings, 'data')
    private readonly repo: Repository<AiLearningSettings>,
  ) {}

  async getSettings(): Promise<AiLearningSettings> {
    const existing = await this.repo.findOne({ where: { id: AI_LEARNING_SETTINGS_ID } });
    if (existing) return existing;

    try {
      const row = this.repo.create(AiLearningSettings.defaults());
      await this.repo.save(row);
      return row;
    } catch (error) {
      const raced = await this.repo.findOne({ where: { id: AI_LEARNING_SETTINGS_ID } });
      if (raced) return raced;
      throw error;
    }
  }

  async updateSettings(patch: Partial<AiLearningSettings>): Promise<AiLearningSettings> {
    const row = await this.getSettings();
    Object.assign(row, patch);
    delete (row as { id?: string }).id;
    row.id = AI_LEARNING_SETTINGS_ID;
    return this.repo.save(row);
  }

  async resetDefaults(): Promise<AiLearningSettings> {
    const defaults = AiLearningSettings.defaults();
    let row = await this.repo.findOne({ where: { id: AI_LEARNING_SETTINGS_ID } });
    if (!row) {
      row = this.repo.create(defaults);
    } else {
      Object.assign(row, defaults);
    }
    return this.repo.save(row);
  }
}
