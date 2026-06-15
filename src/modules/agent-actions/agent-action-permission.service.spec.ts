import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AgentActionPermissionService } from './agent-action-permission.service';
import type { AgentActionDefinition } from './agent-action.types';

describe('AgentActionPermissionService', () => {
  let service: AgentActionPermissionService;

  const baseAction = (overrides: Partial<AgentActionDefinition>): AgentActionDefinition =>
    ({
      id: 'test.action',
      title: 'Test',
      description: 'Test',
      category: 'ai',
      aliases: [],
      keywords: [],
      risk: 'safe',
      requiredPermission: 'manage_ai_settings',
      requiresConfirmation: false,
      supportsDirectExecution: true,
      ...overrides,
    }) as AgentActionDefinition;

  beforeEach(() => {
    service = new AgentActionPermissionService();
  });

  it('allows admin for any write action', () => {
    const action = baseAction({ adminOnly: true });
    expect(service.canExecute(action, ApiKeyRole.ADMIN, 'write').allowed).toBe(true);
  });

  it('denies viewer write', () => {
    const action = baseAction({});
    const result = service.canExecute(action, ApiKeyRole.VIEWER, 'write');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Viewer');
  });

  it('allows operator for manage_ai_settings', () => {
    const action = baseAction({});
    expect(service.canExecute(action, ApiKeyRole.OPERATOR, 'write').allowed).toBe(true);
  });

  it('blocks operator from disabling WhatsApp safety', () => {
    const action = baseAction({
      id: 'whatsapp.safety.disable',
      requiredPermission: 'manage_whatsapp_safety',
    });
    const result = service.canExecute(action, ApiKeyRole.OPERATOR, 'write');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('admin');
  });

  it('blocks non-admin adminOnly actions', () => {
    const action = baseAction({ adminOnly: true });
    const result = service.canExecute(action, ApiKeyRole.OPERATOR, 'write');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Admin');
  });

  it('allows read-only health checks for viewer', () => {
    const action = baseAction({
      id: 'app.health.check',
      requiredPermission: 'view_app_health',
    });
    expect(service.canExecute(action, ApiKeyRole.VIEWER, 'read').allowed).toBe(true);
  });
});
