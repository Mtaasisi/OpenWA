import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import './dashboard-primitives.css';

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: string | number;
  linkTo?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  subtitle,
  icon,
  badge,
  linkTo,
  linkLabel,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <section className={`dash-section ${className}`.trim()}>
      <div className="dash-section__header">
        <div>
          <div className="dash-section__title-row">
            {icon}
            <h2 className="dash-section__title">{title}</h2>
          </div>
          {subtitle && <p className="dash-section__subtitle">{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {badge !== undefined && badge !== null && (
            <span className="dash-section__badge">{badge}</span>
          )}
          {linkTo && linkLabel && (
            <Link to={linkTo} className="dash-section__link">{linkLabel}</Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
