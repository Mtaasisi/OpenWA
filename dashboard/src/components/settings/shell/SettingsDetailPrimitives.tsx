import type { ReactNode } from 'react';
import { MaterialSymbol } from '../../MaterialSymbol';

type HeroProps = {
  avatarUrl?: string | null;
  avatarFallback?: string;
  title: string;
  description?: string;
  onEditAvatar?: () => void;
};

export function SettingsDetailHero({
  avatarUrl,
  avatarFallback,
  title,
  description,
  onEditAvatar,
}: HeroProps) {
  return (
    <div className="settings-wa__detail-hero">
      <div className="settings-wa__detail-hero-backdrop" aria-hidden />
      <div className="settings-wa__detail-hero-avatar-wrap">
        <div className="settings-wa__detail-hero-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span>{avatarFallback ?? '?'}</span>
          )}
        </div>
        {onEditAvatar ? (
          <button
            type="button"
            className="settings-wa__detail-hero-edit"
            onClick={onEditAvatar}
            aria-label="Edit profile picture"
          >
            <MaterialSymbol name="edit" size={18} />
          </button>
        ) : null}
      </div>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function SettingsDetailCard({ children }: { children: ReactNode }) {
  return <div className="settings-wa__detail-card">{children}</div>;
}

type RowProps = {
  icon: string;
  label: string;
  value: ReactNode;
  subValue?: ReactNode;
  actionIcon?: string;
  onAction?: () => void;
  actionLabel?: string;
};

export function SettingsDetailRow({
  icon,
  label,
  value,
  subValue,
  actionIcon,
  onAction,
  actionLabel,
}: RowProps) {
  return (
    <div className="settings-wa__detail-row">
      <div className="settings-wa__detail-row-left">
        <span className="settings-wa__detail-row-icon">
          <MaterialSymbol name={icon} size={20} />
        </span>
        <div>
          <p className="settings-wa__detail-row-label">{label}</p>
          <div className="settings-wa__detail-row-value">{value}</div>
          {subValue ? <div className="settings-wa__detail-row-sub">{subValue}</div> : null}
        </div>
      </div>
      {onAction && actionIcon ? (
        <button
          type="button"
          className="settings-wa__detail-row-action"
          onClick={onAction}
          aria-label={actionLabel}
        >
          <MaterialSymbol name={actionIcon} size={18} />
        </button>
      ) : null}
    </div>
  );
}
