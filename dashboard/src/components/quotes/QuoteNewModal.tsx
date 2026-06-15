import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { ModalOverlay } from '../ModalOverlay';
import { contactApi, quoteApi, type Quote, type Session } from '../../services/api';

type Props = {
  open: boolean;
  sessions: Session[];
  onClose: () => void;
  onCreated: (quote: Quote) => void;
};

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function QuoteNewModal({ open, sessions, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const readySessions = useMemo(() => sessions.filter(s => s.status === 'ready'), [sessions]);
  const [sessionId, setSessionId] = useState('');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhone('');
    setCustomerName('');
    setError(null);
    setSessionId(readySessions[0]?.id ?? '');
  }, [open, readySessions]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const digits = normalizePhoneDigits(phone);
      if (digits.length < 8) throw new Error(t('quotes.newQuote.invalidPhone'));
      if (!sessionId) throw new Error(t('quotes.newQuote.noSessions'));

      const result = await contactApi.checkNumber(sessionId, digits);
      if (!result.exists || !result.whatsappId) {
        throw new Error(t('quotes.newQuote.notOnWhatsApp'));
      }

      return quoteApi.createFromChat({
        sessionId,
        chatId: result.whatsappId,
        customerName: customerName.trim() || null,
        customerPhone: digits,
      });
    },
    onSuccess: quote => {
      onCreated(quote);
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  if (!open) return null;

  const pending = createMutation.isPending;

  return (
    <ModalOverlay onClose={onClose} className="fu-modal-overlay">
      <div className="fu-modal quotes-new-modal" onClick={e => e.stopPropagation()} role="dialog">
        <h3>{t('quotes.newQuote.title')}</h3>
        <p className="quotes-new-modal__hint">{t('quotes.newQuote.hint')}</p>

        {readySessions.length === 0 ? (
          <p className="quotes-new-modal__error">{t('quotes.newQuote.noSessions')}</p>
        ) : (
          <>
            {readySessions.length > 1 && (
              <>
                <label htmlFor="quote-new-session">{t('quotes.newQuote.session')}</label>
                <select
                  id="quote-new-session"
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  disabled={pending}
                >
                  {readySessions.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="quote-new-phone">{t('quotes.newQuote.phone')}</label>
            <input
              id="quote-new-phone"
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder={t('quotes.newQuote.phonePlaceholder')}
              disabled={pending}
              autoFocus
            />
            <label htmlFor="quote-new-name">{t('quotes.newQuote.customerName')}</label>
            <input
              id="quote-new-name"
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder={t('quotes.newQuote.customerNamePlaceholder')}
              disabled={pending}
            />
          </>
        )}

        {error && <p className="quotes-new-modal__error">{error}</p>}

        <div className="fu-modal__actions">
          <button type="button" className="fu-btn fu-btn--ghost" onClick={onClose} disabled={pending}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={pending || readySessions.length === 0}
            onClick={() => createMutation.mutate()}
          >
            {pending ? <Loader2 className="spin" size={16} /> : t('quotes.create')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
