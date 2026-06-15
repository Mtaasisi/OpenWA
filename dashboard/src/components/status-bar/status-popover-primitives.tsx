import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MaterialSymbol } from '../MaterialSymbol';

export type StatusPopoverMetricTone = 'default' | 'primary' | 'muted' | 'error';

export function StatusPopoverMetrics({ children }: { children: ReactNode }) {
  return <div className="status-popover-metrics">{children}</div>;
}

export function StatusPopoverMetric({
  label,
  value,
  icon,
  tone = 'default',
  last = false,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  tone?: StatusPopoverMetricTone;
  last?: boolean;
}) {
  return (
    <div className={`status-popover-metric${last ? ' status-popover-metric--last' : ''}`}>
      <span className="status-popover-metric__label">{label}</span>
      <div className={`status-popover-metric__value status-popover-metric__value--${tone}`}>
        <span className="status-popover-metric__text">{value}</span>
        {icon ? <MaterialSymbol name={icon} size={16} className="status-popover-metric__icon" aria-hidden /> : null}
      </div>
    </div>
  );
}

export type HealthSegmentTone = 'primary' | 'secondary' | 'error';

export function StatusPopoverHealthBar({
  label,
  summary,
  segments,
  legend,
}: {
  label: string;
  summary: string;
  segments: Array<{ width: number; tone: HealthSegmentTone }>;
  legend?: Array<{ label: string; tone: HealthSegmentTone }>;
}) {
  return (
    <div className="status-popover-health">
      <div className="status-popover-health__head">
        <span>{label}</span>
        <span>{summary}</span>
      </div>
      <div className="status-popover-health__track" aria-hidden>
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`status-popover-health__segment status-popover-health__segment--${seg.tone}`}
            style={{ width: `${Math.max(0, Math.min(100, seg.width))}%` }}
          />
        ))}
      </div>
      {legend && legend.length > 0 ? (
        <div className="status-popover-health__legend">
          {legend.map(item => (
            <span key={item.label} className="status-popover-health__legend-item">
              <span className={`status-popover-health__dot status-popover-health__dot--${item.tone}`} aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StatusPopoverSessions({
  children,
  empty,
}: {
  children: ReactNode;
  empty?: ReactNode;
}) {
  return <div className="status-popover-sessions">{children ?? empty}</div>;
}

export function StatusPopoverSession({
  name,
  meta,
  status,
}: {
  name: string;
  meta: string;
  status: 'success' | 'warning' | 'error' | 'neutral';
}) {
  return (
    <div className="status-popover-session">
      <div className="status-popover-session__main">
        <span className="status-popover-session__name">{name}</span>
        <span className={`status-popover-session__badge status-popover-session__badge--${status}`}>
          {meta}
        </span>
      </div>
    </div>
  );
}

export function StatusPopoverWarnings({ children }: { children: ReactNode }) {
  return <div className="status-popover-warnings">{children}</div>;
}

export function StatusPopoverWarning({
  title,
  message,
  level,
  action,
}: {
  title: string;
  message: string;
  level: 'warning' | 'error';
  action?: { label: string; to: string; onClick?: () => void };
}) {
  return (
    <div className={`status-popover-warning status-popover-warning--${level}`}>
      <div className="status-popover-warning__title">{title}</div>
      <p className="status-popover-warning__message">{message}</p>
      {action ? (
        <Link to={action.to} className="status-popover-warning__link" onClick={action.onClick}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function StatusPopoverEmpty({ children }: { children: ReactNode }) {
  return <p className="status-popover-empty">{children}</p>;
}

export function StatusPopoverActions({ children }: { children: ReactNode }) {
  return <div className="status-popover-actions">{children}</div>;
}

export function StatusPopoverPrimaryAction({
  label,
  icon,
  to,
  onClick,
}: {
  label: string;
  icon: string;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon ? <MaterialSymbol name={icon} size={16} aria-hidden /> : null}
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="status-popover-action status-popover-action--primary" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="status-popover-action status-popover-action--primary" onClick={onClick}>
      {content}
    </button>
  );
}

export function StatusPopoverSecondaryAction({
  label,
  icon,
  to,
  onClick,
}: {
  label: string;
  icon?: string;
  to?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon ? <MaterialSymbol name={icon} size={16} aria-hidden /> : null}
      <span>{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="status-popover-action status-popover-action--secondary" onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className="status-popover-action status-popover-action--secondary" onClick={onClick}>
      {content}
    </button>
  );
}

export function queueHealthSegments(pending: number, delayed: number, failed: number) {
  const total = pending + delayed + failed;
  if (total <= 0) {
    return {
      segments: [{ width: 100, tone: 'primary' as const }],
      efficiency: 100,
    };
  }
  const efficiency = Math.round(((total - failed) / total) * 100);
  const segments = [
    { width: (pending / total) * 100, tone: 'primary' as const },
    { width: (delayed / total) * 100, tone: 'secondary' as const },
    { width: (failed / total) * 100, tone: 'error' as const },
  ].filter(s => s.width > 0.5);
  return { segments, efficiency };
}
