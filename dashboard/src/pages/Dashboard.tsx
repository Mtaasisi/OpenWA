import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAiLearningAlerts } from '../hooks/useAiLearningAlerts';
import { useRole } from '../hooks/useRole';
import { getDashboardScope } from '../lib/dashboard-scope';
import { isDesktopApp } from '../lib/desktop-shell';
import { AskAiLink } from '../components/AskAiLink';
import { MaterialSymbol } from '../components/MaterialSymbol';
import { WorkspacePageHeader } from '../components/workspace';
import { StatusBadge } from '../components/dashboard';
import { DashboardAutopilotSummary } from '../components/dashboard/DashboardAutopilotSummary';
import { DashboardHeroKpiRow } from '../components/dashboard/DashboardHeroKpiRow';
import { DashboardCompoundKpiRow } from '../components/dashboard/DashboardCompoundKpiRow';
import { DashboardSalesSnapshot } from '../components/dashboard/DashboardSalesSnapshot';
import { filterCompoundKpisForTab } from '../lib/dashboard-metrics';
import { DashboardNeedsAttention } from '../components/dashboard/DashboardNeedsAttention';
import { DashboardTodaysWork } from '../components/dashboard/DashboardTodaysWork';
import { DashboardSalesPipeline } from '../components/dashboard/DashboardSalesPipeline';
import { DashboardChannelHealth } from '../components/dashboard/DashboardChannelHealth';
import { DashboardStaffPerformance } from '../components/dashboard/DashboardStaffPerformance';
import { DashboardHotLeads } from '../components/dashboard/DashboardHotLeads';
import { DashboardProductDemand } from '../components/dashboard/DashboardProductDemand';
import { DashboardQuotePerformance } from '../components/dashboard/DashboardQuotePerformance';
import { DashboardRecentActivity } from '../components/dashboard/DashboardRecentActivity';
import { DashboardSystemPanel } from '../components/dashboard/DashboardSystemPanel';
import { DashboardWorkSummary } from '../components/dashboard/DashboardWorkSummary';
import { DashboardAiSafetyPanel } from '../components/dashboard/DashboardAiSafetyPanel';
import { DashboardAiStatusBubble } from '../components/dashboard/DashboardAiStatusBubble';
import { DashboardMyInboxSummary } from '../components/dashboard/DashboardMyInboxSummary';
import { DashboardMyQuickActions } from '../components/dashboard/DashboardMyQuickActions';
import type { DashboardTab } from '../lib/dashboard-metrics';
import './Dashboard.css';
import '../components/dashboard/dashboard-primitives.css';
import '../styles/control-room-shell.css';

const ADMIN_TABS: DashboardTab[] = [
  'overview',
  'today',
  'inbox_ai',
  'sales',
  'operations',
  'system',
];

