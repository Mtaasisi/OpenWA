import { Injectable } from '@nestjs/common';
import type { AgentActionDefinition, AgentActionMode, AgentActionRisk } from './agent-action.types';
import type { AgentActionSettingsView } from './agent-action.types';
import { AgentActionSettingsService } from './agent-action-settings.service';

@Injectable()
export class AgentActionRiskService {
  constructor(private readonly settings: AgentActionSettingsService) {}

  async resolveMode(
    action: AgentActionDefinition,
    role: string,
  ): Promise<{ mode: AgentActionMode; requiresConfirmation: boolean }> {
    const cfg = await this.settings.get();

    if (action.risk === 'blocked') {
      return { mode: 'blocked', requiresConfirmation: false };
    }

    if (!action.supportsDirectExecution) {
      return { mode: 'quick_link', requiresConfirmation: false };
    }

    let requiresConfirmation = action.requiresConfirmation;

    if (action.risk === 'medium' && cfg.requireConfirmationForMediumRisk) {
      requiresConfirmation = true;
    }
    if (action.risk === 'high') {
      requiresConfirmation = cfg.requireConfirmationForHighRisk || action.requiresConfirmation;
      if (cfg.adminOnlyHighRisk && role !== 'admin') {
        return { mode: 'blocked', requiresConfirmation: true };
      }
    }

    if (requiresConfirmation) {
      return { mode: 'confirm', requiresConfirmation: true };
    }

    if (action.risk === 'safe' && cfg.allowSafeDirectExecution) {
      return { mode: 'execute', requiresConfirmation: false };
    }

    if (action.risk === 'safe') {
      return { mode: 'execute', requiresConfirmation: false };
    }

    return { mode: 'confirm', requiresConfirmation: true };
  }

  isReadOnlyAction(actionId: string): boolean {
    return actionId === 'app.health.check' || actionId === 'ai.reply.diagnose';
  }
}
