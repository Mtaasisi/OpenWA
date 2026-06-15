import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import './InboxAiTrainingLearnStrip.css';

export interface InboxTrainingLearnPrompt {
  itemId?: string;
  question: string;
  staffAnswer: string;
  sessionId: string;
  chatId: string;
}

interface Props {
  prompt: InboxTrainingLearnPrompt;
  onDismiss: () => void;
  variant?: 'classic' | 'interakt';
}

export function InboxAiTrainingLearnStrip({ prompt, onDismiss, variant = 'classic' }: Props) {
  const { t } = useTranslation();
  const trainingHref = prompt.itemId
    ? `/ai?tab=training&item=${encodeURIComponent(prompt.itemId)}`
    : '/ai-training-center/unknown-messages';

  return (
    <div
      className={`inbox-ai-training-learn${variant === 'interakt' ? ' inbox-ai-training-learn--interakt' : ''}`}
      role="status"
      data-testid="inbox-ai-training-learn-strip"
    >
      <div className="inbox-ai-training-learn__text">
        <strong>{t('inbox.trainingLearn.title', { defaultValue: 'Teach AI from this reply?' })}</strong>
        <span>
          {t('inbox.trainingLearn.subtitle', {
            defaultValue: 'Your answer can help AI next time someone asks a similar question.',
          })}
        </span>
      </div>
      <div className="inbox-ai-training-learn__actions">
        <Link to={trainingHref} className="inbox-ai-training-learn__btn inbox-ai-training-learn__btn--primary">
          {t('inbox.trainingLearn.open', { defaultValue: 'Open Training Center' })}
        </Link>
        <button type="button" className="inbox-ai-training-learn__btn" onClick={onDismiss}>
          {t('inbox.trainingLearn.dismiss', { defaultValue: 'Not now' })}
        </button>
        <button
          type="button"
          className="inbox-ai-training-learn__close"
          aria-label={t('common.close')}
          onClick={onDismiss}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
