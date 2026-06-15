import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { WorkspacePageHeader, ComingSoonPanel } from '../components/workspace';
import { FollowupRulesPanel } from '../components/settings/FollowupRulesPanel';
import { FollowupAutopilotSettingsPanel } from '../components/settings/FollowupAutopilotSettingsPanel';
import { AiIntegrationPanel } from '../components/settings/AiIntegrationPanel';
import { AutomationsOverviewPanel } from '../components/automations/AutomationsOverviewPanel';
import { AutoReplyHealthPanel } from '../components/automations/AutoReplyHealthPanel';
import { parseAutomationTab, type AutomationTab } from '../lib/automations-routes';
import './Automations.css';

export function Automations() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseAutomationTab(searchParams.get('tab'));
  useDocumentTitle(t('automations.pageTitle'));

  useEffect(() => {
    if (searchParams.get('tab') === tab) return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, tab]);

  const selectTab = (nextTab: AutomationTab) => {
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const tabs: Array<[AutomationTab, string]> = [
    ['overview', t('automations.tabs.overview')],
    ['autoReply', t('automations.tabs.autoReply')],
    ['autopilot', t('automations.tabs.autopilot')],
    ['rules', t('automations.tabs.rules')],
    ['future', t('automations.tabs.more')],
  ];

  return (
    <div className="followups-interakt automations-interakt">
      <WorkspacePageHeader
        title={t('automations.pageTitle')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
      />

      <div className="followups-interakt__scroll">
        <div className="fu-view-row">
          <div className="fu-chips automations-interakt__chips" role="tablist">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={['fu-chip', tab === id ? 'fu-chip--active' : ''].join(' ')}
                onClick={() => selectTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`automations-panel fu-glass-card${tab === 'overview' ? ' automations-panel--overview' : ''}`}
        >
          {tab === 'overview' && <AutomationsOverviewPanel onOpenTab={selectTab} />}
          {tab === 'autoReply' && (
            <>
              <AutoReplyHealthPanel />
              <AiIntegrationPanel scope="autoReply" />
            </>
          )}
          {tab === 'rules' && <FollowupRulesPanel />}
          {tab === 'autopilot' && <FollowupAutopilotSettingsPanel />}
          {tab === 'future' && (
            <div className="automations-future">
              <ComingSoonPanel
                title={t('workspace.comingSoonTitle')}
                description={t('automations.comingSoonDescription')}
              />
              <ul className="automations-future__list">
                <li>{t('automations.futurePlanned.businessHours')}</li>
                <li>{t('automations.futurePlanned.optOutWords')}</li>
                <li>{t('automations.futurePlanned.multiChannelRules')}</li>
                <li>{t('automations.futurePlanned.escalationPaths')}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
