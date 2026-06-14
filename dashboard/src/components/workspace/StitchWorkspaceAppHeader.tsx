import { useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from '../MaterialSymbol';
import { getWorkspacePageTitleKey } from '../../lib/workspace-page-title';
import { dispatchOpenCommandPalette } from '../../lib/inbox-command-palette';
import { useShellInboxSearchBinding } from '../../lib/shell-inbox-search-context';
import { getStoredUser } from '../../lib/auth-storage';
import { stitchUserAvatarUrl } from '../../lib/stitch-user-avatar';
import { InboxHeaderSearch } from '../InboxHeaderSearch';
import { AppStatusBarHiddenIndicator } from '../status-bar/AppBottomStatusBar';
import { AiBudgetWarningBanner } from '../AiBudgetWarningBanner';
import './workspace-app-shell.css';

type StitchWorkspaceAppHeaderProps = {
  userRole: string | null;
  notificationCount?: number;
};

export function StitchWorkspaceAppHeader({
  userRole,
  notificationCount = 0,
}: StitchWorkspaceAppHeaderProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const titleKey = getWorkspacePageTitleKey(location.pathname);
  const onInboxRoute = location.pathname.startsWith('/inbox');
  const onFollowupsRoute = location.pathname.startsWith('/followups');
  const inboxSearch = useShellInboxSearchBinding();
  const useInboxChatSearch = onInboxRoute && inboxSearch != null;
  const useFollowupsSearch = onFollowupsRoute && inboxSearch != null;
  const [searchValue, setSearchValue] = useState('');
  const shellSearchValue = useFollowupsSearch ? (inboxSearch?.searchValue ?? '') : searchValue;
  const storedUser = getStoredUser();

  const roleLabel = userRole
    ? t(`apiKeys.roles.${userRole}`, { defaultValue: userRole })
    : t('common.appName');
  const displayName = storedUser?.name?.trim() || roleLabel;
  const avatarUrl = stitchUserAvatarUrl(displayName, storedUser?.email);

  const onGlobalSearchFocus = () => {
    if (!onInboxRoute) {
      dispatchOpenCommandPalette();
    }
  };

  const onGlobalSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!onInboxRoute && e.key === 'Enter') {
      dispatchOpenCommandPalette();
    }
  };

  const pageTitle = onInboxRoute
    ? t('inbox.stitch.appHeaderTitle')
    : location.pathname === '/' || location.pathname.startsWith('/dashboard')
      ? t('nav.dashboard')
      : t(titleKey);

  return (
    <>
    <header className="wa-app-header wa-app-header--stitch">
      <div className="wa-app-header__left">
        <h2 className="wa-app-header__title">{pageTitle}</h2>
        <div className="wa-app-header__center">
          {useInboxChatSearch && inboxSearch ? (
            <InboxHeaderSearch binding={inboxSearch} />
          ) : useFollowupsSearch && inboxSearch ? (
            <div className="wa-app-header__search wa-app-header__search--wide">
              <MaterialSymbol name="search" size={18} className="wa-app-header__search-icon" />
              <input
                ref={inboxSearch.searchInputRef}
                type="search"
                value={shellSearchValue}
                onChange={e => inboxSearch.applyListSearch(e.target.value)}
                placeholder={inboxSearch.placeholder ?? t('followups.searchPlaceholder')}
                aria-label={inboxSearch.placeholder ?? t('followups.searchPlaceholder')}
              />
            </div>
          ) : (
            <div className="wa-app-header__search wa-app-header__search--wide">
              <MaterialSymbol name="search" size={18} className="wa-app-header__search-icon" />
              <input
                type="search"
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                onFocus={onGlobalSearchFocus}
                onKeyDown={onGlobalSearchKeyDown}
                placeholder={
                  onInboxRoute ? t('inbox.stitch.searchPatients') : t('shell.searchPlaceholder')
                }
                aria-label={
                  onInboxRoute ? t('inbox.stitch.searchPatients') : t('shell.searchPlaceholder')
                }
              />
            </div>
          )}
        </div>
      </div>

      <div className="wa-app-header__right">
        <AppStatusBarHiddenIndicator />
        <Link
          to="/followups"
          className="wa-app-header__icon-btn"
          title={t('nav.followups')}
          aria-label={t('nav.followups')}
        >
          <svg
            className="wa-app-header__bell-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {notificationCount > 0 && (
            <span className="wa-app-header__notif-dot" aria-hidden />
          )}
        </Link>
        <span className="wa-app-header__divider" aria-hidden />
        <Link to="/settings" className="wa-app-header__user" title={displayName}>
          <img
            src={avatarUrl}
            alt=""
            className="wa-app-header__avatar wa-app-header__avatar--photo"
            aria-hidden
          />
          <span className="wa-app-header__user-meta">
            <span className="wa-app-header__user-name">{displayName}</span>
            <span className="wa-app-header__user-role">{roleLabel}</span>
          </span>
        </Link>
      </div>
    </header>
    <AiBudgetWarningBanner />
    </>
  );
}
