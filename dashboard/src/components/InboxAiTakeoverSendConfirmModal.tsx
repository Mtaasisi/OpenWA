import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import { ModalOverlay } from './ModalOverlay';
import { useTheme } from '../hooks/useTheme';
import './InboxAiTakeoverSendConfirmModal.css';

type Props = {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function InboxAiTakeoverSendConfirmModal({ open, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const { activeTheme } = useTheme();
  const isStitch = activeTheme.effects === 'stitch';

  if (!open) return null;

  return (
    <ModalOverlay
      onClose={onCancel}
      className={[
        'inbox-ai-takeover-confirm-overlay',
        isStitch ? 'inbox-ai-takeover-confirm-overlay--stitch' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'inbox-ai-takeover-confirm-modal',
          isStitch ? 'inbox-ai-takeover-confirm-modal--stitch' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        data-testid="inbox-ai-takeover-send-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="inbox-ai-takeover-send-confirm-title"
        aria-describedby="inbox-ai-takeover-send-confirm-body"
        onClick={e => e.stopPropagation()}
      >
        <header className="inbox-ai-takeover-confirm-modal__head">
          <div className="inbox-ai-takeover-confirm-modal__title-row">
            <MaterialSymbol
              name="smart_toy"
              size={22}
              className="inbox-ai-takeover-confirm-modal__icon"
            />
            <h2 id="inbox-ai-takeover-send-confirm-title">
              {t('inbox.aiTakeoverSendConfirmTitle')}
            </h2>
          </div>
          <button
            type="button"
            className="inbox-ai-takeover-confirm-modal__close"
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <MaterialSymbol name="close" size={20} />
          </button>
        </header>
        <div className="inbox-ai-takeover-confirm-modal__body">
          <p id="inbox-ai-takeover-send-confirm-body">{t('inbox.aiTakeoverSendConfirmBody')}</p>
        </div>
        <footer className="inbox-ai-takeover-confirm-modal__foot">
          <button
            type="button"
            className="inbox-ai-takeover-confirm-modal__btn inbox-ai-takeover-confirm-modal__btn--ghost"
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="inbox-ai-takeover-confirm-modal__btn inbox-ai-takeover-confirm-modal__btn--primary"
            onClick={onConfirm}
          >
            {t('inbox.aiTakeoverSendConfirmAction')}
          </button>
        </footer>
      </div>
    </ModalOverlay>
  );
}
