import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalOverlay } from './ModalOverlay';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { inboxApi, type Session } from '../services/api';
import { MaterialSymbol } from './MaterialSymbol';

interface Props {
  open: boolean;
  onClose: () => void;
  fromSessionId: string;
  chatId: string;
  sessions: Session[];
  onTransferred: (toSessionId: string, chatId: string) => void;
}

export function InboxTransferChatModal({
  open,
  onClose,
  fromSessionId,
  chatId,
  sessions,
  onTransferred,
}: Props) {
  const { t } = useTranslation();
  const [toSessionId, setToSessionId] = useState('');
  const [reason, setReason] = useState('');
  const [notifyCustomer, setNotifyCustomer] = useState(false);

  const destinations = sessions.filter(s => s.id !== fromSessionId);

  const transfer = useMutation({
    mutationFn: () =>
      inboxApi.transferChat({
        fromSessionId,
        toSessionId,
        chatId,
        reason: reason.trim(),
        notifyCustomer,
      }),
    onSuccess: result => {
      onTransferred(result.toSessionId, result.chatId);
      onClose();
      setReason('');
      setToSessionId('');
      setNotifyCustomer(false);
    },
  });

  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} className="fu-modal-overlay">
      <div
        className="fu-modal inbox-transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-transfer-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <h3 id="inbox-transfer-modal-title" className="inbox-transfer-modal__title">
          <MaterialSymbol name="swap_horiz" size={20} />
          {t('inbox.transfer.title')}
        </h3>
        <p className="inbox-transfer-modal__hint">{t('inbox.transfer.hint')}</p>

        <label htmlFor="inbox-transfer-destination">{t('inbox.transfer.destination')}</label>
        <select
          id="inbox-transfer-destination"
          value={toSessionId}
          onChange={e => setToSessionId(e.target.value)}
        >
          <option value="">{t('inbox.transfer.selectAccount')}</option>
          {destinations.map(s => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.status})
            </option>
          ))}
        </select>

        <label htmlFor="inbox-transfer-reason">{t('inbox.transfer.reason')}</label>
        <textarea
          id="inbox-transfer-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
          placeholder={t('inbox.transfer.reasonPlaceholder')}
        />

        <label className="inbox-transfer-modal__check" htmlFor="inbox-transfer-notify">
          <input
            id="inbox-transfer-notify"
            type="checkbox"
            checked={notifyCustomer}
            onChange={e => setNotifyCustomer(e.target.checked)}
          />
          <span>{t('inbox.transfer.notifyCustomer')}</span>
        </label>

        {transfer.isError && (
          <p className="inbox-transfer-modal__error" role="alert">
            {transfer.error instanceof Error ? transfer.error.message : t('inbox.transfer.failed')}
          </p>
        )}

        <div className="fu-modal__actions">
          <button type="button" className="fu-btn fu-btn--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={!toSessionId || !reason.trim() || transfer.isPending}
            onClick={() => transfer.mutate()}
          >
            {transfer.isPending ? <Loader2 className="spin" size={16} /> : null}
            {t('inbox.transfer.confirm')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
