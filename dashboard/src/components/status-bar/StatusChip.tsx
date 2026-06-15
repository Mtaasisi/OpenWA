import type { MouseEvent, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import type { AppStatusLevel } from '../../types/appStatusTypes';
import './StatusChip.css';

export interface StatusChipProps {
  id: string;
  label: string;
  value?: string;
  status: AppStatusLevel;
  icon?: ReactNode;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  ariaLabel?: string;
  compact?: boolean;
}

export function StatusChip({
  id,
  label,
  value,
  status,
  icon,
  onClick,
  ariaLabel,
  compact = false,
}: StatusChipProps) {
  const clickable = Boolean(onClick);
  const display = value ? `${label}: ${value}` : label;
  const Tag = clickable ? 'button' : 'span';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      id={`status-chip-${id}`}
      className={`status-chip status-chip--${status}${compact ? ' status-chip--compact' : ''}${clickable ? ' status-chip--clickable' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel ?? display}
      title={display}
    >
      {status === 'loading' ? (
        <Loader2 className="status-chip__spinner" size={10} aria-hidden />
      ) : (
        <span className="status-chip__dot" aria-hidden />
      )}
      {icon ? <span className="status-chip__icon">{icon}</span> : null}
      <span className="status-chip__text">{display}</span>
    </Tag>
  );
}
