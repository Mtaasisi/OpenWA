import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { renderIconSlot } from './render-icon';

type QuickActionButtonProps = {
  icon?: LucideIcon | ReactNode;
  title?: string;
  label?: string;
  onClick?: () => void;
  to?: string;
  linkState?: unknown;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'icon';
  className?: string;
};

export function QuickActionButton({
  icon,
  title,
  label,
  onClick,
  to,
  linkState,
  disabled,
  variant = 'default',
  className = '',
}: QuickActionButtonProps) {
  const ariaLabel = title ?? label ?? '';
  const isIconOnly = variant === 'icon' || (!label && Boolean(icon));

  const cls = [
    isIconOnly ? 'ws-quick-action-btn' : 'ws-quick-action',
    variant === 'primary' ? 'ws-quick-action--primary' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconContent = renderIconSlot(icon, 14);

  const content = isIconOnly ? (
    iconContent
  ) : (
    <>
      {iconContent}
      {label}
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        state={linkState}
        className={cls}
        onClick={onClick}
        aria-label={ariaLabel || undefined}
      >
        {content}
      </Link>
    );
  }

  if (isIconOnly) {
    return (
      <button
        type="button"
        className={cls}
        title={ariaLabel}
        aria-label={ariaLabel}
        onClick={onClick}
        disabled={disabled}
      >
        {content}
      </button>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}
