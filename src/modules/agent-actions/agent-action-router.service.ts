import { Injectable } from '@nestjs/common';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import type { AgentActionRequest, AgentActionResult } from './agent-action.types';
import { AgentActionRegistryService } from './agent-action-registry.service';
import { AgentActionMatcherService } from './agent-action-matcher.service';
import { AgentActionLlmMatcherService } from './agent-action-llm-matcher.service';
import { AgentActionPermissionService } from './agent-action-permission.service';
import { AgentActionRiskService } from './agent-action-risk.service';
import { AgentActionConfirmationService } from './agent-action-confirmation.service';
import { AgentActionExecutorService } from './agent-action-executor.service';
import { AgentActionAuditService } from './agent-action-audit.service';
import { AgentActionLinkService } from './agent-action-link.service';
import { AgentActionSettingsService } from './agent-action-settings.service';

@Injectable()
export class AgentActionRouterService {
  constructor(
    private readonly registry: AgentActionRegistryService,
    private readonly matcher: AgentActionMatcherService,
    private readonly llmMatcher: AgentActionLlmMatcherService,
    private readonly permissions: AgentActionPermissionService,
    private readonly risk: AgentActionRiskService,
    private readonly confirmations: AgentActionConfirmationService,
    private readonly executor: AgentActionExecutorService,
    private readonly audit: AgentActionAuditService,
    private readonly links: AgentActionLinkService,
    private readonly settings: AgentActionSettingsService,
  ) {}

  async resolve(request: AgentActionRequest, role: ApiKeyRole): Promise<AgentActionResult | null> {
    const cfg = await this.settings.get();
    if (!cfg.agentActionsEnabled) return null;

    const deterministic = this.matcher.match(request.text);
    if (!deterministic) return null;

    let match = deterministic;
    if (match.confidence >= 0.55 && match.confidence < 0.85) {
      const refined = await this.llmMatcher.refine(request.text, match);
      if (refined) match = refined;
    }

    if (match.confidence < 0.85) return null;

    return this.runAction(match.actionId, { ...request, params: { ...match.params, ...request.params } }, role);
  }

  async executeById(
    actionId: string,
    request: AgentActionRequest,
    role: ApiKeyRole,
  ): Promise<AgentActionResult> {
    return this.runAction(actionId, request, role);
  }

  async confirmAndExecute(
    confirmationId: string,
    request: AgentActionRequest,
    role: ApiKeyRole,
  ): Promise<AgentActionResult> {
    const { confirmation, params } = await this.confirmations.confirm(
      confirmationId,
      request.userId,
      role === ApiKeyRole.ADMIN,
    );
    const action = this.registry.getById(confirmation.actionId);
    if (!action) {
      return {
        actionId: confirmation.actionId,
        status: 'failed',
        message: 'Action not found',
        risk: confirmation.risk,
      };
    }
    return this.runAction(action.id, { ...request, params }, role, true);
  }

