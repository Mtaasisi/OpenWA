import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ModalOverlay } from './ModalOverlay';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { MaterialSymbol } from './MaterialSymbol';
import { contactApi, type Session } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  sessions: Session[];
  defaultSessionId?: string;
  onOpen: (sessionId: string, chatId: string) => void;
}

function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function InboxNewChatModal({ open, onClose, sessions, defaultSessionId, onOpen }: Props) {
  const { t } = useTranslation();
  const { activeTheme } = useTheme();
  const isInterakt = activeTheme.effects === 'interakt';
  const readySessions = useMemo(() => sessions.filter(s => s.status === 'ready'), [sessions]);
  const [sessionId, setSessionId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone('');
    setError(null);
    const preferred =
      (defaultSessionId && readySessions.some(s => s.id === defaultSessionId)
        ? defaultSessionId
        : readySessions[0]?.id) ?? '';
    setSessionId(preferred);
  }, [open, defaultSessionId, readySessions]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizePhoneDigits(phone);
    if (digits.length < 8) {
      setError(t('inbox.newChatModal.invalidPhone'));
      return;
    }
    if (!sessionId) {
      setError(t('inbox.newChatModal.noSessions'));
      return;
    }
    setChecking(true);
    setError(null);
    try {
      const result = await contactApi.checkNumber(sessionId, digits);
      if (!result.exists || !result.whatsappId) {
        setError(t('inbox.newChatModal.notOnWhatsApp'));
        return;
      }
      onOpen(sessionId, result.whatsappId);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('inbox.newChatModal.checkFailed'));
    } finally {
      setChecking(false);
    }
  };

  const formFields = (
    <>
      {readySessions.length === 0 ? (
        <p className="inbox-new-chat-modal__hint">{t('inbox.newChatModal.noSessions')}</p>
      ) : (
        <>
          {readySessions.length > 1 && (
            <label className="inbox-new-chat-modal__field">
              <span>{t('inbox.newChatModal.session')}</span>
              <select value={sessionId} onChange={e => setSessionId(e.target.value)} disabled={checking}>
                {readySessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="inbox-new-chat-modal__field">
            <span>{t('inbox.newChatModal.phone')}</span>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder={t('inbox.newChatModal.phonePlaceholder')}
              disabled={checking}
              autoFocus
            />
          </label>
        </>
      )}
      {error && <p className="inbox-new-chat-modal__error">{error}</p>}
    </>
  );

  if (isInterakt) {
    return createPortal(
      <div
        className="inbox-interakt-picker-overlay inbox-interakt-picker-overlay--template"
        onClick={onClose}
        role="presentation"
      >
        <div
          className="inbox-interakt-new-chat-modal"
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="inbox-new-chat-title"
        >
          <header className="inbox-interakt-new-chat-modal__head">
            <h2 id="inbox-new-chat-title">{t('inbox.newChatModal.title')}</h2>
            <button
              type="button"
              className="inbox-interakt-tpl-modal__preview-close"
              onClick={onClose}
              aria-label={t('common.close')}
            >
              <MaterialSymbol name="close" size={20} />
            </button>
          </header>
          <form className="inbox-interakt-new-chat-modal__body" onSubmit={e => void handleSubmit(e)}>
            {formFields}
            <footer className="inbox-interakt-new-chat-modal__foot">
              <button
                type="button"
                className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--ghost"
                onClick={onClose}
                disabled={checking}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="inbox-interakt-tpl-modal__btn inbox-interakt-tpl-modal__btn--primary"
                disabled={checking || readySessions.length === 0}
              >
                {checking ? (
                  <MaterialSymbol name="sync" size={16} spin />
                ) : (
                  t('inbox.newChatModal.open')
                )}
              </button>
            </footer>
          </form>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="modal inbox-new-chat-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbox-new-chat-title"
      >
        <div className="modal-header">
          <h2 id="inbox-new-chat-title">{t('inbox.newChatModal.title')}</h2>
          <button type="button" className="btn-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={20} />
          </button>
        </div>
        <form className="modal-body inbox-new-chat-modal__body" onSubmit={e => void handleSubmit(e)}>
          {formFields}
          <div className="inbox-new-chat-modal__actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={checking}>
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={checking || readySessions.length === 0}
            >
              {checking ? <Loader2 className="animate-spin" size={16} /> : t('inbox.newChatModal.open')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
