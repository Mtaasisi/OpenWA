import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AgentActionSettings,
  AGENT_ACTION_SETTINGS_ID,
} from './entities/agent-action-settings.entity';
import type { AgentActionSettingsView } from './agent-action.types';

@Injectable()
export class AgentActionSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(AgentActionSettings, 'data')
    private readonly repo: Repository<AgentActionSettings>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensure();
  }

  async ensure(): Promise<AgentActionSettings> {
    let row = await this.repo.findOne({ where: { id: AGENT_ACTION_SETTINGS_ID } });
    if (!row) {
      row = this.repo.create({ id: AGENT_ACTION_SETTINGS_ID });
      await this.repo.save(row);
    }
    return row;
  }

  async get(): Promise<AgentActionSettingsView> {
    const row = await this.ensure();
    return {
      agentActionsEnabled: row.agentActionsEnabled,
      allowSafeDirectExecution: row.allowSafeDirectExecution,
      requireConfirmationForMediumRisk: row.requireConfirmationForMediumRisk,
      requireConfirmationForHighRisk: row.requireConfirmationForHighRisk,
      adminOnlyHighRisk: row.adminOnlyHighRisk,
      actionConfirmExpiryMinutes: row.actionConfirmExpiryMinutes,
      actionAuditEnabled: row.actionAuditEnabled,
      showActionCardsInAiAssistant: row.showActionCardsInAiAssistant,
      allowQuickLinks: row.allowQuickLinks,
    };
  }
}
