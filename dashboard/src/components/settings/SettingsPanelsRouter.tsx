import { Suspense, lazy } from 'react';
import { SettingsEmbedFrame } from './shell/SettingsEmbedFrame';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { SettingsPanelId } from './settings-nav-registry';
import { resolvePanelSection } from './settings-nav-registry';
import { useQuickReplyPermissions } from '../../hooks/useQuickReplyPermissions';
import { useFollowupPermissions } from '../../hooks/useFollowupPermissions';
import { useAiCostPermissions } from '../../hooks/useAiCostPermissions';
import { lazyWithRetry } from '../../lib/lazy-with-retry';
import { SettingsIntegrationShell } from './SettingsIntegrationShell';

const InauzwaIntegrationPanel = lazy(
  lazyWithRetry(() =>
    import('./InauzwaIntegrationPanel').then(m => ({ default: m.InauzwaIntegrationPanel })),
  ),
);
const FollowupTemplatesPanel = lazy(
  lazyWithRetry(() =>
    import('./FollowupTemplatesPanel').then(m => ({ default: m.FollowupTemplatesPanel })),
  ),
);
const WhatsAppSafetyPanel = lazy(
  lazyWithRetry(() =>
    import('./WhatsAppSafetyPanel').then(m => ({ default: m.WhatsAppSafetyPanel })),
  ),
);
const QuickRepliesPanel = lazy(
  lazyWithRetry(() =>
    import('./QuickRepliesPanel').then(m => ({ default: m.QuickRepliesPanel })),
  ),
);
const LeadSourceSettingsPanel = lazy(
  lazyWithRetry(() =>
    import('./LeadSourceSettingsPanel').then(m => ({ default: m.LeadSourceSettingsPanel })),
  ),
);
const AiIntegrationPanel = lazy(
  lazyWithRetry(() =>
    import('./AiIntegrationPanel').then(m => ({ default: m.AiIntegrationPanel })),
  ),
);
const AiKnowledgePanel = lazy(
  lazyWithRetry(() =>
    import('./AiKnowledgePanel').then(m => ({ default: m.AiKnowledgePanel })),
  ),
);
const AiBranchProfilePanel = lazy(
  lazyWithRetry(() =>
    import('./AiBranchProfilePanel').then(m => ({ default: m.AiBranchProfilePanel })),
  ),
);
const AiLearningProductDemandPanel = lazy(
  lazyWithRetry(() =>
    import('./ai-learning/AiLearningProductDemandPanel').then(m => ({
      default: m.AiLearningProductDemandPanel,
    })),
  ),
);
const AiMemoryPanel = lazy(
  lazyWithRetry(() => import('./AiMemoryPanel').then(m => ({ default: m.AiMemoryPanel }))),
);
const AiToolsCatalogPanel = lazy(
  lazyWithRetry(() =>
    import('./AiToolsCatalogPanel').then(m => ({ default: m.AiToolsCatalogPanel })),
  ),
);
const AiUsageCostPanel = lazy(
  lazyWithRetry(() =>
    import('./AiUsageCostPanel').then(m => ({ default: m.AiUsageCostPanel })),
  ),
);

const Webhooks = lazy(
  lazyWithRetry(() => import('../../pages/Webhooks').then(m => ({ default: m.Webhooks }))),
);
const Plugins = lazy(
  lazyWithRetry(() => import('../../pages/Plugins').then(m => ({ default: m.Plugins }))),
);
const Infrastructure = lazy(
  lazyWithRetry(() =>
    import('../../pages/Infrastructure').then(m => ({ default: m.Infrastructure })),
  ),
);
const ApiKeys = lazy(
  lazyWithRetry(() => import('../../pages/ApiKeys').then(m => ({ default: m.ApiKeys }))),
);
const SettingsUsersPanel = lazy(
  lazyWithRetry(() =>
    import('./SettingsUsersPanel').then(m => ({ default: m.SettingsUsersPanel })),
  ),
);
const Logs = lazy(
  lazyWithRetry(() => import('../../pages/Logs').then(m => ({ default: m.Logs }))),
);
const StorageBackup = lazy(
  lazyWithRetry(() =>
    import('../../pages/StorageBackup').then(m => ({ default: m.StorageBackup })),
  ),
);
const DesktopAppSettingsPanel = lazy(
  lazyWithRetry(() =>
    import('./DesktopAppSettingsPanel').then(m => ({ default: m.DesktopAppSettingsPanel })),
  ),
);
const AgentActionsLogPanel = lazy(
  lazyWithRetry(() =>
    import('./AgentActionsLogPanel').then(m => ({ default: m.AgentActionsLogPanel })),
  ),
);

interface Props {
  panelId: SettingsPanelId;
  onBack: () => void;
  isAdmin: boolean;
  pluginSearch?: string;
}

