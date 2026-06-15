import type { MouseEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { MaterialSymbol } from '../MaterialSymbol';
import type { AppStatusLevel } from '../../types/appStatusTypes';
import './StatusSemanticPill.css';

export interface StatusSemanticPillProps {
  id: string;
  label: string;
  status: AppStatusLevel;
  icon: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
  /** Hover tooltip — use when visible label is abbreviated. */
  tooltip?: string;
  active?: boolean;
  compact?: boolean;
  iconSize?: number;
  iconWeight?: number;
}

export function StatusSemanticPill({
  id,
  label,
  status,
  icon,
  onClick,
  ariaLabel,
  tooltip,
  active = false,
  compact = false,
  iconSize = 14,
  iconWeight,
}: StatusSemanticPillProps) {
  const Tag = onClick ? 'button' : 'span';
  const tip = tooltip ?? label;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      id={`status-pill-${id}`}
      className={[
        'status-semantic-pill',
        `status-semantic-pill--${status}`,
        onClick ? 'status-semantic-pill--clickable' : '',
        active ? 'status-semantic-pill--active' : '',
        compact ? 'status-semantic-pill--icon-only' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClick}
      aria-label={ariaLabel ?? tip}
      aria-pressed={onClick ? active : undefined}
      data-tip={tip}
    >
      {status === 'loading' ? (
        <Loader2 className="status-semantic-pill__spinner" size={12} aria-hidden />
      ) : (
        <MaterialSymbol
          name={icon}
          size={iconSize}
          weight={iconWeight}
          className="status-semantic-pill__icon"
        />
      )}
      <span className="status-semantic-pill__text">{label}</span>
    </Tag>
  );
}
