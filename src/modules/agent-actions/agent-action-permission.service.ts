import { Injectable } from '@nestjs/common';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import type { AgentActionDefinition } from './agent-action.types';

const READ_ONLY_PERMISSIONS = new Set(['view_app_health', 'view_logs']);

const OPERATOR_WRITE_PERMISSIONS = new Set([
  'manage_ai_settings',
  'manage_whatsapp_channels',
  'manage_campaigns',
  'manage_followups',
  'manage_business_settings',
]);

@Injectable()
export class AgentActionPermissionService {
  canExecute(
    action: AgentActionDefinition,
    role: ApiKeyRole,
    mode: 'read' | 'write',
  ): { allowed: boolean; reason?: string } {
    if (action.risk === 'blocked') {
      return { allowed: false, reason: 'Action is blocked for safety.' };
    }

    if (action.adminOnly && role !== ApiKeyRole.ADMIN) {
      return { allowed: false, reason: 'Admin permission required.' };
    }

    const perm = action.requiredPermission;
    if (!perm) return { allowed: true };

    if (READ_ONLY_PERMISSIONS.has(perm)) {
      return { allowed: true };
    }

    if (mode === 'read' && READ_ONLY_PERMISSIONS.has(perm)) {
      return { allowed: true };
    }

    if (role === ApiKeyRole.ADMIN) return { allowed: true };

    if (role === ApiKeyRole.VIEWER) {
      if (READ_ONLY_PERMISSIONS.has(perm)) return { allowed: true };
      if (mode === 'read') return { allowed: true };
      return { allowed: false, reason: 'Viewer cannot change settings.' };
    }

    if (role === ApiKeyRole.OPERATOR) {
      if (
        OPERATOR_WRITE_PERMISSIONS.has(perm) ||
        perm === 'manage_whatsapp_safety' ||
        perm === 'manage_payment_settings'
      ) {
        if (perm === 'manage_whatsapp_safety' && action.id === 'whatsapp.safety.disable') {
          return { allowed: false, reason: 'Only admin can disable WhatsApp safety.' };
        }
        if (perm === 'manage_payment_settings' && action.risk === 'high') {
          return { allowed: false, reason: 'Only admin can update payment details directly.' };
        }
        if (perm === 'manage_system' || perm === 'manage_users' || perm === 'export_data') {
          return { allowed: false, reason: 'Admin permission required.' };
        }
        return { allowed: true };
      }
    }

    return { allowed: false, reason: 'Permission denied.' };
  }
}
