import type { ChangeEvent, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { SettingsIntegrationCard } from './SettingsIntegrationShell';
import './settings-integration-shell.css';

export { SettingsIntegrationCard as SettingsMainCard };

type ToggleProps = {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function SettingsMainToggle({ label, hint, checked, disabled, onChange }: ToggleProps) {
  return (
    <label
      className={`settings-main-toggle${disabled ? ' is-disabled' : ''}`}
      style={{ cursor: disabled ? 'default' : 'pointer' }}
    >
      <div className="settings-main-toggle__text">
        <span className="settings-int-label settings-int-label--inline">{label}</span>
        {hint ? <p className="settings-int-hint settings-int-hint--muted">{hint}</p> : null}
      </div>
      <span className={`settings-main-switch${checked ? ' is-on' : ''}`} aria-hidden>
        <span className="settings-main-switch__knob" />
      </span>
      <input
        type="checkbox"
        className="settings-main-switch__input"
        checked={checked}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
    </label>
  );
}

type StatProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function SettingsMainStat({ label, hint, children }: StatProps) {
  return (
    <div className="settings-main-stat">
      <div className="settings-main-stat__text">
        <span className="settings-int-label settings-int-label--inline">{label}</span>
        {hint ? <p className="settings-int-hint settings-int-hint--muted">{hint}</p> : null}
      </div>
      <div className="settings-main-stat__control">{children}</div>
    </div>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  children: ReactNode;
};

export function SettingsMainField({ label, hint, children }: FieldProps) {
  return (
    <div className="settings-main-field">
      <span className="settings-int-label">{label}</span>
      {hint ? <p className="settings-int-hint settings-int-hint--muted">{hint}</p> : null}
      <div className="settings-int-field">{children}</div>
    </div>
  );
}

type SaveBarProps = {
  message?: string | null;
  onSave: () => void;
  saving?: boolean;
  saveLabel: string;
  hidden?: boolean;
};

export function SettingsMainSaveBar({ message, onSave, saving, saveLabel, hidden }: SaveBarProps) {
  if (hidden) return null;
  return (
    <div className="settings-main-save-bar">
      {message ? <span className="settings-save-msg">{message}</span> : null}
      <button
        type="button"
        className="fu-btn fu-btn--primary fu-btn--sm"
        disabled={saving}
        onClick={onSave}
      >
        {saving ? <Loader2 className="animate-spin" size={14} /> : null}
        {saveLabel}
      </button>
    </div>
  );
}
