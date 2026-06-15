import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Inbox, Users, BellRing, Menu } from 'lucide-react';
import type { WorkspaceNavBadge } from '../../lib/workspace-nav';

const BOTTOM_NAV = [
  { to: '/inbox', key: 'inbox', icon: Inbox, badge: 'inboxUnread' as const },
  { to: '/customers', key: 'customers', icon: Users },
  { to: '/followups', key: 'followups', icon: BellRing, badge: 'followupsOverdue' as const },
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/settings', key: 'more', icon: Menu },
] as const;

type Props = {
  getBadgeCount?: (badge?: WorkspaceNavBadge) => number;
};

export function MobileBottomNav({ getBadgeCount }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const returnFrom = `${location.pathname}${location.search}`;

  return (
    <nav className="ws-bottom-nav" aria-label="Mobile navigation">
      {BOTTOM_NAV.map(item => {
        const { to, key, icon: Icon } = item;
        const badge = 'badge' in item ? item.badge : undefined;
        const count = badge && getBadgeCount ? getBadgeCount(badge) : 0;
        const navTo =
          to === '/settings' ? { pathname: to, state: { from: returnFrom } } : to;
        return (
          <NavLink
            key={to}
            to={navTo}
            end={'end' in item ? item.end : false}
            className={({ isActive }) =>
              `ws-bottom-nav__item${isActive ? ' ws-bottom-nav__item--active' : ''}`
            }
          >
            <span className="ws-bottom-nav__icon-wrap">
              <Icon size={20} />
              {count > 0 && (
                <span className="ws-bottom-nav__badge" aria-label={String(count)}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span>{key === 'more' ? t('nav.more') : t(`nav.${key}`)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
