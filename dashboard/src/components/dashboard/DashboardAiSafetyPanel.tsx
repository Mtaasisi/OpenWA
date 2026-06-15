import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { DashboardSection } from './DashboardSection';
import { settingsPanelHref, whatsappSafetyTabHref } from '../../components/settings/settings-nav-registry';
import { automationsHref } from '../../lib/automations-routes';
import type { AiSafetyMetrics } from '../../lib/dashboard-metrics';

interface DashboardAiSafetyPanelProps {
  metrics: AiSafetyMetrics;
  variant?: 'default' | 'dark';
}

export function DashboardAiSafetyPanel({ metrics, variant = 'default' }: DashboardAiSafetyPanelProps) {
  const { t } = useTranslation();

  return (
    <DashboardSection
      title={t('dashboard.controlRoom.aiSafety')}
      linkTo={automationsHref('autoReply')}
      linkLabel={t('dashboard.controlRoom.autoReplyHealth')}
      className={variant === 'dark' ? 'dash-section--ai-safety dash-section--ai-safety-dark' : 'dash-section--ai-safety'}
    >
      <div className="dash-ai-safety">
        {metrics.autoReplyMasterEnabled != null && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.autoReplyHealth')}</span>
            <Link
              to={automationsHref('autoReply')}
              className={`dash-ai-safety__value dash-ai-safety__value--link${metrics.autoReplyReady ? '' : ' dash-ai-safety__value--urgent'}`}
            >
              {metrics.autoReplyReady
                ? t('automations.autoReplyHealth.statusReady')
                : metrics.autoReplyMasterEnabled
                  ? t('automations.autoReplyHealth.statusPartial')
                  : t('automations.autoReplyHealth.statusOff')}
            </Link>
          </div>
        )}
        <div className="dash-ai-safety__row">
          <span>{t('dashboard.controlRoom.autonomyLevel')}</span>
          <span className="dash-ai-safety__value dash-ai-safety__value--accent">
            {metrics.autonomyPct}% {t('dashboard.controlRoom.autonomyActive')}
          </span>
        </div>
        <div className="dash-ai-safety__row">
          <span>{t('dashboard.controlRoom.manualTakeovers')}</span>
          <Link
            to="/inbox"
            state={{ filter: 'needs_human' }}
            className="dash-ai-safety__value dash-ai-safety__value--link"
          >
            {metrics.manualTakeovers}
            <span className="dash-ai-safety__hint">{t('dashboard.controlRoom.activeNow')}</span>
          </Link>
        </div>
        <div className="dash-ai-safety__row">
          <span>{t('dashboard.controlRoom.aiTakeovers24h')}</span>
          <span className="dash-ai-safety__value">{metrics.aiTakeovers24h}</span>
        </div>
        <div className="dash-ai-safety__row">
          <span>{t('dashboard.controlRoom.aiReplies24h')}</span>
          <span className="dash-ai-safety__value">{metrics.aiReplies24h}</span>
        </div>
        <div className="dash-ai-safety__row">
          <span>{t('dashboard.controlRoom.openAiEscalations')}</span>
          <Link
            to="/inbox"
            state={{ filter: 'needs_human' }}
            className={`dash-ai-safety__value dash-ai-safety__value--link${metrics.openEscalations > 0 ? ' dash-ai-safety__value--urgent' : ''}`}
          >
            {metrics.openEscalations}
          </Link>
        </div>
        {metrics.pendingLearning != null && metrics.pendingLearning > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.pendingLearning', { defaultValue: 'AI learning pending' })}</span>
            <Link to={settingsPanelHref('ai-learning')} className="dash-ai-safety__value dash-ai-safety__value--link">
              {metrics.pendingLearning}
            </Link>
          </div>
        )}
        {metrics.unknownQuestionsToday != null && metrics.unknownQuestionsToday > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.unknownQuestions', { defaultValue: 'Unknown questions today' })}</span>
            <span className="dash-ai-safety__value">{metrics.unknownQuestionsToday}</span>
          </div>
        )}
        {metrics.directAiEligible != null && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.directAiEligible', { defaultValue: 'Direct chats — AI ready' })}</span>
            <Link to="/inbox" state={{ filter: 'ai_active' }} className="dash-ai-safety__value dash-ai-safety__value--link">
              {metrics.directAiEligible}
            </Link>
          </div>
        )}
        {metrics.directAiBlocked != null && metrics.directAiBlocked > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.directAiBlocked', { defaultValue: 'Direct chats — AI blocked' })}</span>
            <Link
              to="/inbox"
              state={{ filter: 'needs_human' }}
              className="dash-ai-safety__value dash-ai-safety__value--link dash-ai-safety__value--urgent"
            >
              {metrics.directAiBlocked}
            </Link>
          </div>
        )}
        {metrics.aiPausedChats != null && metrics.aiPausedChats > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.aiPausedChats', { defaultValue: 'AI paused chats' })}</span>
            <Link to="/inbox" state={{ filter: 'needs_human' }} className="dash-ai-safety__value dash-ai-safety__value--link">
              {metrics.aiPausedChats}
            </Link>
          </div>
        )}
        {metrics.profileNameReview != null && metrics.profileNameReview > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.profileNameReview', { defaultValue: 'Names to review' })}</span>
            <Link to="/customers" className="dash-ai-safety__value dash-ai-safety__value--link">
              {metrics.profileNameReview}
            </Link>
          </div>
        )}
        {metrics.lostDemandWaiting != null && metrics.lostDemandWaiting > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.lostDemandWaiting', { defaultValue: 'Waiting for stock' })}</span>
            <Link to="/followups" className="dash-ai-safety__value dash-ai-safety__value--link">
              {metrics.lostDemandWaiting}
            </Link>
          </div>
        )}
        {metrics.waBlockedToday != null && metrics.waBlockedToday > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.waBlockedToday', { defaultValue: 'WA sends blocked today' })}</span>
            <span className="dash-ai-safety__value dash-ai-safety__value--urgent">{metrics.waBlockedToday}</span>
          </div>
        )}
        {metrics.waQueuePending != null && metrics.waQueuePending > 0 && (
          <div className="dash-ai-safety__row">
            <span>{t('dashboard.controlRoom.waQueuePending', { defaultValue: 'WA send queue pending' })}</span>
            <Link to={whatsappSafetyTabHref('queue')} className="dash-ai-safety__value dash-ai-safety__value--link">
              {metrics.waQueuePending}
            </Link>
          </div>
        )}
        <div className="dash-ai-safety__row">
          <span>{t('dashboard.controlRoom.flaggedAnomalies')}</span>
          <span
            className={`dash-ai-safety__value${metrics.flaggedUrgent > 0 ? ' dash-ai-safety__value--urgent' : ''}`}
          >
            {metrics.flaggedUrgent > 0
              ? t('dashboard.controlRoom.flaggedUrgent', { count: metrics.flaggedUrgent })
              : t('dashboard.controlRoom.flaggedClear')}
          </span>
        </div>
      </div>
      <MaterialSymbol
        name="security"
        size={20}
        filled
        className="dash-ai-safety__icon"
        aria-hidden
      />
    </DashboardSection>
  );
}
