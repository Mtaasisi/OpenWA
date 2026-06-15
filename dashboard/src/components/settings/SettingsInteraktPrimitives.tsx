import type { ChangeEvent, ReactNode } from 'react';
import { MaterialSymbol } from '../MaterialSymbol';
import './settings-interakt-panels.css';

export function InteraktPageIntro({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="interakt-page-intro">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

type InteraktCheckOptionProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
};

export function InteraktCheckOption({
  checked,
  disabled,
  onChange,
  title,
  hint,
}: InteraktCheckOptionProps) {
  return (
    <label
      className={`interakt-check-option${checked ? ' is-checked' : ''}${disabled ? ' is-disabled' : ''}`}
    >
      <input
        type="checkbox"
        className="interakt-check-option__input"
        checked={checked}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
      <span className={`interakt-check-option__box${checked ? ' is-checked' : ''}`} aria-hidden>
        {checked ? <MaterialSymbol name="check" size={16} /> : null}
      </span>
      <span>
        <span className="interakt-check-option__title">{title}</span>
        {hint ? <span className="interakt-check-option__hint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function InteraktBentoCard({
  icon,
  iconTone = 'primary',
  title,
  description,
  actions,
  children,
}: {
  icon: string;
  iconTone?: 'primary' | 'ai';
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="interakt-bento-card">
      <div className="interakt-bento-card__head">
        <span className={`interakt-bento-card__icon interakt-bento-card__icon--${iconTone}`}>
          <MaterialSymbol name={icon} size={22} filled />
        </span>
        {actions ? <div className="interakt-bento-card__actions">{actions}</div> : null}
      </div>
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </article>
  );
}