export function Dashboard() {
  const { t } = useTranslation();
  const { activeTheme } = useTheme();
  const themeEffects = activeTheme.effects ?? 'classic';
  const { role, roleValidated } = useRole();
  const scope = getDashboardScope(role, roleValidated);
  const isAdmin = scope === 'admin';
  useAiLearningAlerts(isAdmin);

  useDocumentTitle(
    isAdmin ? t('dashboard.controlRoom.title') : t('dashboard.myWorkspace.title'),
  );

  const [tab, setTab] = useState<DashboardTab>('overview');
  const data = useDashboardData(scope);

  const tabItems = ADMIN_TABS.map(id => ({
    id,
    label: t(`dashboard.controlRoom.tabs.${id}`),
  }));

  const connected = (data.sessionStats?.ready ?? 0) > 0;
  const pendingWork = data.workItems.length;
  const dueTodayCount = (data.queueCounts as { due_today?: number }).due_today ?? 0;
  const needsReplyCount = data.unreplied.length;

  const headerActions = (
    <>
      {isAdmin && (
        <StatusBadge variant={connected ? 'connected' : 'disconnected'}>
          {connected ? t('common.connected') : t('common.disconnected')}
        </StatusBadge>
      )}
      {isDesktopApp() && isAdmin && (
        <Link to="/ai" className="desktop-header-ai-pill" title={t('nav.aiAssistant')}>
          <span
            className={`desktop-header-ai-pill__dot desktop-header-ai-pill__dot--${data.aiSafety.coreStatus}`}
            aria-hidden
          />
          <span className="desktop-header-ai-pill__label">
            {t(`dashboard.controlRoom.aiCore.${data.aiSafety.coreStatus}`)}
          </span>
        </Link>
      )}
      <AskAiLink prompt={t('ai.prompts.sessions')} className="ask-ai-link-btn--toolbar" />
      <Link to="/inbox" className="fu-btn fu-btn--ghost fu-btn--toolbar" title={t('nav.inbox')}>
        <MaterialSymbol name="inbox" size={16} />
        <span className="fu-btn__label">{t('nav.inbox')}</span>
      </Link>
      <Link to="/followups" className="fu-btn fu-btn--ghost fu-btn--toolbar" title={t('nav.followups')}>
        <MaterialSymbol name="notifications" size={16} />
        <span className="fu-btn__label">{t('nav.followups')}</span>
      </Link>
      {isAdmin ? (
        <Link to="/channels" className="fu-btn fu-btn--primary fu-btn--toolbar" title={t('nav.channels')}>
          <MaterialSymbol name="sensors" size={16} />
          <span className="fu-btn__label">{t('nav.channels')}</span>
        </Link>
      ) : (
        <Link to="/templates" className="fu-btn fu-btn--primary fu-btn--toolbar" title={t('nav.templates')}>
          <MaterialSymbol name="article" size={16} />
          <span className="fu-btn__label">{t('nav.templates')}</span>
        </Link>
      )}
    </>
  );

  const pageShellClass =
    themeEffects === 'tactical'
      ? 'followups-interakt dashboard-interakt dashboard-tactical'
      : 'followups-interakt dashboard-interakt';

  if (data.isLoading) {
    return (
      <div className={pageShellClass} data-theme-effects={themeEffects}>
        <WorkspacePageHeader
          title={isAdmin ? t('dashboard.controlRoom.title') : t('dashboard.myWorkspace.title')}
          showSearch={false}
          showExport={false}
          showNewTask={false}
          extraActions={headerActions}
        />
        <div className="followups-interakt__scroll">
          <div className="dashboard dashboard--loading">
            <Loader2 className="animate-spin" size={32} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={pageShellClass} data-theme-effects={themeEffects}>
        <WorkspacePageHeader
          title={t('dashboard.myWorkspace.title')}
          showSearch={false}
          showExport={false}
          showNewTask={false}
          extraActions={headerActions}
        />

        <div className="followups-interakt__scroll">
          <div className="dashboard dashboard--control-room dashboard--my-workspace">
            <DashboardCompoundKpiRow kpis={data.compoundKpis} loading={data.isLoading} />

            <div className="dashboard-overview-grid">
              <DashboardNeedsAttention alerts={data.alerts} />
              <div className="dashboard-overview-rail">
                <DashboardMyInboxSummary
                  assigned={data.assignedConversations}
                  unreadAssigned={data.unreadAssigned}
                  needsReply={needsReplyCount}
                />
                <DashboardWorkSummary pendingCount={pendingWork} dueTodayCount={dueTodayCount} />
              </div>
            </div>

            <div className="dashboard-today-grid">
              <DashboardTodaysWork items={data.workItems} />
              <div className="dashboard-overview-rail">
                <DashboardQuotePerformance summary={data.quoteSummary} />
                <DashboardMyQuickActions />
              </div>
            </div>

            <div className="dashboard-two-col">
              <DashboardHotLeads
                leads={data.hotLeadCards}
                compact
                quoteValueByThread={data.threadValueLookup}
              />
              {data.myStaffRow ? (
                <DashboardStaffPerformance rows={[data.myStaffRow]} compact />
              ) : (
                <DashboardRecentActivity entries={data.timeline} compact />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={pageShellClass} data-theme-effects={themeEffects}>
      <WorkspacePageHeader
        title={t('dashboard.controlRoom.title')}
        showSearch={false}
        showExport={false}
        showNewTask={false}
        extraActions={headerActions}
      />

      <div className="followups-interakt__scroll">
        <nav className="cr-tab-nav" role="tablist" aria-label={t('dashboard.controlRoom.title')}>
          {tabItems.map(item => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={['cr-tab-nav__btn', tab === item.id ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="dashboard dashboard--control-room dashboard--control-room-v2">
          {tab === 'overview' && (
            <>
              <DashboardHeroKpiRow kpis={data.heroKpis} loading={data.isLoading} />

              <div className="cr-main-grid">
                <DashboardNeedsAttention alerts={data.alerts} />
                <DashboardTodaysWork items={data.workItems} />
                <DashboardChannelHealth
                  sessions={data.sessions}
                  conversations={data.conversations}
                  compact
                  failedBySession={data.failedBySession}
                  sessionSafety={data.sessionSafety}
                />
              </div>

              <div className="cr-lower-grid">
                <DashboardSalesSnapshot summary={data.quoteSummary} wonToday={data.wonToday} />
                <DashboardProductDemand
                  products={data.productDemand}
                  draftCampaignsCount={data.draftCampaignsCount}
                  lostDemandWaiting={data.lostDemandWaiting}
                />
                <DashboardAiSafetyPanel metrics={data.aiSafety} variant="dark" />
                <DashboardHotLeads
                  leads={data.hotLeadCards}
                  compact
                  quoteValueByThread={data.threadValueLookup}
                />
              </div>
            </>
          )}

          {tab === 'today' && (
            <>
              <DashboardCompoundKpiRow
                kpis={filterCompoundKpisForTab(data.compoundKpis, 'today')}
                loading={data.isLoading}
              />
              <div className="dashboard-today-grid">
                <DashboardTodaysWork items={data.workItems} />
                <div className="dashboard-overview-rail">
                  <DashboardWorkSummary pendingCount={pendingWork} dueTodayCount={dueTodayCount} />
                  <DashboardRecentActivity entries={data.timeline} compact />
                </div>
              </div>
            </>
          )}

          {tab === 'inbox_ai' && (
            <div className="cr-lower-grid cr-lower-grid--two">
              <DashboardAutopilotSummary />
              <DashboardAiSafetyPanel metrics={data.aiSafety} />
              <DashboardMyInboxSummary
                assigned={data.assignedConversations}
                unreadAssigned={data.unreadAssigned}
                needsReply={needsReplyCount}
              />
              <DashboardRecentActivity entries={data.timeline} compact />
            </div>
          )}

          {tab === 'sales' && (
            <>
              <div className="dashboard-pipeline-band">
                <DashboardSalesPipeline stages={data.pipelineStages} />
              </div>
              <div className="dashboard-two-col">
                <DashboardHotLeads
                  leads={data.hotLeadCards}
                  compact
                  quoteValueByThread={data.threadValueLookup}
                />
                <DashboardQuotePerformance summary={data.quoteSummary} />
              </div>
              <DashboardProductDemand
                products={data.productDemand}
                draftCampaignsCount={data.draftCampaignsCount}
                lostDemandWaiting={data.lostDemandWaiting}
              />
            </>
          )}

          {tab === 'operations' && (
            <div className="dashboard-team-grid">
              <DashboardStaffPerformance rows={data.staffRows} />
              <DashboardChannelHealth
                sessions={data.sessions}
                conversations={data.conversations}
                failedBySession={data.failedBySession}
                sessionSafety={data.sessionSafety}
              />
            </div>
          )}

          {tab === 'system' && (
            <div className="dashboard-tab-panel">
              <DashboardSystemPanel alerts={data.systemAlerts} sessions={data.sessions} />
            </div>
          )}
        </div>
      </div>

      {!isDesktopApp() && (
        <DashboardAiStatusBubble
          coreStatus={data.aiSafety.coreStatus}
          autoReplyMasterEnabled={data.aiSafety.autoReplyMasterEnabled}
          autoReplyReady={data.aiSafety.autoReplyReady}
        />
      )}
    </div>
  );
}
