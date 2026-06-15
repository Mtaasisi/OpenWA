import { Injectable } from '@nestjs/common';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import type { AgentActionDefinition } from './agent-action.types';
import { AGENT_ACTION_DEFINITIONS } from './agent-action-registry.data';

@Injectable()
export class AgentActionRegistryService {
  private readonly actions = new Map<string, AgentActionDefinition>(
    AGENT_ACTION_DEFINITIONS.map(d => [d.id, d]),
  );

  getAll(): AgentActionDefinition[] {
    return [...this.actions.values()];
  }

  getById(id: string): AgentActionDefinition | undefined {
    return this.actions.get(id);
  }

  listForRole(role: ApiKeyRole): AgentActionDefinition[] {
    return this.getAll().filter(a => {
      if (a.risk === 'blocked') return false;
      if (a.adminOnly && role !== ApiKeyRole.ADMIN) return false;
      return true;
    });
  }
}
