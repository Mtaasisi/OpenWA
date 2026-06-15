import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, ChevronLeft, ChevronRight, PanelLeftClose } from 'lucide-react';
import {
  WORKSPACE_NAV_ITEMS,
  WORKSPACE_NAV_FOOTER,
  filterWorkspaceNavItems,
  isWorkspaceNavActive,
  STITCH_NAV_MAIN_KEYS,
  STITCH_NAV_FOOTER_KEYS,
  type WorkspaceNavItem,
  type WorkspaceNavBadge,
} from '../../lib/workspace-nav';
import { useLinkedChannels } from '../../hooks/useLinkedChannels';
import { MaterialSymbol } from '../MaterialSymbol';

import { stitchNavSymbol, stitchNavLabelKey } from '../../lib/stitch-nav-symbols';
import { isDesktopApp } from '../../lib/desktop-shell';

type MainSidebarProps = {
  isInteraktTheme: boolean;
  isStitchTheme?: boolean;
  isInbox: boolean;
  isSettings?: boolean;
  showInteraktLabels: boolean;
  interaktSidebarMode: 'expanded' | 'collapsed' | 'closed';
  isCollapsed: boolean;
  isMobile: boolean;
  isMobileOpen?: boolean;
  isRtl: boolean;
  userRole: string | null;
  pathname: string;
  search: string;
  onNavClick: () => void;
  onLogout: () => void;
  onToggleInteraktSidebar: () => void;
  onCloseInteraktSidebar: () => void;
  onToggleCollapse: () => void;
  getBadgeCount: (badge?: WorkspaceNavBadge) => number;
  sidebarClassName: string;
  interaktShellV2?: boolean;
  stitchShellV1?: boolean;
};

