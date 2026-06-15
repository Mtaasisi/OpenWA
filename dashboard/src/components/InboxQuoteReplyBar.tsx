import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InboxQuoteReplyTarget } from '../pages/useInboxController';
import './InboxQuoteReplyBar.css';

interface Props {
  quote: InboxQuoteReplyTarget;
  onClear: () => void;
  variant?: 'classic' | 'interakt' | 'tactical';
}

export function InboxQuoteReplyBar({ quote, onClear, variant = 'classic' }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`inbox-quote-reply-bar inbox-quote-reply-bar--${variant}`} role="status">
      <div className="inbox-quote-reply-bar__main">
        <span className="inbox-quote-reply-bar__label">{t('inbox.contextMenu.replyingTo')}</span>
        <p className="inbox-quote-reply-bar__preview">{quote.preview}</p>
      </div>
      <button
        type="button"
        className="inbox-quote-reply-bar__clear"
        onClick={onClear}
        aria-label={t('inbox.contextMenu.cancelReply')}
      >
        <X size={16} />
      </button>
    </div>
  );
}
