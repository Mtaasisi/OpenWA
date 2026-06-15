import type { ApiKeyRole } from '../auth/entities/api-key.entity';

export type AgentActionRisk = 'safe' | 'medium' | 'high' | 'blocked';

export type AgentActionMode = 'read' | 'execute' | 'confirm' | 'quick_link' | 'blocked';

export type AgentActionStatus =
  | 'success'
  | 'failed'
  | 'confirmation_required'
  | 'permission_denied'
  | 'blocked'
  | 'link_only';

export type AgentActionCategory =
  | 'ai'
  | 'whatsapp'
  | 'business'
  | 'followup'
  | 'settings'
  | 'system'
  | 'health'
  | 'branch'
  | 'campaign'
  | 'data';

export type AgentActionExecutor = (
  ctx: AgentActionExecutionContext,
) => Promise<AgentActionExecutionOutcome>;

export interface AgentActionExecutionContext {
  params: Record<string, unknown>;
  request: AgentActionRequest;
  role: ApiKeyRole;
  apiKeyId?: string;
}

export interface AgentActionExecutionOutcome {
  message: string;
  data?: Record<string, unknown>;
}

export type AgentActionDefinition = {
  id: string;
  title: string;
  description: string;
  category: AgentActionCategory;
  aliases: string[];
  keywords: string[];
  risk: AgentActionRisk;
  requiredPermission?: string;
  requiresConfirmation: boolean;
  supportsDirectExecution: boolean;
  adminOnly?: boolean;
  settingsRoute?: string;
  settingsPanelId?: string;
  warningMessage?: string;
  execute?: AgentActionExecutor;
};

export type AgentActionRequest = {
  userId: string;
  userRole: string;
  tenantId?: string;
  businessId?: string;
  branchId?: string;
  text: string;
  currentPage?: string;
  currentChatId?: string;
  currentCustomerId?: string;
  params?: Record<string, unknown>;
  confirmationId?: string;
  apiKeyId?: string;
};

export type AgentActionResult = {
  actionId: string;
  status: AgentActionStatus;
  message: string;
  risk: AgentActionRisk;
  confirmationId?: string;
  quickLinks?: Array<{
    label: string;
    route: string;
    panelId?: string;
  }>;
  data?: Record<string, unknown>;
};

export interface AgentActionMatch {
  actionId: string;
  confidence: number;
  params: Record<string, unknown>;
}

export interface AgentActionSettingsView {
  agentActionsEnabled: boolean;
  allowSafeDirectExecution: boolean;
  requireConfirmationForMediumRisk: boolean;
  requireConfirmationForHighRisk: boolean;
  adminOnlyHighRisk: boolean;
  actionConfirmExpiryMinutes: number;
  actionAuditEnabled: boolean;
  showActionCardsInAiAssistant: boolean;
  allowQuickLinks: boolean;
}
