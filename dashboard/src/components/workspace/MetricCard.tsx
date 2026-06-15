import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { renderIconSlot } from './render-icon';

export type MetricSeverity = 'neutral' | 'warning' | 'danger' | 'success' | 'hot';

export type MetricCardProps = {
  label?: string;
  title?: string;
  value: ReactNode;
  helperText?: string;
  trend?: string;
  trendUp?: boolean | null;
  severity?: MetricSeverity;
  onClick?: () => void;
  icon?: LucideIcon | ReactNode;
  loading?: boolean;
};

export function MetricCard({
  label,
  title,
  value,
  helperText,
  trend,
  trendUp,
  severity = 'neutral',
  onClick,
  icon,
  loading,
}: MetricCardProps) {
  const displayLabel = title ?? label ?? '';
  const iconNode = renderIconSlot(icon, 20, 'ws-metric-card__icon');

  const className = [
    'ws-metric-card',
    onClick ? 'ws-metric-card--link' : '',
    severity !== 'neutral' ? `ws-metric-card--severity-${severity}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      {(iconNode || (trend && trend !== '0')) && (
        <div className="ws-metric-card__header">
          {iconNode}
          {trend && trend !== '0' && (
            <div
              className={[
                'ws-metric-card__trend',
                trendUp === true ? 'ws-metric-card__trend--up' : '',
                trendUp === false ? 'ws-metric-card__trend--down' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {trendUp === true && <ArrowUpRight size={12} />}
              {trendUp === false && <ArrowDownRight size={12} />}
              {trend}
            </div>
          )}
        </div>
      )}
      <span className="ws-metric-card__value">
        {loading ? '…' : typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {displayLabel && <span className="ws-metric-card__label">{displayLabel}</span>}
      {helperText && <span className="ws-metric-card__helper">{helperText}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
