import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { LayoutOutletContext } from '../lib/layout-outlet-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { type UserRole } from '../hooks/useRole';
import type { SupportedLanguage } from '../i18n';
import { useFollowupAlerts } from '../hooks/useFollowupAlerts';
import { useAppNotifications } from '../hooks/useAppNotifications';
import { useQuery } from '@tanstack/react-query';
import { followupApi, aiLearningCacheApi } from '../services/api';
import {
  useUnifiedInboxConversationsQuery,
  useInauzwaSyncStatusQuery,
  useSessionsQuery,
  INBOX_SLOW_POLL_INTERVAL_MS,
} from '../hooks/queries';
import { isSessionConnecting } from '../lib/session-status';
import {
  loadUserPreferences,
  saveUserPreferences,
  type InteraktSidebarMode,
} from '../lib/user-preferences';
import type { WorkspaceNavBadge } from '../lib/workspace-nav';
import { getLegacyNavRedirect } from '../lib/legacy-nav-redirects';
import { AppShell, MainSidebar, TopBar, MobileBottomNav } from './workspace';
import { WorkspaceAppHeader } from './workspace/WorkspaceAppHeader';
import { StitchWorkspaceAppHeader } from './workspace/StitchWorkspaceAppHeader';
import { SidebarReopenButton } from './workspace/SidebarReopenButton';
import { isDesktopApp } from '../lib/desktop-shell';
import { SystemStatusBanner } from './SystemStatusBanner';
import { SharedSocketBootstrap } from './SharedSocketBootstrap';
import { useInboxChatAppearance } from '../hooks/useInboxChatAppearance';
import { ShellInboxSearchProvider } from '../lib/shell-inbox-search-context';
import { useLinkedSessionsAutoStart } from '../hooks/useLinkedSessionsAutoStart';
import { GlobalCommandPalette } from './GlobalCommandPalette';
import { AppBottomStatusBar } from './status-bar/AppBottomStatusBar';
import { loadStatusBarPreferences } from '../lib/app-status-preferences';
import { SettingsSearchProvider } from './settings/settings-search-context';
import './Layout.css';
import './workspace/workspace-app-shell.css';
import './workspace/whatsapp-inbox-v2.css';

interface LayoutProps {
  onLogout: () => void;
  userRole: UserRole | null;
}

