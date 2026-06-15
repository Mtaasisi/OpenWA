import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { WorkspacePageHeader } from '../components/workspace';
import { QuickRepliesPanel } from '../components/settings/QuickRepliesPanel';
import { FollowupTemplatesPanel } from '../components/settings/FollowupTemplatesPanel';
import './Templates.css';

type TemplateTab = 'quickReplies' | 'followup';

export function Templates() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TemplateTab>('quickReplies');
  useDocumentTitle(t('templates.pageTitle'));

  return (
    <div className="followups-interakt templates-interakt">
      <WorkspacePageHeader
        title={t('templates.pageTitle')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
      />

      <div className="followups-interakt__scroll">
        <div className="fu-view-row">
          <div className="fu-chips" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'quickReplies'}
              className={['fu-chip', tab === 'quickReplies' ? 'fu-chip--active' : ''].join(' ')}
              onClick={() => setTab('quickReplies')}
            >
              {t('templates.tabs.quickReplies')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'followup'}
              className={['fu-chip', tab === 'followup' ? 'fu-chip--active' : ''].join(' ')}
              onClick={() => setTab('followup')}
            >
              {t('templates.tabs.followup')}
            </button>
          </div>
        </div>

        <div className="templates-panel fu-glass-card">
          {tab === 'quickReplies' ? <QuickRepliesPanel /> : <FollowupTemplatesPanel />}
        </div>
      </div>
    </div>
  );
}
