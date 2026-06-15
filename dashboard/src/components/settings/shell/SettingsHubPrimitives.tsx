import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { MaterialSymbol } from '../../MaterialSymbol';

export function SettingsHubSection({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="settings-hub__section">
      <div className="settings-hub__section-head">
        <h4>{title}</h4>
        {badge}
      </div>
      <div className="settings-hub__section-body">{children}</div>
    </section>
  );
}

export function SettingsHubProfileCard({
  avatarFallback,
  name,
  email,
  admin,
  adminLabel,
  onEdit,
  onShare,
  editLabel,
  shareLabel,
}: {
  avatarFallback: string;
  name: string;
  email: string;
  admin?: boolean;
  adminLabel?: string;
  onEdit: () => void;
  onShare: () => void;
  editLabel: string;
  shareLabel: string;
}) {
  return (
    <div className="settings-hub__profile-card">
      <div className="settings-hub__profile-avatar-wrap">
        <div className="settings-hub__profile-avatar">
          <span>{avatarFallback}</span>
        </div>
      </div>
      <div className="settings-hub__profile-meta">
        <div className="settings-hub__profile-name-row">
          <h3>{name}</h3>
          {admin && adminLabel ? (
            <span className="settings-hub__admin-pill">{adminLabel}</span>
          ) : null}
        </div>
        <p className="settings-hub__profile-email">{email}</p>
        <div className="settings-hub__profile-actions">
          <button type="button" className="settings-wa__btn-primary" onClick={onEdit}>
            {editLabel}
          </button>
          <button type="button" className="settings-hub__btn-outline" onClick={onShare}>
            {shareLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsHubStatRow({
  icon,
  title,
  subtitle,
  statusLabel,
  statusTone = 'success',
}: {
  icon: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  statusTone?: 'success' | 'neutral';
}) {
  return (
    <div className="settings-hub__stat-row">
      <div className="settings-hub__stat-row-left">
        <MaterialSymbol name={icon} size={22} className="settings-hub__stat-icon" />
        <div>
          <p className="settings-hub__stat-title">{title}</p>
          <p className="settings-hub__stat-sub">{subtitle}</p>
        </div>
      </div>
      <span className={`settings-hub__status-pill settings-hub__status-pill--${statusTone}`}>
        {statusLabel}
      </span>
    </div>
  );
}

export function SettingsHubRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="settings-hub__row" onClick={onClick}>
      <div className="settings-hub__row-left">
        <MaterialSymbol name={icon} size={22} className="settings-hub__row-icon" />
        <div className="settings-hub__row-text">
          <p className="settings-hub__row-title">{title}</p>
          {description ? <p className="settings-hub__row-desc">{description}</p> : null}
        </div>
      </div>
      <ChevronRight size={18} className="settings-hub__row-chevron" />
    </button>
  );
}

export function SettingsHubPreferencesSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-hub__section">
      <div className="settings-hub__section-head">
        <h4>{title}</h4>
      </div>
      <div className="settings-hub__preferences">{children}</div>
    </section>
  );
}