export function MainSidebar({
  isInteraktTheme,
  isInbox,
  isSettings = false,
  showInteraktLabels,
  interaktSidebarMode,
  isCollapsed,
  isMobile,
  isRtl,
  userRole,
  pathname,
  search,
  onNavClick,
  onLogout,
  onToggleInteraktSidebar,
  onCloseInteraktSidebar,
  onToggleCollapse,
  getBadgeCount,
  sidebarClassName,
  interaktShellV2 = false,
  stitchShellV1 = false,
}: MainSidebarProps) {
  const { t } = useTranslation();
  const { linkedIds } = useLinkedChannels();
  const useV2Shell = interaktShellV2 || isInteraktTheme;
  const useStitchShell = stitchShellV1;
  const mainNavItems = filterWorkspaceNavItems(WORKSPACE_NAV_ITEMS.filter(item => !item.footerOnly), {
    linkedChannelIds: linkedIds,
    role: userRole,
  });

  const roleLabel = userRole
    ? t(`apiKeys.roles.${userRole}`, { defaultValue: userRole })
    : null;
  const interaktSidebarExpanded = isInteraktTheme && interaktSidebarMode === 'expanded';
  const interaktSidebarCollapsed = isInteraktTheme && interaktSidebarMode === 'collapsed';

  const renderV2NavItem = (item: WorkspaceNavItem) => {
    const label = t(item.labelKey);
    const returnFrom = `${pathname}${search}`;
    const to =
      item.key === 'settings'
        ? { pathname: item.to, state: { from: returnFrom } }
        : item.search
          ? { pathname: item.to, search: item.search }
          : item.to;
    const active = isWorkspaceNavActive(pathname, search, item);
    const badge = getBadgeCount(item.badge);

    return (
      <NavLink
        key={`${item.to}${item.search ?? ''}`}
        to={to}
        className={`wa-sidebar-v2__link${active ? ' is-active' : ''}`}
        onClick={onNavClick}
        title={label}
      >
        <MaterialSymbol name={item.symbol} size={20} filled={active} />
        <span className="wa-sidebar-v2__label">{label}</span>
        {badge > 0 && (
          <span className="wa-sidebar-v2__badge">{badge > 99 ? '99+' : badge}</span>
        )}
      </NavLink>
    );
  };

  const renderStitchNavItem = (item: WorkspaceNavItem) => {
    const label = t(stitchNavLabelKey(item.key, item.labelKey));
    const returnFrom = `${pathname}${search}`;
    const to =
      item.key === 'settings'
        ? { pathname: item.to, state: { from: returnFrom } }
        : item.search
          ? { pathname: item.to, search: item.search }
          : item.to;
    const active = isWorkspaceNavActive(pathname, search, item);
    const badge = getBadgeCount(item.badge);
    const symbol = stitchNavSymbol(item.key, item.symbol);

    return (
      <NavLink
        key={`${item.to}${item.search ?? ''}`}
        to={to}
        end={item.end}
        className={`wa-sidebar-stitch__link${active ? ' is-active' : ''}`}
        onClick={onNavClick}
        title={label}
      >
        <MaterialSymbol name={symbol} size={22} className="wa-sidebar-stitch__symbol" />
        <span className="wa-sidebar-stitch__label">{label}</span>
        {badge > 0 && (
          <span className="wa-sidebar-stitch__badge">{badge > 99 ? '99+' : badge}</span>
        )}
      </NavLink>
    );
  };

  if (useStitchShell) {
    const navByKey = new Map(WORKSPACE_NAV_ITEMS.map(item => [item.key, item]));
    const mainNavItemsStitch = STITCH_NAV_MAIN_KEYS.map(key => navByKey.get(key)).filter(
      (item): item is WorkspaceNavItem => item != null,
    );
    const footerItems = STITCH_NAV_FOOTER_KEYS.map(key => navByKey.get(key)).filter(
      (item): item is WorkspaceNavItem => item != null,
    );

    return (
      <aside className={sidebarClassName}>
        <div className="wa-sidebar-stitch__chrome">
          {!isDesktopApp() && (
            <div className="wa-sidebar-stitch__traffic" aria-hidden>
              <span className="wa-sidebar-stitch__traffic-dot wa-sidebar-stitch__traffic-dot--red" />
              <span className="wa-sidebar-stitch__traffic-dot wa-sidebar-stitch__traffic-dot--yellow" />
              <span className="wa-sidebar-stitch__traffic-dot wa-sidebar-stitch__traffic-dot--green" />
            </div>
          )}
          <div className="wa-sidebar-stitch__logo" aria-hidden>
            <svg className="wa-sidebar-stitch__logo-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
          </div>
        </div>
        <nav className="wa-sidebar-stitch__nav">
          {mainNavItemsStitch.map(renderStitchNavItem)}
        </nav>
        <div className="wa-sidebar-stitch__footer">
          <span className="wa-sidebar-stitch__footer-divider" aria-hidden />
          {footerItems.map(renderStitchNavItem)}
        </div>
      </aside>
    );
  }

  if (useV2Shell) {
    const footerItems = filterWorkspaceNavItems(WORKSPACE_NAV_FOOTER, {
      linkedChannelIds: linkedIds,
      role: userRole,
    });

    return (
      <aside className={sidebarClassName}>
        <nav className="wa-sidebar-v2__nav">
          {mainNavItems.map(renderV2NavItem)}
        </nav>
        <div className="wa-sidebar-v2__footer">
          <span className="wa-sidebar-v2__footer-divider" aria-hidden />
          {footerItems.map(renderV2NavItem)}
          <button
            type="button"
            className="wa-sidebar-v2__expand"
            onClick={onToggleInteraktSidebar}
            title={interaktSidebarExpanded ? t('common.collapse') : t('common.expand')}
            aria-label={interaktSidebarExpanded ? t('common.collapse') : t('common.expand')}
          >
            <MaterialSymbol
              name={
                interaktSidebarExpanded
                  ? 'keyboard_double_arrow_left'
                  : 'keyboard_double_arrow_right'
              }
              size={20}
            />
          </button>
        </div>
      </aside>
    );
  }

  const renderNavItem = (item: WorkspaceNavItem) => {
    const label = t(item.labelKey);
    const hideLabel = isInteraktTheme ? !showInteraktLabels : isCollapsed;
    const returnFrom = `${pathname}${search}`;
    const to =
      item.key === 'settings'
        ? { pathname: item.to, state: { from: returnFrom } }
        : item.search
          ? { pathname: item.to, search: item.search }
          : item.to;
    const active = isWorkspaceNavActive(pathname, search, item);
    const badge = getBadgeCount(item.badge);

    if (isInteraktTheme) {
      return (
        <NavLink
          key={`${item.to}${item.search ?? ''}`}
          to={to}
          className={`nav-item nav-item--interakt${active ? ' active' : ''}`}
          onClick={onNavClick}
          title={hideLabel ? label : undefined}
        >
          <MaterialSymbol name={item.symbol} size={20} />
          {!hideLabel && (
            <span className="nav-item__label-row">
              <span className="nav-item__label">{label}</span>
              {item.comingSoon && (
                <span className="nav-item__soon-badge">{t('nav.comingSoonShort')}</span>
              )}
            </span>
          )}
          {badge > 0 && (
            <span className="nav-item__badge">{badge > 99 ? '99+' : badge}</span>
          )}
        </NavLink>
      );
    }

    const Icon = item.icon;
    return (
      <NavLink
        key={`${item.to}${item.search ?? ''}`}
        to={to}
        className={({ isActive }) => `nav-item ${isActive || active ? 'active' : ''}`}
        end={item.end}
        onClick={onNavClick}
        title={hideLabel ? label : undefined}
      >
        <Icon size={20} />
        {!hideLabel && (
          <span className="nav-item__label-row">
            <span>{label}</span>
            {item.comingSoon && (
              <span className="nav-item__soon-badge">{t('nav.comingSoonShort')}</span>
            )}
          </span>
        )}
        {badge > 0 && (
          <span className="nav-item__badge">{badge > 99 ? '99+' : badge}</span>
        )}
      </NavLink>
    );
  };

  return (
    <aside className={sidebarClassName}>
      <div className={`sidebar-header${isInteraktTheme ? ' sidebar-header--interakt' : ''}`}>
        <div className="sidebar-header__main">
          <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
          {(isInteraktTheme ? showInteraktLabels : !isCollapsed) && (
            <div className="sidebar-brand">
              <span className="brand-name">{t('common.appName')}</span>
              {isInteraktTheme && (
                <span className="brand-subtitle">{t('nav.commandCenterSubtitle')}</span>
              )}
              {!isInteraktTheme && (
                <span className="brand-subtitle">{t('common.appSubtitle')}</span>
              )}
            </div>
          )}
        </div>
        {!isMobile && isInteraktTheme && !isInbox && !isSettings && (
          <button
            type="button"
            className="sidebar-header__collapse"
            onClick={onToggleInteraktSidebar}
            title={interaktSidebarExpanded ? t('common.collapse') : t('common.expand')}
            aria-label={interaktSidebarExpanded ? t('common.collapse') : t('common.expand')}
          >
            {interaktSidebarExpanded
              ? (isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
              : (isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)}
          </button>
        )}
        {!isMobile && isInteraktTheme && isInbox && (
          <button
            type="button"
            className="sidebar-header__collapse sidebar-header__close"
            onClick={onCloseInteraktSidebar}
            title={t('sidebar.close')}
            aria-label={t('sidebar.close')}
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      {!isMobile && !isInteraktTheme && (
        <button
          type="button"
          className="collapse-toggle"
          onClick={onToggleCollapse}
          title={isCollapsed ? t('common.expand') : t('common.collapse')}
          aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
        >
          {isCollapsed
            ? (isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
            : (isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
        </button>
      )}

      <nav className="sidebar-nav">
        {mainNavItems.map(renderNavItem)}
      </nav>

      <div className="sidebar-footer">
        {isInteraktTheme && showInteraktLabels && roleLabel && (
          <div className="sidebar-interakt-user">
            <div className="sidebar-interakt-user__avatar" aria-hidden>
              {roleLabel.slice(0, 2).toUpperCase()}
            </div>
            <p className="sidebar-interakt-user__name">{roleLabel}</p>
          </div>
        )}
        {WORKSPACE_NAV_FOOTER.map(item => {
          if (isInteraktTheme) {
            return renderNavItem(item);
          }
          const Icon = item.icon;
          const label = t(item.labelKey);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item sidebar-footer__settings ${isActive ? 'active' : ''}`
              }
              onClick={onNavClick}
              title={isCollapsed ? label : undefined}
            >
              <Icon size={20} />
              {!isCollapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
        <button
          type="button"
          className={`logout-btn${isInteraktTheme ? ' logout-btn--interakt' : ''}`}
          onClick={onLogout}
          title={
            isCollapsed || interaktSidebarCollapsed ? t('common.logout') : undefined
          }
          aria-label={t('common.logout')}
        >
          {isInteraktTheme ? <MaterialSymbol name="logout" size={20} /> : <LogOut size={20} />}
          {showInteraktLabels && <span className="logout-btn__label">{t('common.logout')}</span>}
          {!isInteraktTheme && !isCollapsed && (
            <span className="logout-btn__label">{t('common.logout')}</span>
          )}
        </button>
      </div>
    </aside>
  );
}
