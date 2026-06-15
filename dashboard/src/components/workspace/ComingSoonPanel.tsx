import type { ReactNode } from 'react';
import { Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from './StatusBadge';

type ComingSoonPanelProps = {
  title?: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  showStatusBadge?: boolean;
};

export function ComingSoonPanel({
  title,
  description,
  icon,
  children,
  className = '',
  showStatusBadge = false,
}: ComingSoonPanelProps) {
  const { t } = useTranslation();
  const displayTitle = title ?? t('nav.comingSoonTitle');

  return (
    <div className={`ws-coming-soon ${className}`.trim()}>
      {showStatusBadge && (
        <StatusBadge variant="coming-soon">{t('nav.comingSoon')}</StatusBadge>
      )}
      <div className="ws-coming-soon__icon">{icon ?? <Clock size={32} />}</div>
      <h3 className="ws-coming-soon__title">{displayTitle}</h3>
      {description && <p className="ws-coming-soon__description">{description}</p>}
      {children}
    </div>
  );
}
