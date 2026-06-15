import { ChevronRight } from 'lucide-react';
import { MaterialSymbol } from '../../MaterialSymbol';

type Props = {
  icon: string;
  title: string;
  description?: string;
  admin?: boolean;
  adminLabel?: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
};

export function SettingsNavCard({
  icon,
  title,
  description,
  admin,
  adminLabel = 'Admin',
  active,
  danger,
  onClick,
}: Props) {
  const className = [
    'settings-wa__nav-card',
    active ? 'settings-wa__nav-card--active' : '',
    danger ? 'settings-wa__nav-card--danger' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={className} onClick={onClick} aria-label={title} title={title}>
      <div className="settings-wa__nav-card-left">
        <span className="settings-wa__nav-card-icon">
          <MaterialSymbol name={icon} size={20} />
        </span>
        <div className="settings-wa__nav-card-text">
          <div className="settings-wa__nav-card-title-row">
            <strong>{title}</strong>
            {admin ? <span className="settings-wa__nav-card-admin">{adminLabel}</span> : null}
          </div>
          {description ? <small>{description}</small> : null}
        </div>
      </div>
      <ChevronRight size={16} className="settings-wa__nav-card-chevron" />
    </button>
  );
}
