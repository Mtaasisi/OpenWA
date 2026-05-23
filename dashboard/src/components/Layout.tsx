import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Smartphone,
  LogOut,
  Inbox,
  Package,
  Settings as SettingsIcon,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { type UserRole } from '../hooks/useRole';
import type { SupportedLanguage } from '../i18n';
import './Layout.css';

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

const allNavItems = [
  { to: '/', icon: LayoutDashboard, key: 'dashboard' as const, adminOnly: false },
  { to: '/sessions', icon: Smartphone, key: 'sessions' as const, adminOnly: false },
  { to: '/inbox', icon: Inbox, key: 'inbox' as const, adminOnly: false },
  { to: '/products', icon: Package, key: 'products' as const, adminOnly: false },
];

export function Layout({ onLogout, userRole }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const { activeTheme } = useTheme();
  const location = useLocation();
  const isTacticalInbox =
    location.pathname === '/inbox' && activeTheme.effects === 'tactical';

  const navItems = allNavItems.filter(item => !item.adminOnly || userRole === 'admin');

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleNavClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] as SupportedLanguage;
  const isRtl = currentLang === 'he';

  return (
    <div className={`layout ${isTacticalInbox ? 'layout--tactical-inbox' : ''}`}>
      {isMobile && !isTacticalInbox && (
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={toggleMobile} aria-label={t('common.expand')}>
            {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="mobile-brand">
            <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
            <span className="brand-name">{t('common.appName')}</span>
          </div>
          <div style={{ width: 40 }} />
        </header>
      )}

      {isMobile && !isTacticalInbox && isMobileOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      {!isTacticalInbox && (
      <aside
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''} ${isMobileOpen ? 'open' : ''}`}
      >
        <div className="sidebar-header">
          <img src="/openwa_logo.webp" alt="OpenWA" className="sidebar-logo" />
          {!isCollapsed && (
            <div className="sidebar-brand">
              <span className="brand-name">{t('common.appName')}</span>
              <span className="brand-subtitle">{t('common.appSubtitle')}</span>
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            className="collapse-toggle"
            onClick={toggleCollapse}
            title={isCollapsed ? t('common.expand') : t('common.collapse')}
            aria-label={isCollapsed ? t('common.expand') : t('common.collapse')}
          >
            {isCollapsed
              ? (isRtl ? <ChevronLeft size={16} /> : <ChevronRight size={16} />)
              : (isRtl ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)}
          </button>
        )}

        <nav className="sidebar-nav">
          {navItems.map(({ to, icon: Icon, key }) => {
            const label = t(`nav.${key}`);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={to === '/'}
                onClick={handleNavClick}
                title={isCollapsed ? label : undefined}
              >
                <Icon size={20} />
                {!isCollapsed && <span>{label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => `nav-item sidebar-footer__settings ${isActive ? 'active' : ''}`}
            onClick={handleNavClick}
            title={isCollapsed ? t('nav.settings') : undefined}
          >
            <SettingsIcon size={20} />
            {!isCollapsed && <span>{t('nav.settings')}</span>}
          </NavLink>
          <button className="logout-btn" onClick={onLogout} title={isCollapsed ? t('common.logout') : undefined}>
            <LogOut size={20} />
            {!isCollapsed && <span>{t('common.logout')}</span>}
          </button>
        </div>
      </aside>
      )}

      <main
        className={`main-content ${isCollapsed && !isTacticalInbox ? 'expanded' : ''} ${isMobile && !isTacticalInbox ? 'mobile' : ''} ${isTacticalInbox ? 'main-content--tactical-inbox' : ''}`}
      >
        <Outlet />
      </main>
    </div>
  );
}
