import type { ReactNode } from 'react';

export type StatusBadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'
  | 'connected'
  | 'disconnected'
  | 'danger'
  | 'info'
  | 'medium'
  | 'coming-soon';

type StatusBadgeProps = {
  variant?: StatusBadgeVariant;
  children: ReactNode;
  className?: string;
};

function normalizeVariant(variant: StatusBadgeVariant): string {
  if (variant === 'danger') return 'error';
  if (variant === 'connected') return 'success';
  if (variant === 'disconnected') return 'error';
  return variant;
}

export function StatusBadge({ variant = 'neutral', children, className = '' }: StatusBadgeProps) {
  const normalized = normalizeVariant(variant);
  return (
    <span className={`ws-status-badge ws-status-badge--${normalized} ${className}`.trim()}>
      {children}
    </span>
  );
}
