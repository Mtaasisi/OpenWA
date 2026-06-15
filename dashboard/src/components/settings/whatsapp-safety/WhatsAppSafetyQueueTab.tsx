import { useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UseMutationResult } from '@tanstack/react-query';
import type {
  Conversation,
  Session,
  WhatsAppSafetyQueueRow,
  WhatsAppSafetyWarmupRow,
} from '../../../services/api';
import {
  buildSafetyConversationMap,
  formatSafetyQueueChatLabel,
  formatSafetyQueueScheduledAt,
  formatSafetyQueueStatus,
  formatSafetyRiskLevel,
  formatSafetySendSource,
  formatSafetySessionLabel,
  safetyConversationKey,
} from '../../../lib/whatsapp-safety-display';

type Props = {
  queue: WhatsAppSafetyQueueRow[];
  queueStats: Record<string, number>;
  warmups: WhatsAppSafetyWarmupRow[];
  sessions: Session[];
  conversations: Conversation[];
  approveQueue: UseMutationResult<unknown, Error, string, unknown>;
  cancelQueue: UseMutationResult<unknown, Error, string, unknown>;
  retryQueue: UseMutationResult<unknown, Error, string, unknown>;
  pauseWarmup: UseMutationResult<unknown, Error, string, unknown>;
  resumeWarmup: UseMutationResult<unknown, Error, string, unknown>;
};

export function WhatsAppSafetyQueueTab({
  queue,
  queueStats,
  warmups,
  sessions,
  conversations,
  approveQueue,
  cancelQueue,
  retryQueue,
  pauseWarmup,
  resumeWarmup,
}: Props) {
  const { t } = useTranslation();
  const conversationByKey = useMemo(
    () => buildSafetyConversationMap(conversations),
    [conversations],
  );

  const [, setCountdownTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setCountdownTick(n => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      {Object.keys(queueStats).length > 0 && (
        <div className="wa-safety-kpi-grid">
          {Object.entries(queueStats).map(([status, count]) => (
            <div key={status} className="wa-safety-kpi">
              <p className="wa-safety-kpi__label">{formatSafetyQueueStatus(status, t)}</p>
              <p className="wa-safety-kpi__value">{count}</p>
            </div>
          ))}
        </div>
      )}
      <div className="wa-safety-table-card">
        <table className="settings-int-table">
          <thead>
            <tr>
              <th>{t('whatsappSafety.queue.status')}</th>
              <th>{t('whatsappSafety.queue.chat')}</th>
              <th>{t('whatsappSafety.queue.account')}</th>
              <th>{t('whatsappSafety.queue.sendsAt')}</th>
              <th>{t('whatsappSafety.queue.source')}</th>
              <th>{t('whatsappSafety.queue.risk')}</th>
              <th>{t('whatsappSafety.queue.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {queue.slice(0, 50).map(row => {
              const conv = conversationByKey.get(safetyConversationKey(row.sessionId, row.chatId));
              const chatLabel = formatSafetyQueueChatLabel(row, conv, t);
              return (
                <tr key={row.id}>
                  <td>{formatSafetyQueueStatus(row.status, t)}</td>
                  <td>
                    <span className="wa-safety-queue-chat" title={row.chatId}>
                      {chatLabel}
                    </span>
                  </td>
                  <td>{formatSafetySessionLabel(row.sessionId, sessions)}</td>
                  <td>{formatSafetyQueueScheduledAt(row.scheduledAt, t)}</td>
                  <td>{formatSafetySendSource(row.source, t)}</td>
                  <td>{formatSafetyRiskLevel(row.riskLevel, t)}</td>
                  <td>
                    {row.status === 'approval_required' && (
                      <button
                        type="button"
                        className="wa-safety-btn wa-safety-btn--primary"
                        onClick={() => approveQueue.mutate(row.id)}
                      >
                        {t('whatsappSafety.queue.approve')}
                      </button>
                    )}
                    {['pending', 'scheduled', 'approval_required'].includes(row.status) && (
                      <button
                        type="button"
                        className="wa-safety-btn wa-safety-btn--ghost"
                        onClick={() => cancelQueue.mutate(row.id)}
                      >
                        {t('whatsappSafety.queue.cancel')}
                      </button>
                    )}
                    {['failed', 'blocked'].includes(row.status) && (
                      <button
                        type="button"
                        className="wa-safety-btn wa-safety-btn--ghost"
                        onClick={() => retryQueue.mutate(row.id)}
                      >
                        {t('whatsappSafety.queue.retry')}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="wa-safety-bento wa-safety-queue-warmup">
        <h3 className="wa-safety-section-title">{t('whatsappSafety.queue.warmupTitle')}</h3>
        {warmups.length === 0 ? (
          <p className="wa-safety-empty">{t('whatsappSafety.warmup.empty')}</p>
        ) : (
          <ul className="wa-safety-list">
            {warmups.map(w => (
              <li key={w.id} className="wa-safety-list-row">
                <span className="wa-safety-list-row__main">
                  <strong>{formatSafetySessionLabel(w.sessionId, sessions)}</strong>
                  {' — '}
                  {t('whatsappSafety.warmup.dayProgress', {
                    day: w.dayNumber,
                    sent: w.outboundSentToday,
                    max: w.maxOutboundToday,
                  })}
                </span>
                <div className="wa-safety-list-row__actions">
                  <button
                    type="button"
                    className="wa-safety-btn wa-safety-btn--ghost"
                    onClick={() => pauseWarmup.mutate(w.sessionId)}
                  >
                    {t('whatsappSafety.warmup.pause')}
                  </button>
                  <button
                    type="button"
                    className="wa-safety-btn wa-safety-btn--primary"
                    onClick={() => resumeWarmup.mutate(w.sessionId)}
                  >
                    {t('whatsappSafety.warmup.resume')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
