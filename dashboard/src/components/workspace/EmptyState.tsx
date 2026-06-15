import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { renderIconSlot } from './render-icon';

type EmptyStateProps = {
  icon?: LucideIcon | ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon: iconProp = Inbox,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const iconNode = (
    <div className="ws-empty-state__icon">
      {renderIconSlot(iconProp, 32)}
    </div>
  );

  return (
    <div className={`ws-empty-state ${className}`.trim()}>
      {iconNode}
      <h3 className="ws-empty-state__title">{title}</h3>
      {description && <p className="ws-empty-state__description">{description}</p>}
      {action}
    </div>
  );
}
