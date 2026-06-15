import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Pencil } from 'lucide-react';
import type { InboxMessage } from '../services/api';
import { inboxApi } from '../services/api';

type Props = {
  message: InboxMessage;
  sessionId: string;
  onEditResend?: (text: string) => void;
};

function failureMeta(message: InboxMessage): {
  reason?: string;
  retryable?: boolean;
} {
  const meta = message.metadata ?? {};
  return {
    reason: typeof meta.sendFailureReason === 'string' ? meta.sendFailureReason : undefined,
    retryable: meta.retryable !== false,
  };
}

export function InboxFailedMessageActions({ message, sessionId, onEditResend }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const { reason, retryable } = failureMeta(message);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['inbox', 'messages', sessionId, message.chatId] });
  };

  const retry = useMutation({
    mutationFn: () => inboxApi.retryMessage(message.id),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (message.direction !== 'outgoing' || message.status !== 'failed') return null;

  const needsQr = reason?.toLowerCase().includes('qr') || reason?.toLowerCase().includes('scan');

  return (
    <div className="inbox-failed-msg" role="alert">
      <p className="inbox-failed-msg__title">{t('inbox.messageStatus.failed')}</p>
      {reason ? <p className="inbox-failed-msg__reason">{reason}</p> : null}
      <div className="inbox-failed-msg__actions">
        {retryable && !needsQr && (
          <button type="button" className="inbox-failed-msg__btn" disabled={retry.isPending} onClick={() => retry.mutate()}>
            <RefreshCw size={14} />
            {t('inbox.retrySend', { defaultValue: 'Retry' })}
          </button>
        )}
        {onEditResend && (
          <button
            type="button"
            className="inbox-failed-msg__btn"
            onClick={() => onEditResend(message.body ?? '')}
          >
            <Pencil size={14} />
            {t('inbox.editResend', { defaultValue: 'Edit & resend' })}
          </button>
        )}
        <button
          type="button"
          className="inbox-failed-msg__btn"
          onClick={() => {
            void navigator.clipboard.writeText(message.body ?? '').then(() => setCopied(true));
          }}
        >
          <Copy size={14} />
          {copied ? t('inbox.copied') : t('inbox.copyMessage')}
        </button>
        {needsQr && (
          <a className="inbox-failed-msg__btn inbox-failed-msg__btn--link" href="/channels">
            {t('inbox.openQr', { defaultValue: 'Open WhatsApp QR' })}
          </a>
        )}
      </div>
    </div>
  );
}
