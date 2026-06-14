import { useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { MaterialSymbol } from '../MaterialSymbol';
import { getWorkspacePageTitleKey } from '../../lib/workspace-page-title';
import { dispatchOpenCommandPalette } from '../../lib/inbox-command-palette';
import { useShellInboxSearchBinding } from '../../lib/shell-inbox-search-context';
import { useSettingsSearch } from '../settings/settings-search-context';
import { useAppStatus } from '../../hooks/useAppStatus';
import { InboxHeaderSearch } from '../InboxHeaderSearch';
import { productsApi } from '../../services/api';
import { isDesktopApp } from '../../lib/desktop-shell';
import { AppStatusBarHiddenIndicator } from '../status-bar/AppBottomStatusBar';
import { AiBudgetWarningBanner } from '../AiBudgetWarningBanner';
import './workspace-app-shell.css';

type WorkspaceAppHeaderProps = {
  userRole: string | null;
  notificationCount?: number;
};

export function WorkspaceAppHeader({
  userRole,
  notificationCount = 0,
}: WorkspaceAppHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const titleKey = getWorkspacePageTitleKey(location.pathname);
  const inboxSearch = useShellInboxSearchBinding();
  const settingsSearch = useSettingsSearch();
  const { data: appStatus } = useAppStatus();
  const onInboxRoute = location.pathname.startsWith('/inbox');
  const onSettingsRoute = location.pathname.startsWith('/settings');
  const useInboxChatSearch = onInboxRoute && inboxSearch != null;
  const [searchValue, setSearchValue] = useState('');

  const syncMutation = useMutation({
    mutationFn: () => productsApi.quickSyncInauzwa(),
  });

  const roleLabel = userRole
    ? t(`apiKeys.roles.${userRole}`, { defaultValue: userRole })
    : t('common.appName');
  const avatarLabel = roleLabel.slice(0, 2).toUpperCase();

  const onGlobalSearchFocus = () => {
    if (!onSettingsRoute) {
      dispatchOpenCommandPalette();
    }
  };

  const onGlobalSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!onSettingsRoute && e.key === 'Enter') {
      dispatchOpenCommandPalette();
    }
  };

  const showConnectedPill =
    onSettingsRoute &&
    (appStatus?.database?.status === 'success' || appStatus?.overall === 'success');

  return (
    <>
    <header className="wa-app-header">
      <div className="wa-app-header__left">
        {!isDesktopApp() && (
          <div className="wa-app-header__traffic" aria-hidden>
            <span className="wa-app-header__traffic-dot wa-app-header__traffic-dot--red" />
            <span className="wa-app-header__traffic-dot wa-app-header__traffic-dot--yellow" />
            <span className="wa-app-header__traffic-dot wa-app-header__traffic-dot--green" />
          </div>
        )}
        <h2 className="wa-app-header__title">{t(titleKey)}</h2>
      </div>

      <div className="wa-app-header__center">
        {useInboxChatSearch && inboxSearch ? (
          <InboxHeaderSearch binding={inboxSearch} />
        ) : (
          <div className="wa-app-header__search wa-app-header__search--wide">
            <MaterialSymbol name="search" size={18} className="wa-app-header__search-icon" />
            <input
              type="search"
              value={
                onSettingsRoute && settingsSearch ? settingsSearch.navSearch : searchValue
              }
              onChange={e => {
                if (onSettingsRoute && settingsSearch) {
                  settingsSearch.setNavSearch(e.target.value);
                  return;
                }
                setSearchValue(e.target.value);
              }}
              onFocus={onGlobalSearchFocus}
              onKeyDown={onGlobalSearchKeyDown}
              placeholder={
                onSettingsRoute
                  ? t('settings.navSearchPlaceholder')
                  : t('shell.searchPlaceholder')
              }
              aria-label={
                onSettingsRoute
                  ? t('settings.navSearchPlaceholder')
                  : t('shell.searchPlaceholder')
              }
            />
          </div>
        )}
      </div>

      <div className="wa-app-header__right">
        {showConnectedPill ? (
          <span className="wa-app-header__connected-pill">
            <span className="wa-app-header__connected-dot" aria-hidden />
            {t('common.connected')}
          </span>
        ) : null}
        <AppStatusBarHiddenIndicator />
        <Link
          to="/followups"
          className="wa-app-header__icon-btn"
          title={t('nav.followups')}
          aria-label={t('nav.followups')}
        >
          <MaterialSymbol name="notifications" size={20} />
          {notificationCount > 0 && (
            <span className="wa-app-header__notif-dot" aria-hidden />
          )}
        </Link>
        <span className="wa-app-header__divider" aria-hidden />
        <button
          type="button"
          className="wa-app-header__sync"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          title={onInboxRoute ? t('shell.syncProductsHint') : t('shell.syncNowHint')}
          aria-label={onInboxRoute ? t('shell.syncProducts') : t('shell.syncNow')}
        >
          {syncMutation.isPending
            ? onInboxRoute
              ? t('shell.syncingProducts')
              : t('shell.syncing')
            : onInboxRoute
              ? t('shell.syncProducts')
              : t('shell.syncNow')}
        </button>
        <Link to="/settings" className="wa-app-header__avatar" title={roleLabel}>
          <span aria-hidden>{avatarLabel}</span>
        </Link>
      </div>
    </header>
    <AiBudgetWarningBanner />
    </>
  );
}
