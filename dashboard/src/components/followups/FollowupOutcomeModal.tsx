import { useTranslation } from 'react-i18next';
import { ModalOverlay } from '../ModalOverlay';

const OUTCOMES = [
  'customer_replied',
  'customer_bought',
  'still_thinking',
  'price_too_high',
  'requested_lower_price',
  'no_response',
  'wrong_number',
  'not_interested',
  'call_needed',
  'rescheduled',
] as const;

type Props = {
  open: boolean;
  outcome: string;
  onOutcomeChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  pending?: boolean;
};

export function FollowupOutcomeModal({
  open,
  outcome,
  onOutcomeChange,
  onClose,
  onConfirm,
  pending,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <ModalOverlay onClose={onClose} className="fu-modal-overlay">
      <div className="fu-modal" onClick={e => e.stopPropagation()} role="dialog">
        <h3>{t('followups.markOutcome')}</h3>
        <label htmlFor="fu-outcome-select">{t('followups.outcomeLabel')}</label>
        <select
          id="fu-outcome-select"
          value={outcome}
          onChange={e => onOutcomeChange(e.target.value)}
        >
          {OUTCOMES.map(o => (
            <option key={o} value={o}>
              {t(`followups.outcomes.${o}`)}
            </option>
          ))}
        </select>
        <div className="fu-modal__actions">
          <button type="button" className="fu-btn fu-btn--ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="fu-btn fu-btn--primary"
            disabled={pending}
            onClick={onConfirm}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
