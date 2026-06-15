import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import './AskAiLink.css';

interface AskAiLinkProps {
  /** Pre-filled question when opening the assistant */
  prompt?: string;
  className?: string;
  variant?: 'button' | 'link';
}

export function AskAiLink({ prompt, className = '', variant = 'button' }: AskAiLinkProps) {
  const { t } = useTranslation();
  const href = prompt ? `/ai?prompt=${encodeURIComponent(prompt)}` : '/ai';

  if (variant === 'link') {
    return (
      <Link to={href} className={`ask-ai-link ${className}`}>
        <Bot size={14} aria-hidden />
        {t('ai.askLink')}
      </Link>
    );
  }

  return (
    <Link
      to={href}
      className={`ask-ai-link-btn ${className}`.trim()}
      title={t('ai.askLink')}
    >
      <Bot size={16} aria-hidden />
      <span className="ask-ai-link-btn__label">{t('ai.askLink')}</span>
    </Link>
  );
}
