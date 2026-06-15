import type { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { LayoutOutletContext } from '../lib/layout-outlet-context';
import { isDesktopApp } from '../lib/desktop-shell';
import { SidebarReopenButton } from './workspace/SidebarReopenButton';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
}

/**
 * Shared page header component for consistent styling across all pages.
 *
 * @example
 * // Simple usage
 * <PageHeader title="Settings" subtitle="Configure application preferences" />
 *
 * @example
 * // With badge and actions
 * <PageHeader
 *   title="Dashboard"
 *   badge={<StatusBadge status="connected" />}
 *   subtitle="Overview of your WhatsApp sessions"
 *   actions={<button>Create New</button>}
 * />
 */
export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  const layoutCtx = useOutletContext<LayoutOutletContext | undefined>();
  const showSidebarReopen =
    isDesktopApp() && Boolean(layoutCtx?.interaktSidebarClosed);

  return (
    <header className="page-header">
      <div className="page-header__top">
        <div className="page-header__title-group">
          {showSidebarReopen ? (
            <SidebarReopenButton onClick={layoutCtx!.reopenInteraktSidebar} />
          ) : null}
          <h1>{title}</h1>
          {badge && <span className="page-header__badge">{badge}</span>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </header>
  );
}