  private async runAction(
    actionId: string,
    request: AgentActionRequest,
    role: ApiKeyRole,
    skipConfirmation = false,
  ): Promise<AgentActionResult> {
    const action = this.registry.getById(actionId);
    if (!action) {
      return { actionId, status: 'failed', message: 'Action not found', risk: 'safe' };
    }

    if (action.risk === 'blocked') {
      const link = this.links.quickLinkForAction(actionId, action.settingsPanelId);
      await this.audit.logAttempt(action, request, 'blocked');
      return {
        actionId,
        status: 'blocked',
        message: 'Hii action hairuhusiwi kwa usalama.',
        risk: 'blocked',
        quickLinks: cfgQuickLinks(link),
      };
    }

    const cfg = await this.settings.get();
    if (!action.supportsDirectExecution) {
      const link = this.links.quickLinkForAction(actionId, action.settingsPanelId);
      await this.audit.logAttempt(action, request, 'link_only');
      return {
        actionId,
        status: 'link_only',
        message: this.linkOnlyMessage(actionId),
        risk: action.risk,
        quickLinks: cfgQuickLinks(link),
      };
    }

    const readOnly = this.risk.isReadOnlyAction(actionId);
    const perm = this.permissions.canExecute(action, role, readOnly ? 'read' : 'write');
    if (!perm.allowed) {
      const link = this.links.quickLinkForAction(actionId, action.settingsPanelId);
      await this.audit.logAttempt(action, request, 'permission_denied', { errorMessage: perm.reason });
      return {
        actionId,
        status: 'permission_denied',
        message: perm.reason ?? 'Permission denied',
        risk: action.risk,
        quickLinks: cfg.allowQuickLinks ? cfgQuickLinks(link) : undefined,
      };
    }

    const { mode, requiresConfirmation } = await this.risk.resolveMode(action, role);
    if (mode === 'blocked') {
      await this.audit.logAttempt(action, request, 'blocked', { errorMessage: 'Admin required' });
      return {
        actionId,
        status: 'blocked',
        message: 'Admin permission required for this action.',
        risk: action.risk,
        quickLinks: cfg.allowQuickLinks
          ? cfgQuickLinks(this.links.quickLinkForAction(actionId, action.settingsPanelId))
          : undefined,
      };
    }
    if (mode === 'quick_link') {
      const link = this.links.quickLinkForAction(actionId, action.settingsPanelId);
      await this.audit.logAttempt(action, request, 'link_only');
      return {
        actionId,
        status: 'link_only',
        message: this.linkOnlyMessage(actionId),
        risk: action.risk,
        quickLinks: cfgQuickLinks(link),
      };
    }

    if (requiresConfirmation && !skipConfirmation) {
      const confirmation = await this.confirmations.create(action, request, request.params ?? {});
      await this.audit.logAttempt(action, request, 'confirmation_required', {
        confirmationId: confirmation.id,
        requiredConfirmation: true,
      });
      return {
        actionId,
        status: 'confirmation_required',
        message: action.warningMessage ?? `Unataka niendelee na "${action.title}"?`,
        risk: action.risk,
        confirmationId: confirmation.id,
        quickLinks: action.settingsPanelId
          ? cfgQuickLinks(this.links.quickLinkForAction(actionId, action.settingsPanelId))
          : undefined,
      };
    }

    try {
      const outcome = await this.executor.execute(action, {
        params: request.params ?? {},
        request,
        role,
        apiKeyId: request.apiKeyId,
      });
      await this.audit.logAttempt(action, request, 'success', {
        oldValue: outcome.data?.oldValue,
        newValue: outcome.data?.newValue,
        params: request.params,
      });
      const link = action.settingsPanelId
        ? this.links.quickLinkForAction(actionId, action.settingsPanelId)
        : undefined;
      return {
        actionId,
        status: 'success',
        message: outcome.message,
        risk: action.risk,
        data: outcome.data,
        quickLinks: link ? cfgQuickLinks(link) : undefined,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.audit.logAttempt(action, request, 'failed', { errorMessage: msg });
      const link = this.links.quickLinkForAction(actionId, action.settingsPanelId);
      return {
        actionId,
        status: 'failed',
        message: msg,
        risk: action.risk,
        quickLinks: cfg.allowQuickLinks ? cfgQuickLinks(link) : undefined,
      };
    }
  }

  private linkOnlyMessage(actionId: string): string {
    const messages: Record<string, string> = {
      'whatsapp.qr.open': 'Nimekuletea sehemu ya WhatsApp QR.',
      'payment.settings.open': 'Nimekuletea sehemu sahihi ya kubadilisha payment details.',
      'payment.details.update': 'Badilisha payment details kwenye Payment Accounts.',
      'products.open': 'Nimekuletea products settings.',
      'webhooks.open': 'Nimekuletea webhooks settings.',
      'plugins.open': 'Nimekuletea plugins settings.',
      'infrastructure.open': 'Nimekuletea infrastructure settings.',
      'api_keys.open': 'Nimekuletea API keys settings.',
      'ai.provider.change': 'Badilisha AI provider kwenye settings.',
      'ai.training.open': 'Nimekuletea AI Training Center.',
      'ai.training.teach': 'Naweza kuhifadhi hii kama training item. Fungua Training Center ukubali.',
    };
    return messages[actionId] ?? 'Naweza kukupeleka moja kwa moja kwenye settings sahihi.';
  }
}

function cfgQuickLinks(link: { label: string; route: string; panelId?: string }) {
  return [{ label: link.label, route: link.route, panelId: link.panelId }];
}
