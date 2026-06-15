import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';

type Props = {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusTone?: 'ok' | 'error' | 'warn';
  showBack?: boolean;
  onBack?: () => void;
  onClose?: () => void;
  children: ReactNode;
};

export function ChannelsDetailShell({
  title,
  subtitle,
  statusLabel,
  statusTone = 'ok',
  showBack,
  onBack,
  onClose,
  children,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <div className="cc-inspector__header">
        <div className="cc-inspector__header-row">
          {showBack ? (
            <button
              type="button"
              className="cc-inspector__back"
              onClick={onBack}
              aria-label={t('channels.backToList')}
            >
              <MaterialSymbol name="arrow_back" size={20} />
              <span className="cc-inspector__back-label">{t('channels.backToList')}</span>
            </button>
          ) : null}
          <h3 className="cc-inspector__title">{title}</h3>
          {onClose ? (
            <button
              type="button"
              className="cc-inspector__close"
              onClick={onClose}
              aria-label={t('common.close', { defaultValue: 'Close' })}
            >
              <MaterialSymbol name="close" size={22} />
            </button>
          ) : null}
        </div>
        {subtitle ? <p className="cc-inspector__phone">{subtitle}</p> : null}
        {statusLabel ? (
          <div
            className={`cc-inspector__status${
              statusTone === 'error'
                ? ' cc-inspector__status--error'
                : statusTone === 'warn'
                  ? ' cc-inspector__status--warn'
                  : statusTone === 'ok'
                    ? ' cc-inspector__status--ok'
                    : ''
            }`}
          >
            <span className="cc-inspector__status-dot" aria-hidden />
            {statusLabel}
          </div>
        ) : null}
      </div>
      <div className="cc-inspector__body">{children}</div>
    </>
  );
}
