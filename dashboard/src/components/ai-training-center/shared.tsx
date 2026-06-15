import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { MaterialSymbol } from '../MaterialSymbol';
import type { TrainingIntentStatus, UnknownMessageStatus } from '../../lib/ai-training-center/types';

export function StatusBadge({
  status,
}: {
  status: TrainingIntentStatus | UnknownMessageStatus | string;
}) {
  const s = status.toLowerCase().replace(/\s+/g, '_');
  let mod = 'pending';
  if (s === 'active' || s === 'approved') mod = 'active';
  else if (s === 'disabled' || s === 'ignored') mod = 'disabled';
  else if (s === 'rejected' || s === 'unknown') mod = 'rejected';
  return <span className={`aitc-badge aitc-badge--${mod}`}>{status.replace(/_/g, ' ')}</span>;
}

export function IntentBadge({ intent }: { intent: string }) {
  return <span className="aitc-badge aitc-badge--intent">{intent.replace(/_/g, ' ')}</span>;
}

export function ConfidenceIndicator({ value }: { value: number }) {
  const cls =
    value < 60 ? 'aitc-confidence is-low' : value < 80 ? 'aitc-confidence is-mid' : 'aitc-confidence';
  return <span className={cls}>{value}%</span>;
}

export function TrainingMetricCard({
  label,
  value,
  change,
  changePositive,
}: {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
}) {
  return (
    <div className="aitc-panel-card aitc-kpi-card">
      <p className="aitc-kpi-card__label">{label}</p>
      <p className="aitc-kpi-card__value">{value}</p>
      {change && (
        <p className={`aitc-kpi-card__change${changePositive ? ' is-positive' : ''}`}>{change}</p>
      )}
    </div>
  );
}

export function AITCEmptyState({
  icon = 'school',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="aitc-empty">
      <MaterialSymbol name={icon} size={40} />
      <p className="aitc-empty__title">{title}</p>
      <p className="aitc-empty__desc">{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="aitc-btn aitc-btn--primary" style={{ marginTop: '1rem' }} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function AITCLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="aitc-skeleton" style={{ height: 48 }} />
      ))}
    </div>
  );
}

export function AITCErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="aitc-error-banner">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="aitc-btn aitc-btn--secondary" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function AITCModal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="aitc-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`aitc-modal${wide ? ' aitc-modal--wide' : ''}`}>
        <header className="aitc-modal__header">
          <h2 className="aitc-modal__title">{title}</h2>
          <button type="button" className="aitc-icon-btn" onClick={onClose} aria-label="Close">
            <MaterialSymbol name="close" size={22} />
          </button>
        </header>
        <div className="aitc-modal__body">{children}</div>
        {footer && <footer className="aitc-modal__footer">{footer}</footer>}
      </div>
    </div>
  );
}
