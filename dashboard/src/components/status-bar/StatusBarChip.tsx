import type { MouseEvent } from 'react';
import type { AppStatusLevel } from '../../types/appStatusTypes';

export interface StatusBarChipProps {
  id: string;
  label: string;
  status: AppStatusLevel;
  tooltip?: string;
  active?: boolean;
  /** When true, always show the status dot (e.g. alerts). */
  showDot?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function StatusBarChip({
  id,
  label,
  status,
  tooltip,
  active = false,
  showDot,
  onClick,
}: StatusBarChipProps) {
  const Tag = onClick ? 'button' : 'span';
  const dotVisible =
    showDot ?? (status === 'success' || status === 'warning' || status === 'error' || status === 'loading');

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      id={`status-chip-${id}`}
      className={[
        'status-bar-chip',
        `status-bar-chip--${status}`,
        onClick ? 'status-bar-chip--clickable' : '',
        active ? 'status-bar-chip--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      data-tip={tooltip ?? label}
      aria-pressed={onClick ? active : undefined}
    >
      {dotVisible ? <span className="status-bar-chip__dot" aria-hidden /> : null}
      <span className="status-bar-chip__label">{label}</span>
    </Tag>
  );
}
