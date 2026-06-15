import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { MaterialSymbol } from '../../MaterialSymbol';

type Props = {
  icon?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export function SettingsRow({
  icon,
  title,
  description,
  right,
  danger,
  onClick,
  disabled,
}: Props) {
  const className = [
    'settings-wa__row',
    onClick && !disabled ? 'settings-wa__row--clickable' : '',
    danger ? 'settings-wa__row--danger' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inner = (
    <>
      <div className="settings-wa__row-left">
        {icon ? (
          <span className="settings-wa__item-icon">
            <MaterialSymbol name={icon} size={20} />
          </span>
        ) : null}
        <div>
          <strong>{title}</strong>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="settings-wa__row-right">{right ?? <ChevronRight size={18} />}</div>
    </>
  );

  if (onClick && !disabled) {
    return (
      <button type="button" className={className} onClick={onClick} style={{ width: '100%', border: 'none', background: 'none', textAlign: 'inherit' }}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function SettingsSwitch({
  checked = false,
  onChange,
  disabled,
}: {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`settings-wa__switch${checked ? ' on' : ''}`}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    >
      <span />
    </button>
  );
}