export function SettingsPanelsRouter({ panelId, onBack, isAdmin, pluginSearch }: Props) {
  const { t } = useTranslation();
  const { canManage: canManageQuickReplies } = useQuickReplyPermissions();
  const { canManageMessageTemplates } = useFollowupPermissions();
  const { canView: canViewAiCost, isLoading: aiCostPermsLoading } = useAiCostPermissions();

  const embedFallback = (
    <div className="settings-integration-loading">
      <Loader2 className="animate-spin" size={24} />
    </div>
  );

  return (
    <div className="settings-integration-detail">
      <Suspense fallback={embedFallback}>
        {(panelId === 'ai-auto-reply' || panelId === 'ai-human-behavior') && isAdmin && (
          <AiIntegrationPanel onBack={onBack} scope="autoReply" />
        )}
        {panelId === 'ai' && isAdmin && (
          <AiIntegrationPanel onBack={onBack} scope="provider" />
        )}
        {panelId === 'ai-knowledge' && isAdmin && <AiKnowledgePanel onBack={onBack} />}
        {panelId === 'ai-branch-profile' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('ai.branchProfile.title')}
            askAiPanelId="ai-branch-profile"
          >
            <AiBranchProfilePanel />
          </SettingsIntegrationShell>
        )}
        {panelId === 'ai-learning' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('ai.learning.title')}
          >
            <AiLearningProductDemandPanel />
          </SettingsIntegrationShell>
        )}
        {panelId === 'ai-memory' && isAdmin && <AiMemoryPanel onBack={onBack} />}
        {panelId === 'ai-tools' && <AiToolsCatalogPanel onBack={onBack} />}
        {panelId === 'ai-usage' && aiCostPermsLoading && embedFallback}
        {panelId === 'ai-usage' && !aiCostPermsLoading && canViewAiCost && (
          <AiUsageCostPanel onBack={onBack} />
        )}
        {panelId === 'products' && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('settings.integrations.productsTitle')}
            askAiPanelId="products"
          >
            <Suspense fallback={embedFallback}>
              <InauzwaIntegrationPanel showCatalogLink />
            </Suspense>
          </SettingsIntegrationShell>
        )}
        {panelId === 'quick-replies' && canManageQuickReplies && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('quickReplies.settingsTitle')}
          >
            <QuickRepliesPanel />
          </SettingsIntegrationShell>
        )}
        {panelId === 'lead-sources' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('leadSources.settings.title')}
          >
            <LeadSourceSettingsPanel />
          </SettingsIntegrationShell>
        )}
        {panelId === 'followup-templates' && canManageMessageTemplates && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('followups.templates.title')}
          >
            <FollowupTemplatesPanel />
          </SettingsIntegrationShell>
        )}
        {panelId === 'whatsapp-safety' && isAdmin && <WhatsAppSafetyPanel onBack={onBack} />}
        {panelId === 'webhooks' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('nav.webhooks')}
            askAiPanelId="webhooks"
          >
            <SettingsEmbedFrame>
              <Webhooks embedded />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
        {panelId === 'plugins' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('nav.plugins')}
            askAiPanelId="plugins"
          >
            <SettingsEmbedFrame className="settings-plugins-embed">
              <Plugins embedded interakt searchQuery={pluginSearch} />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
        {panelId === 'infrastructure' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('nav.infrastructure')}
            askAiPanelId="infrastructure"
          >
            <SettingsEmbedFrame>
              <Infrastructure embedded />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
        {panelId === 'users' && isAdmin && <SettingsUsersPanel onBack={onBack} />}
        {panelId === 'api-keys' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('nav.serviceApiKeys')}
            askAiPanelId="api-keys"
          >
            <SettingsEmbedFrame>
              <ApiKeys embedded />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
        {panelId === 'logs' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('nav.logs')}
            askAiPanelId="logs"
          >
            <SettingsEmbedFrame>
              <Logs embedded />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
        {panelId === 'storage-backup' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('settings.storageBackup.pageTitle')}
            askAiPanelId="storage-backup"
          >
            <SettingsEmbedFrame>
              <StorageBackup embedded />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
        {panelId === 'desktop-app' && isAdmin && (
          <DesktopAppSettingsPanel
            onBack={onBack}
            backSection={resolvePanelSection(panelId)}
          />
        )}
        {panelId === 'agent-actions-log' && isAdmin && (
          <SettingsIntegrationShell
            chromeless
            backSection={resolvePanelSection(panelId)}
            onBack={onBack}
            title={t('settings.agentActions.nav', { defaultValue: 'Agent Actions Log' })}
            askAiPanelId="agent-actions-log"
          >
            <SettingsEmbedFrame>
              <AgentActionsLogPanel embedded />
            </SettingsEmbedFrame>
          </SettingsIntegrationShell>
        )}
      </Suspense>
    </div>
  );
}
