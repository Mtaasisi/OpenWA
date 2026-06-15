import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { WorkspacePageHeader, ChannelBadge } from '../components/workspace';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import { FollowupReports } from './FollowupReports';
import { PipelineReports } from './PipelineReports';
import './Reports.css';

export function Reports() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section');
  const { linkedChannels, showChannelBadge } = useLinkedChannels();
  useDocumentTitle(t('reports.pageTitle'));

  if (section === 'staff') {
    return <FollowupReports />;
  }

  if (section === 'pipeline') {
    return <PipelineReports />;
  }

  return (
    <div className="followups-interakt reports-interakt">
      <WorkspacePageHeader
        title={t('reports.pageTitle')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
      />

      <div className="followups-interakt__scroll">
        <section className="reports-hub__section">
          <h2 className="reports-hub__heading">{t('reports.availableReports')}</h2>
          <div className="reports-hub__cards">
            <Link to="/reports?section=staff" className="reports-hub__card fu-glass-card">
              <MaterialSymbol name="groups" size={22} className="reports-hub__card-icon" />
              <h3>{t('nav.myPerformance')}</h3>
              <p>{t('reports.staffPerformanceDesc')}</p>
            </Link>
            <Link to="/reports?section=pipeline" className="reports-hub__card fu-glass-card">
              <MaterialSymbol name="bar_chart" size={22} className="reports-hub__card-icon" />
              <h3>{t('reports.pipelineReports')}</h3>
              <p>{t('reports.pipelineReportsDesc')}</p>
            </Link>
          </div>
        </section>

        {showChannelBadge && linkedChannels.length > 0 && (
          <section className="reports-hub__section">
            <h2 className="reports-hub__heading">{t('reports.byChannel')}</h2>
            <div className="reports-hub__channels">
              {linkedChannels.map(ch => (
                <div key={ch.id} className="reports-hub__channel-row fu-glass-card">
                  <ChannelBadge channelId={ch.id} forceShow />
                  <span className="reports-hub__channel-status">{t('reports.dataAvailable')}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
