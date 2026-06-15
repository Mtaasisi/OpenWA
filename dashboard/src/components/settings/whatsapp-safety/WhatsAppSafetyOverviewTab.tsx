import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Trans } from 'react-i18next';
import { MaterialSymbol } from '../../MaterialSymbol';
import { WhatsAppLinkSafetyChecklist } from '../../WhatsAppLinkSafetyChecklist';
import { channelsUrl } from '../../../lib/channel-routes';
import type { WhatsAppLinkPreflightResult, WhatsAppSafetyAuditRow, WhatsAppSafetyOverview } from '../../../services/api';
import type { Session } from '../../../services/api';
import type { WhatsAppSafetyTabId } from './whatsapp-safety-tab-ids';

type Props = {
  overview: WhatsAppSafetyOverview;
  blockedSends: WhatsAppSafetyAuditRow[];
  sessions: Session[];
  linkCheckSessionId: string;
  onLinkCheckSessionChange: (id: string) => void;
  linkPreflight?: WhatsAppLinkPreflightResult;
  linkPreflightFetching: boolean;
  hasConnectedSession: boolean;
  onSelectTab: (tab: WhatsAppSafetyTabId) => void;
};

export function WhatsAppSafetyOverviewTab({
  overview,
  blockedSends,
  sessions,
  linkCheckSessionId,
  onLinkCheckSessionChange,
  linkPreflight,
  linkPreflightFetching,
  hasConnectedSession,
  onSelectTab,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {!hasConnectedSession && (
        <div className="wa-safety-alert" role="status">
          <MaterialSymbol name="warning" size={22} className="wa-safety-alert__icon" />
          <p className="wa-safety-alert__text">
            <Trans
              i18nKey="whatsappSafety.overview.noSessionAlert"
              components={{
                1: (
                  <Link
                    to={channelsUrl({ channel: 'whatsapp', add: true })}
                    className="wa-safety-alert__link"
                  />
                ),
              }}
            />
          </p>
        </div>
      )}

      <div className="wa-safety-kpi-grid">
        <button
          type="button"
          className="wa-safety-kpi wa-safety-kpi--clickable"
          onClick={() => onSelectTab('rules')}
        >
          <p className="wa-safety-kpi__label">{t('whatsappSafety.overview.safetyStatus')}</p>
          <p
            className={`wa-safety-kpi__value${overview.safetyEnabled ? ' wa-safety-kpi__value--ok' : ''}`}
          >
            {overview.safetyEnabled
              ? t('whatsappSafety.overview.guardEnabled')
              : t('whatsappSafety.overview.guardDisabled')}
            {overview.safetyEnabled ? <span className="wa-safety-kpi__dot" aria-hidden /> : null}
          </p>
        </button>
        <button
          type="button"
          className="wa-safety-kpi wa-safety-kpi--clickable"
          onClick={() => onSelectTab('queue')}
        >
          <p className="wa-safety-kpi__label">{t('whatsappSafety.overview.queuePending')}</p>
          <p className="wa-safety-kpi__value">{overview.pendingQueue}</p>
        </button>
        <button
          type="button"
          className="wa-safety-kpi wa-safety-kpi--clickable"
          onClick={() => onSelectTab('activity')}
        >
          <p className="wa-safety-kpi__label">{t('whatsappSafety.overview.blockedToday')}</p>
          <p className="wa-safety-kpi__value">{overview.blockedToday}</p>
        </button>
        <button
          type="button"
          className="wa-safety-kpi wa-safety-kpi--clickable"
          onClick={() => onSelectTab('consent')}
        >
          <p className="wa-safety-kpi__label">{t('whatsappSafety.overview.optedOut')}</p>
          <p className="wa-safety-kpi__value">{overview.optedOutContacts}</p>
        </button>
        <button
          type="button"
          className="wa-safety-kpi wa-safety-kpi--clickable"
          onClick={() => onSelectTab('queue')}
        >
          <p className="wa-safety-kpi__label">{t('whatsappSafety.overview.warmupAccounts')}</p>
          <p className="wa-safety-kpi__value">{overview.accountsInWarmup}</p>
        </button>
      </div>

      <section className="wa-safety-checklist-card">
        <header className="wa-safety-checklist-card__head">
          <h3 className="wa-safety-checklist-card__title">{t('whatsappLinkSafety.settingsCardTitle')}</h3>
          <p className="wa-safety-checklist-card__desc">{t('whatsappLinkSafety.settingsCardHint')}</p>
          <div className="wa-safety-checklist-card__meta">
            {sessions.length > 0 ? (
              <label className="wa-safety-checklist-card__session-chip">
                <MaterialSymbol name="search" size={18} />
                <span className="wa-safety-checklist-card__session-prefix">
                  {t('whatsappLinkSafety.settingsSession')}:
                </span>
                <select
                  value={linkCheckSessionId}
                  onChange={e => onLinkCheckSessionChange(e.target.value)}
                  className="wa-safety-checklist-card__session-select"
                  aria-label={t('whatsappLinkSafety.settingsSession')}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {linkPreflight ? (
              <span
                className={`wa-safety-checklist-card__badge${linkPreflight.ready ? ' is-ready' : ''}`}
              >
                {linkPreflight.ready
                  ? t('whatsappLinkSafety.statusReady')
                  : t('whatsappLinkSafety.statusReview')}
              </span>
            ) : null}
            {linkPreflight ? (
              <span className="wa-safety-checklist-card__progress">
                {t('whatsappLinkSafety.progress', {
                  completed: linkPreflight.completed,
                  total: linkPreflight.total,
                })}
                <span className="wa-safety-checklist-card__progress-dot" aria-hidden>
                  {' '}
                  ·{' '}
                </span>
                <span className="wa-safety-checklist-card__engine">{linkPreflight.engineType}</span>
                {linkPreflightFetching ? <Loader2 size={14} className="animate-spin" /> : null}
              </span>
            ) : null}
          </div>
        </header>
        <div className="wa-safety-checklist-card__body">
          <WhatsAppLinkSafetyChecklist
            embedded
            sessionId={linkCheckSessionId || undefined}
            mode="settings"
          />
        </div>
      </section>

      {blockedSends.length > 0 && (
        <section className="wa-safety-blocked-card">
          <div className="wa-safety-blocked-card__head">
            <h3 className="wa-safety-blocked-card__title">
              {t('whatsappSafety.overview.recentBlocked')}
            </h3>
            <button
              type="button"
              className="wa-safety-btn wa-safety-btn--ghost wa-safety-btn--sm"
              onClick={() => onSelectTab('activity')}
            >
              {t('whatsappSafety.overview.viewAllActivity')}
            </button>
          </div>
          <ul className="wa-safety-blocked-card__list">
            {blockedSends.slice(0, 5).map(row => (
              <li key={row.id}>
                {row.source}: {row.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
