import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { inboxApi } from '../../services/api';
import { InboxAiHandlingControls } from '../InboxAiHandlingControls';
import './InboxAiDiagnosisPanel.css';

type Props = {
  sessionId: string;
  chatId: string;
  isGroup?: boolean;
};

export function InboxAiDiagnosisPanel({ sessionId, chatId, isGroup }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['inbox-ai-diagnosis', sessionId, chatId],
    queryFn: () => inboxApi.getAiDiagnosis(sessionId, chatId),
    enabled: Boolean(sessionId && chatId),
  });
  const { data: crm } = useQuery({
    queryKey: ['inbox', 'crm', sessionId, chatId],
    queryFn: () => inboxApi.getThreadCrm(sessionId, chatId),
    enabled: Boolean(sessionId && chatId),
  });

  return (
    <section className="inbox-ai-diagnosis" aria-labelledby="inbox-ai-diagnosis-title">
      <header className="inbox-ai-diagnosis__head">
        <Sparkles size={16} aria-hidden />
        <h4 id="inbox-ai-diagnosis-title">
          {t('inbox.aiDiagnosis.title', { defaultValue: 'AI reply diagnosis' })}
        </h4>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 size={14} className="animate-spin" /> : null}
          {t('inbox.aiDiagnosis.rerun', { defaultValue: 'Re-run' })}
        </button>
      </header>

      {isLoading ? (
        <p className="inbox-ai-diagnosis__muted">{t('common.loading')}</p>
      ) : data ? (
        <>
          <p className={`inbox-ai-diagnosis__summary ${data.canAiReply ? 'ok' : 'warn'}`}>
            {data.summary}
          </p>
          {data.reasons.length > 0 ? (
            <ul className="inbox-ai-diagnosis__reasons">
              {data.reasons.map(reason => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          <dl className="inbox-ai-diagnosis__meta">
            <div>
              <dt>{t('inbox.aiDiagnosis.state', { defaultValue: 'Thread state' })}</dt>
              <dd>{data.threadState}</dd>
            </div>
            <div>
              <dt>{t('inbox.aiDiagnosis.aiStatus', { defaultValue: 'AI status' })}</dt>
              <dd>{data.aiStatus ?? '—'}</dd>
            </div>
          </dl>
          <div className="inbox-ai-diagnosis__actions">
            <InboxAiHandlingControls
              sessionId={sessionId}
              chatId={chatId}
              isGroup={isGroup ?? false}
              crm={crm}
            />
            {data.suggestedFixes.includes('ai-settings') ? (
              <Link to="/settings?category=integrations&panel=ai-integration" className="btn btn-secondary btn-sm">
                {t('inbox.aiDiagnosis.openAiSettings', { defaultValue: 'Open AI settings' })}
              </Link>
            ) : null}
            {data.suggestedFixes.includes('channels') ? (
              <Link to="/sessions" className="btn btn-secondary btn-sm">
                {t('inbox.aiDiagnosis.openSessions', { defaultValue: 'Open WhatsApp sessions' })}
              </Link>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
