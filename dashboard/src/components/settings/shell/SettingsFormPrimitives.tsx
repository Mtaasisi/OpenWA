import type { ReactNode } from 'react';
import { MaterialSymbol } from '../../MaterialSymbol';
import './settings-form.css';

export function SettingsFormPage({
  children,
  wide,
  intro,
  title,
  icon,
}: {
  children: ReactNode;
  wide?: boolean;
  intro?: ReactNode;
  title?: string;
  icon?: string;
}) {
  const showHeader = Boolean(title);
  return (
    <div className={`settings-form-page${wide ? ' settings-form-page--wide' : ''}`}>
      {showHeader ? (
        <header className="settings-form-page__header">
          {icon ? (
            <span className="settings-form-page__header-icon" aria-hidden>
              <MaterialSymbol name={icon} size={24} filled />
            </span>
          ) : null}
          <div className="settings-form-page__header-text">
            <h2 className="settings-form-page__title">{title}</h2>
            {intro ? <p className="settings-form-intro settings-form-intro--header">{intro}</p> : null}
          </div>
        </header>
      ) : intro ? (
        <div className="settings-form-intro settings-form-intro--page">{intro}</div>
      ) : null}
      <div className="settings-form-page__stack">{children}</div>
    </div>
  );
}

export function SettingsFormCard({
  icon,
  title,
  actions,
  children,
  className,
}: {
  icon?: string;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const showHead = Boolean(title || actions);
  return (
    <section
      className={['settings-form-card', className].filter(Boolean).join(' ')}
    >
      {showHead ? (
        <header className="settings-form-card__head">
          {title ? (
            <h2 className="settings-form-card__title">
              {icon ? <MaterialSymbol name={icon} size={22} filled /> : null}
              {title}
            </h2>
          ) : (
            <span />
          )}
          {actions ? <div className="settings-form-card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="settings-form-card__body">{children}</div>
    </section>
  );
}

export function SettingsFormCardHeadButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  icon?: string;
}) {
  return (
    <button
      type="button"
      className="settings-form-card__head-btn"
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <MaterialSymbol name={icon} size={18} /> : null}
      {children}
    </button>
  );
}

export function SettingsFormIntro({ children }: { children: ReactNode }) {
  return <p className="settings-form-intro">{children}</p>;
}

export function SettingsFormGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <div className={`settings-form-grid${columns === 1 ? ' settings-form-grid--1' : ''}`}>
      {children}
    </div>
  );
}

export function SettingsFormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-form-section">
      <h3 className="settings-form-section__title">{title}</h3>
      <div className="settings-form-fields">{children}</div>
    </div>
  );
}

export function SettingsFormDisplayField({
  label,
  value,
  empty,
  variant = 'default',
}: {
  label: string;
  value?: ReactNode;
  empty?: string;
  variant?: 'default' | 'body' | 'pill';
}) {
  const isEmpty =
    value == null ||
    value === '' ||
    (typeof value === 'string' && !value.trim());

  return (
    <div className="settings-form-field">
      <p className="settings-form-field__label">{label}</p>
      {isEmpty ? (
        <p className="settings-form-field__value settings-form-field__value--empty settings-form-field__value--body">
          {empty ?? '—'}
        </p>
      ) : (
        <div
          className={[
            'settings-form-field__value',
            variant === 'body' ? 'settings-form-field__value--body' : '',
            variant === 'pill' ? 'settings-form-field__value--pill' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {value}
        </div>
      )}
    </div>
  );
}

export function SettingsFormEditField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="settings-form-field">
      <label className="settings-form-field__label">{label}</label>
      <div className="settings-form-field__control">{children}</div>
    </div>
  );
}
