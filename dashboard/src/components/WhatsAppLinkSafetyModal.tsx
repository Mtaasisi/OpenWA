import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalOverlay } from './ModalOverlay';
import { MaterialSymbol } from './MaterialSymbol';
import { WhatsAppLinkSafetyChecklist } from './WhatsAppLinkSafetyChecklist';
import './WhatsAppLinkSafetyModal.css';

export type LinkPreflightAction = 'start' | 'relink';

export interface WhatsAppLinkSafetyModalProps {
  sessionId: string;
  sessionName: string;
  action: LinkPreflightAction;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WhatsAppLinkSafetyModal({
  sessionId,
  sessionName,
  action,
  onConfirm,
  onCancel,
}: WhatsAppLinkSafetyModalProps) {
  const { t } = useTranslation();
  const [canProceed, setCanProceed] = useState(false);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [recommendedOk, setRecommendedOk] = useState(true);

  useEffect(() => {
    setAckWarnings(false);
    setCanProceed(false);
  }, [sessionId]);

  return (
    <ModalOverlay onClose={onCancel} className="modal-overlay wa-link-safety-overlay">
      <div
        className="wa-link-safety-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-link-safety-title"
      >
        <header className="wa-link-safety-modal__header">
          <div className="wa-link-safety-modal__titles">
            <h2 id="wa-link-safety-title">{t('whatsappLinkSafety.title')}</h2>
            <p className="wa-link-safety-modal__session">
              <MaterialSymbol name="hub" size={16} />
              {sessionName}
            </p>
          </div>
          <button
            type="button"
            className="wa-link-safety-modal__close"
            onClick={onCancel}
            aria-label={t('common.close')}
          >
            <MaterialSymbol name="close" size={22} />
          </button>
        </header>

        <main className="wa-link-safety-modal__body">
          <WhatsAppLinkSafetyChecklist
            sessionId={sessionId}
            mode="link"
            variant="modal"
            ackInFooter
            ackWarnings={ackWarnings}
            onAckChange={setAckWarnings}
            onMetaChange={meta => setRecommendedOk(meta.recommendedOk)}
            hint={
              action === 'relink'
                ? t('whatsappLinkSafety.hintRelink')
                : t('whatsappLinkSafety.hintStart')
            }
            onNavigateAway={onCancel}
            onReadyChange={setCanProceed}
          />
        </main>

        <footer className="wa-link-safety-modal__footer">
          {!recommendedOk ? (
            <label className="wa-link-safety-modal__ack">
              <input
                type="checkbox"
                checked={ackWarnings}
                onChange={e => setAckWarnings(e.target.checked)}
              />
              <span>{t('whatsappLinkSafety.ackWarnings')}</span>
            </label>
          ) : null}
          <div className="wa-link-safety-modal__footer-actions">
            <button
              type="button"
              className="wa-link-safety-modal__btn wa-link-safety-modal__btn--ghost"
              onClick={onCancel}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="wa-link-safety-modal__btn wa-link-safety-modal__btn--primary"
              disabled={!canProceed}
              onClick={onConfirm}
            >
              {t('whatsappLinkSafety.proceed')}
              <MaterialSymbol name="qr_code_scanner" size={18} />
            </button>
          </div>
        </footer>
      </div>
    </ModalOverlay>
  );
}
