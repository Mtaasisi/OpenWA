import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { UseMutationResult } from '@tanstack/react-query';
import type {
  Session,
  WhatsAppSafetyAuditRow,
  WhatsAppSessionHealthEvent,
  WhatsAppSessionHealthDetail,
} from '../../../services/api';
import {
  formatSafetySendSource,
  formatSafetySessionLabel,
} from '../../../lib/whatsapp-safety-display';

type Props = {
  blockedSends: WhatsAppSafetyAuditRow[];
  auditLogs: WhatsAppSafetyAuditRow[];
  sessions: Session[];
  sessionHealthById: Map<string, WhatsAppSessionHealthDetail | undefined>;
  healthEvents: WhatsAppSessionHealthEvent[];
  loadingHealthEvents: boolean;
  pauseAutomation: UseMutationResult<unknown, Error, string, unknown>;
  resumeAutomation: UseMutationResult<unknown, Error, string, unknown>;
};

export function WhatsAppSafetyActivityTab({
  blockedSends,
  auditLogs,
  sessions,
  sessionHealthById,
  healthEvents,
  loadingHealthEvents,
  pauseAutomation,
  resumeAutomation,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {loadingHealthEvents && (
        <div className="settings-integration-loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!loadingHealthEvents && (
        <>
          <section className="wa-safety-bento">
            <h3 className="wa-safety-section-title">{t('whatsappSafety.health.sessions')}</h3>
            <ul className="wa-safety-list">
              {sessions.map(session => {
                const detail = sessionHealthById.get(session.id);
                return (
                  <li key={session.id} className="wa-safety-list-row">
                    <span className="wa-safety-list-row__main">
                      <strong>{formatSafetySessionLabel(session.id, sessions)}</strong>
                      {' · '}
                      {detail?.automationPaused
                        ? t('whatsappSafety.health.automationPaused')
                        : t('whatsappSafety.health.automationActive')}
                      {detail?.startupSafeMode &&
                        ` · ${t('whatsappSafety.health.startupSafeMode')}`}
                      {typeof detail?.queuePending === 'number' &&
                        ` · ${t('whatsappSafety.health.queuePending', {
                          count: detail.queuePending,
                        })}`}
                    </span>
                    <div className="wa-safety-list-row__actions">
                      {detail?.automationPaused ? (
                        <button
                          type="button"
                          className="wa-safety-btn wa-safety-btn--primary"
                          disabled={resumeAutomation.isPending}
                          onClick={() => resumeAutomation.mutate(session.id)}
                        >
                          {t('whatsappSafety.health.resumeAutomation')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="wa-safety-btn wa-safety-btn--ghost"
                          disabled={pauseAutomation.isPending}
                          onClick={() => pauseAutomation.mutate(session.id)}
                        >
                          {t('whatsappSafety.health.pauseAutomation')}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {blockedSends.length > 0 && (
            <section className="wa-safety-bento wa-safety-bento--stack">
              <h3 className="wa-safety-section-title">{t('whatsappSafety.audit.blockedSends')}</h3>
              <div className="wa-safety-table-card">
                <table className="settings-int-table">
                  <thead>
                    <tr>
                      <th>{t('whatsappSafety.audit.source')}</th>
                      <th>{t('whatsappSafety.audit.reason')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedSends.slice(0, 50).map(row => (
                      <tr key={`blocked-${row.id}`}>
                        <td>{formatSafetySendSource(row.source, t)}</td>
                        <td>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="wa-safety-bento wa-safety-bento--stack">
            <h3 className="wa-safety-section-title">{t('whatsappSafety.audit.allDecisions')}</h3>
            <div className="wa-safety-table-card">
              <table className="settings-int-table">
                <thead>
                  <tr>
                    <th>{t('whatsappSafety.audit.decision')}</th>
                    <th>{t('whatsappSafety.audit.source')}</th>
                    <th>{t('whatsappSafety.audit.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.slice(0, 100).map(row => (
                    <tr key={row.id}>
                      <td>{row.decision}</td>
                      <td>{formatSafetySendSource(row.source, t)}</td>
                      <td>{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="wa-safety-bento">
            <h3 className="wa-safety-section-title">{t('whatsappSafety.health.recentEvents')}</h3>
            {healthEvents.length === 0 ? (
              <p className="wa-safety-empty">{t('whatsappSafety.health.noEvents')}</p>
            ) : (
              <div className="wa-safety-table-card">
                <table className="settings-int-table">
                  <thead>
                    <tr>
                      <th>{t('whatsappSafety.health.session')}</th>
                      <th>{t('whatsappSafety.health.event')}</th>
                      <th>{t('whatsappSafety.health.severity')}</th>
                      <th>{t('whatsappSafety.health.message')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthEvents.slice(0, 50).map(row => (
                      <tr key={row.id}>
                        <td>{formatSafetySessionLabel(row.sessionId, sessions)}</td>
                        <td>{row.eventType}</td>
                        <td>{row.severity}</td>
                        <td>{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