export function Layout({ onLogout, userRole }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const { activeTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isInteraktTheme = activeTheme.effects === 'interakt';
  const isStitchTheme = activeTheme.effects === 'stitch';
  const isTacticalTheme = activeTheme.effects === 'tactical';
  const isTacticalInbox =
    location.pathname === '/inbox' && activeTheme.effects === 'tactical';
  const isInteraktInbox = location.pathname === '/inbox' && isInteraktTheme;
  const isStitchInbox = location.pathname === '/inbox' && isStitchTheme;
  const isStitchFollowups = location.pathname.startsWith('/followups') && isStitchTheme;
  const isSettingsWorkspace = location.pathname.startsWith('/settings');
  const isChannelsWorkspace = location.pathname.startsWith('/channels');
  const isFullBleedInbox = isTacticalInbox || isInteraktInbox || isStitchInbox;
  const isFullBleedWorkspace =
    isFullBleedInbox || isSettingsWorkspace || isChannelsWorkspace || isStitchFollowups;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const interaktV2Shell = isInteraktTheme && !isTacticalInbox;
  const stitchV1Shell = isStitchTheme && !isTacticalInbox;
  const appHeaderShell = interaktV2Shell || stitchV1Shell;
  const [interaktSidebarMode, setInteraktSidebarMode] = useState<InteraktSidebarMode>(
    () => loadUserPreferences().interaktSidebarMode,
  );

  const setInteraktMode = useCallback((mode: InteraktSidebarMode) => {
    setInteraktSidebarMode(mode);
    saveUserPreferences({ interaktSidebarMode: mode });
  }, []);

  useEffect(() => {
    const onPrefs = (e: Event) => {
      const detail = (e as CustomEvent<{ interaktSidebarMode?: InteraktSidebarMode }>).detail;
      if (detail?.interaktSidebarMode) {
        setInteraktSidebarMode(detail.interaktSidebarMode);
      }
    };
    window.addEventListener('openwa-prefs-updated', onPrefs);
    return () => window.removeEventListener('openwa-prefs-updated', onPrefs);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);
      if (mobile && isInteraktTheme && interaktSidebarMode === 'expanded') {
        setInteraktMode('collapsed');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInteraktTheme, interaktSidebarMode, setInteraktMode]);

  const handleNavClick = () => {
    if (isMobile) setIsMobileOpen(false);
  };

  useEffect(() => {
    document.body.style.overflow = isMobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    const enteringInbox =
      location.pathname === '/inbox' && prevPathRef.current !== '/inbox';
    const leavingInbox =
      location.pathname !== '/inbox' && prevPathRef.current === '/inbox';
    prevPathRef.current = location.pathname;
    if (enteringInbox && isInteraktTheme && !interaktV2Shell && interaktSidebarMode !== 'closed') {
      setInteraktMode('closed');
    }
    if (leavingInbox && isInteraktTheme && !interaktV2Shell && interaktSidebarMode === 'closed') {
      setInteraktMode('expanded');
    }
  }, [location.pathname, isInteraktTheme, interaktV2Shell, interaktSidebarMode, setInteraktMode]);

  useEffect(() => {
    const target = getLegacyNavRedirect(location.pathname, location.search);
    if (target && `${location.pathname}${location.search}` !== target) {
      navigate(target, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const toggleCollapse = () => setIsCollapsed(!isCollapsed);
  const toggleMobile = () => setIsMobileOpen(!isMobileOpen);

  const toggleInteraktSidebar = () => {
    if (interaktSidebarMode === 'expanded') {
      setInteraktMode('collapsed');
    } else {
      setInteraktMode('expanded');
    }
  };

  const closeInteraktSidebar = () => setInteraktMode('closed');
  const reopenInteraktSidebar = () => setInteraktMode('expanded');

  const currentLang = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] as SupportedLanguage;
  const isRtl = currentLang === 'he';

  useEffect(() => {
    if (interaktV2Shell && interaktSidebarMode === 'closed') {
      setInteraktMode('collapsed');
    }
  }, [interaktV2Shell, interaktSidebarMode, setInteraktMode]);

  useEffect(() => {
    if (!interaktV2Shell) return;
    const migrationKey = 'openwa_interakt_v2_sidebar_collapsed';
    if (!localStorage.getItem(migrationKey)) {
      setInteraktMode('collapsed');
      localStorage.setItem(migrationKey, '1');
    }
  }, [interaktV2Shell, setInteraktMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('shell--interakt-v2', interaktV2Shell);
    document.documentElement.classList.toggle('shell--stitch-v1', stitchV1Shell);
    return () => {
      document.documentElement.classList.remove('shell--interakt-v2');
      document.documentElement.classList.remove('shell--stitch-v1');
    };
  }, [interaktV2Shell, stitchV1Shell]);

  const interaktSidebarClosed = isInteraktTheme && interaktSidebarMode === 'closed' && !interaktV2Shell;
  const displayInteraktSidebarMode: InteraktSidebarMode = interaktSidebarMode;
  const effectiveSidebarExpanded = displayInteraktSidebarMode === 'expanded';
  const interaktSidebarExpanded = isInteraktTheme && effectiveSidebarExpanded;
  const showInteraktLabels = interaktSidebarExpanded && !isMobile;

  const wasSettingsWorkspaceRef = useRef(isSettingsWorkspace);
  useEffect(() => {
    const enteredSettings = isSettingsWorkspace && !wasSettingsWorkspaceRef.current;
    wasSettingsWorkspaceRef.current = isSettingsWorkspace;
    if (!enteredSettings || !interaktV2Shell) return;
    setInteraktMode('collapsed');
  }, [isSettingsWorkspace, interaktV2Shell, setInteraktMode]);
  const showMainSidebar = !isTacticalInbox && (!interaktSidebarClosed || interaktV2Shell || stitchV1Shell);

  useFollowupAlerts();
  useLinkedSessionsAutoStart();
  useInboxChatAppearance();

  const { data: inauzwaStatus } = useInauzwaSyncStatusQuery();
  const branchId =
    inauzwaStatus?.preferences?.branchId ?? inauzwaStatus?.branchId ?? undefined;

  const navBadgesEnabled = isInteraktTheme || isStitchTheme || isMobile;

  const { data: layoutSessions = [] } = useSessionsQuery({ refetchInterval: 60_000 });
  const anySessionConnecting = layoutSessions.some(s => isSessionConnecting(s.status));
  const anySessionReady = layoutSessions.some(s => s.status === 'ready');
  const anyBackgroundSyncing = layoutSessions.some(s => s.backgroundSyncing);
  const blockNavInboxBadge = anySessionConnecting && !anySessionReady;
  const inboxBadgePollInterval = blockNavInboxBadge
    ? false
    : anyBackgroundSyncing
      ? INBOX_SLOW_POLL_INTERVAL_MS
      : 60_000;

  const { data: followupCounts } = useQuery({
    queryKey: ['followups', 'queue', 'counts', branchId],
    queryFn: () => followupApi.getQueueCounts(branchId),
    refetchInterval: 60_000,
    enabled: navBadgesEnabled,
  });

  const onInboxPage = location.pathname.startsWith('/inbox');
  const onAiChatPage = location.pathname.startsWith('/ai');
  const onTrainingCenterPage = location.pathname.startsWith('/ai-training-center');

  const { data: aiTrainingUnknownBadge = 0 } = useQuery({
    queryKey: ['ai-training-center', 'unknown-badge'],
    queryFn: async () => {
      const { items } = await aiLearningCacheApi.listUnknownMessages({ limit: 100 });
      return items.filter(
        i => i.status === 'pending_review' || i.status === 'pending',
      ).length;
    },
    refetchInterval: 60_000,
    enabled: navBadgesEnabled && !onTrainingCenterPage,
    staleTime: 30_000,
  });

  const { data: inboxConversationsData } = useUnifiedInboxConversationsQuery(
    { status: 'open', limit: 200, offset: 0, ...(branchId ? { branchId } : {}) },
    {
      enabled: navBadgesEnabled && !blockNavInboxBadge && !onInboxPage,
      refetchInterval: onInboxPage ? false : inboxBadgePollInterval,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  );

  const inboxUnreadBadge = (inboxConversationsData?.conversations ?? []).filter(
    c => !c.resolved && c.hasUnread,
  ).length;
  const followupsOverdueBadge = followupCounts?.overdue ?? 0;

  useAppNotifications(inboxUnreadBadge);

  const getBadgeCount = (badge?: WorkspaceNavBadge) => {
    if (badge === 'inboxUnread') return inboxUnreadBadge;
    if (badge === 'followupsOverdue') return followupsOverdueBadge;
    if (badge === 'aiTrainingUnknown') return aiTrainingUnknownBadge;
    return 0;
  };

  const [statusBarVisible, setStatusBarVisible] = useState(() => loadStatusBarPreferences().showStatusBar);
  const [settingsNavSearch, setSettingsNavSearch] = useState('');

  useEffect(() => {
    const onPrefs = () => setStatusBarVisible(loadStatusBarPreferences().showStatusBar);
    window.addEventListener('openwa-status-bar-prefs-updated', onPrefs);
    return () => window.removeEventListener('openwa-status-bar-prefs-updated', onPrefs);
  }, []);

  const layoutModifierClasses = [
    isTacticalInbox ? 'layout--tactical-inbox' : '',
    isTacticalTheme ? 'layout--tactical-workspace' : '',
    isInteraktTheme ? 'layout--interakt' : '',
    interaktV2Shell ? 'layout--interakt-v2' : '',
    interaktV2Shell && effectiveSidebarExpanded ? 'layout--interakt-v2-sidebar-expanded' : '',
    stitchV1Shell ? 'layout--stitch-v1' : '',
    isInteraktInbox ? 'layout--interakt-inbox' : '',
    isStitchInbox ? 'layout--stitch-inbox' : '',
    isSettingsWorkspace ? 'layout--settings-workspace' : '',
    isMobile && !isFullBleedWorkspace ? 'layout--mobile-bottom-nav' : '',
    statusBarVisible ? 'layout--with-status-bar' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const mainClasses = [
    'main-content',
    isCollapsed && !isFullBleedWorkspace && !isInteraktTheme && !isStitchTheme ? 'expanded' : '',
    isMobile && !isFullBleedWorkspace && !isInteraktTheme && !isStitchTheme ? 'mobile' : '',
    isTacticalInbox ? 'main-content--tactical-inbox' : '',
    interaktV2Shell
      ? [
          'main-content--interakt-v2',
          effectiveSidebarExpanded ? 'main-content--interakt-v2-expanded' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : stitchV1Shell
        ? 'main-content--stitch-v1'
        : isInteraktTheme
          ? `main-content--interakt main-content--interakt-${displayInteraktSidebarMode}`
          : '',
    isInteraktInbox ? 'main-content--interakt-inbox' : '',
    isStitchInbox ? 'main-content--stitch-inbox' : '',
    isSettingsWorkspace ? 'main-content--settings-workspace' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const sidebarClassName = stitchV1Shell
    ? 'sidebar sidebar--stitch-v1'
    : interaktV2Shell
    ? [
        'sidebar',
        'sidebar--interakt-v2',
        effectiveSidebarExpanded ? 'sidebar--interakt-v2-expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')
    : [
        'sidebar',
        isInteraktTheme
          ? `sidebar--interakt sidebar--interakt-${displayInteraktSidebarMode}`
          : isCollapsed
            ? 'collapsed'
            : '',
        isMobile && !isInteraktTheme ? 'mobile' : '',
        isMobileOpen ? 'open' : '',
      ]
        .filter(Boolean)
        .join(' ');

  const outletContext: LayoutOutletContext = {
    interaktSidebarClosed,
    reopenInteraktSidebar,
    interaktV2Shell,
    stitchV1Shell,
  };

  const showMobileChrome = isMobile && !isFullBleedWorkspace && !isInteraktTheme && !isStitchTheme;
  const headerNotificationCount = followupsOverdueBadge + inboxUnreadBadge;

  return (
    <ShellInboxSearchProvider>
    <SettingsSearchProvider navSearch={settingsNavSearch} setNavSearch={setSettingsNavSearch}>
    <AppShell className={layoutModifierClasses || undefined}>
      <SharedSocketBootstrap />
      {appHeaderShell && (
        stitchV1Shell ? (
          <StitchWorkspaceAppHeader
            userRole={userRole}
            notificationCount={headerNotificationCount}
          />
        ) : (
          <WorkspaceAppHeader
            userRole={userRole}
            notificationCount={headerNotificationCount}
          />
        )
      )}
      {showMobileChrome && (
        <TopBar
          isOpen={isMobileOpen}
          onToggle={toggleMobile}
          brandName={t('common.appName')}
          expandLabel={t('common.expand')}
        />
      )}

      {showMobileChrome && isMobileOpen && (
        <div className="sidebar-overlay" onClick={() => setIsMobileOpen(false)} />
      )}

      {showMainSidebar && (
        <MainSidebar
          isInteraktTheme={isInteraktTheme}
          isStitchTheme={isStitchTheme}
          isInbox={isInteraktInbox || isStitchInbox}
          isSettings={isSettingsWorkspace}
          showInteraktLabels={showInteraktLabels}
          interaktSidebarMode={displayInteraktSidebarMode}
          isCollapsed={isCollapsed}
          isMobile={isMobile}
          isMobileOpen={isMobileOpen}
          isRtl={isRtl}
          userRole={userRole}
          pathname={location.pathname}
          search={location.search}
          onNavClick={handleNavClick}
          onLogout={onLogout}
          onToggleInteraktSidebar={toggleInteraktSidebar}
          onCloseInteraktSidebar={closeInteraktSidebar}
          onToggleCollapse={toggleCollapse}
          getBadgeCount={getBadgeCount}
          sidebarClassName={sidebarClassName}
          interaktShellV2={interaktV2Shell}
          stitchShellV1={stitchV1Shell}
        />
      )}

      <main className={mainClasses}>
        {isInteraktTheme &&
          interaktSidebarClosed &&
          !interaktV2Shell &&
          !isInteraktInbox &&
          !isSettingsWorkspace &&
          !isDesktopApp() && (
          <SidebarReopenButton variant="floating" onClick={reopenInteraktSidebar} />
        )}
        <div
          className={[
            'main-content__body',
            isInteraktInbox && interaktV2Shell ? 'main-content__body--inbox' : '',
            isStitchInbox && stitchV1Shell ? 'main-content__body--inbox' : '',
            isStitchFollowups && stitchV1Shell ? 'main-content__body--followups-stitch' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {!isFullBleedWorkspace && <SystemStatusBanner />}
          <Outlet context={outletContext} />
        </div>
      </main>

      {isMobile && !isFullBleedWorkspace && <MobileBottomNav getBadgeCount={getBadgeCount} />}
      <AppBottomStatusBar />
      <GlobalCommandPalette disabled={onInboxPage || onAiChatPage} />
    </AppShell>
    </SettingsSearchProvider>
    </ShellInboxSearchProvider>
  );
}
