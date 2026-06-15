import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MaterialSymbol } from './MaterialSymbol';
import { InboxInteraktFilterMenu } from './InboxInteraktFilterMenu';
import { InboxInteraktSwipeFilters } from './InboxInteraktSwipeFilters';
import type { Session, Conversation, InboxQueueCounts, InboxSavedViewRow } from '../services/api';
import { followupApi } from '../services/api';
import type { ConversationFilter, InboxConversationSort } from '../pages/inbox-helpers';
import { loadUserPreferences, saveUserPreferences } from '../lib/user-preferences';
import {
  buildInboxFilterChipLabel,
  inboxFilterChipIsActive,
} from '../pages/inbox-filter-ui';
import type { ChannelId } from '../lib/channels';
import { shouldShowSessionLabel } from '../pages/inbox-helpers';
import { useInteraktV2Shell } from '../hooks/useLayoutShell';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchPanelOpen: boolean;
  setSearchPanelOpen: (open: boolean) => void;
  activeFilter: ConversationFilter;
  setActiveFilter: (f: ConversationFilter) => void;
  hideGroups: boolean;
  setHideGroups: (value: boolean) => void;
  listCount: number;
  totalCount?: number;
  leadSourceFilter: string;
  setLeadSourceFilter: (v: string) => void;
  conversationSort: InboxConversationSort;
  setConversationSort: (sort: InboxConversationSort) => void;
  viewMode: 'all' | 'one';
  sessionId: string;
  sessions: Session[];
  onAccountChange: (value: 'all' | string) => void;
  conversations: Conversation[];
  onReopenSidebar?: () => void;
  channelFilter: ChannelId | 'all';
  setChannelFilter: (channel: ChannelId | 'all') => void;
  onNewChat?: () => void;
  filteredUnreadCount: number;
  canMarkAllRead: boolean;
  onMarkAllRead: () => void;
  onResetFilters: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  queueCounts?: InboxQueueCounts | null;
  preferClientQueueCounts?: boolean;
  savedViews?: InboxSavedViewRow[];
  onApplySavedView?: (view: InboxSavedViewRow) => void;
  onSaveCurrentView?: () => void;
  onDeleteSavedView?: (id: string) => void;
  canSaveView?: boolean;
}

export function InboxInteraktListHeader({
  searchQuery,
  setSearchQuery,
  searchInputRef,
  activeFilter,
  setActiveFilter,
  hideGroups,
  setHideGroups,
  listCount,
  totalCount,
  leadSourceFilter,
  setLeadSourceFilter,
  conversationSort,
  setConversationSort,
  viewMode,
  sessionId,
  sessions,
  onAccountChange,
  conversations,
  onReopenSidebar,
  channelFilter,
  setChannelFilter,
  onNewChat,
  searchPanelOpen,
  setSearchPanelOpen,
  filteredUnreadCount,
  canMarkAllRead,
  onMarkAllRead,
  onResetFilters,
  onContextMenu,
  queueCounts,
  preferClientQueueCounts,
  savedViews,
  onApplySavedView,
  onSaveCurrentView,
  onDeleteSavedView,
  canSaveView,
  onRefresh,
  refreshing = false,
}: Props) {
  const { t } = useTranslation();
  const interaktV2Shell = useInteraktV2Shell();
  const headerRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [filterMenuPos, setFilterMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(
    null,
  );
  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const searchOpen = searchPanelOpen;
  const setSearchOpen = setSearchPanelOpen;

  const myStaffId = loadUserPreferences().inboxMyStaffId;

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
    staleTime: 60_000,
    enabled: staffPickerOpen,
  });

  const accountValue = viewMode === 'all' ? 'all' : sessionId;
  const showSessionLabel = shouldShowSessionLabel(sessions);
  const chatCountLabel =
    totalCount != null && totalCount > listCount
      ? `${listCount} / ${totalCount}`
      : String(listCount);

  const chipState = useMemo(
    () => ({
      activeFilter,
      hideGroups,
      leadSourceFilter,
      conversationSort,
    }),
    [activeFilter, hideGroups, leadSourceFilter, conversationSort],
  );

  const chipLabel = useMemo(() => buildInboxFilterChipLabel(chipState, t), [chipState, t]);
  const chipActive = inboxFilterChipIsActive(chipState);

  const handleStaffPick = (id: string) => {
    saveUserPreferences({ inboxMyStaffId: id });
    setActiveFilter('assigned_to_me');
    setStaffPickerOpen(false);
  };

  const updateFilterMenuPosition = useCallback(() => {
    const trigger = filterTriggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const menuWidth = 300;
    let left = rect.right - menuWidth;
    left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));
    setFilterMenuPos({
      top: rect.bottom + 6,
      left,
      minWidth: menuWidth,
    });
  }, []);

  useLayoutEffect(() => {
    if (!filterDropdownOpen) {
      setFilterMenuPos(null);
      return;
    }
    updateFilterMenuPosition();
    window.addEventListener('resize', updateFilterMenuPosition);
    window.addEventListener('scroll', updateFilterMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateFilterMenuPosition);
      window.removeEventListener('scroll', updateFilterMenuPosition, true);
    };
  }, [filterDropdownOpen, updateFilterMenuPosition]);

  useEffect(() => {
    if (!searchOpen && !staffPickerOpen && !filterDropdownOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (headerRef.current?.contains(target)) return;
      if (filterMenuRef.current?.contains(target)) return;
      if (!interaktV2Shell) setSearchOpen(false);
      setStaffPickerOpen(false);
      setFilterDropdownOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!interaktV2Shell) setSearchOpen(false);
      setStaffPickerOpen(false);
      setFilterDropdownOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [searchOpen, staffPickerOpen, filterDropdownOpen, setSearchOpen, interaktV2Shell]);

  const filterMenu =
    filterDropdownOpen && filterMenuPos ? (
      <InboxInteraktFilterMenu
        menuRef={filterMenuRef}
        style={filterMenuPos}
        conversations={conversations}
        searchQuery={searchQuery}
        activeFilter={activeFilter}
        hideGroups={hideGroups}
        leadSourceFilter={leadSourceFilter}
        conversationSort={conversationSort}
        channelFilter={channelFilter}
        onSelectStatus={setActiveFilter}
        onHideGroupsChange={checked => {
          setHideGroups(checked);
          if (checked && activeFilter === 'groups') {
            setActiveFilter('all');
          }
        }}
        onGroupsOnlyChange={checked => {
          if (checked) {
            setActiveFilter('groups');
          } else if (activeFilter === 'groups') {
            setActiveFilter('all');
          }
        }}
        onLeadSourceChange={setLeadSourceFilter}
        onSortChange={setConversationSort}
        onChannelChange={setChannelFilter}
        onClose={() => setFilterDropdownOpen(false)}
        onNeedStaffPick={() => setStaffPickerOpen(true)}
        filteredUnreadCount={filteredUnreadCount}
        filtersActive={chipActive}
        canMarkAllRead={canMarkAllRead}
        onMarkAllRead={onMarkAllRead}
        onResetFilters={onResetFilters}
        queueCounts={queueCounts}
        preferClientQueueCounts={preferClientQueueCounts}
        savedViews={savedViews}
        onApplySavedView={onApplySavedView}
        onSaveCurrentView={onSaveCurrentView}
        onDeleteSavedView={onDeleteSavedView}
        canSaveView={canSaveView}
      />
    ) : null;

  return (
    <div
      className={`inbox-interakt-list-header${interaktV2Shell ? ' inbox-interakt-list-header--wa' : ''}`}
      ref={headerRef}
      onContextMenu={onContextMenu}
    >
      <div className="inbox-interakt-list-header__row">
        {onReopenSidebar ? (
          <button
            type="button"
            className="inbox-interakt-list-header__sidebar-btn"
            onClick={onReopenSidebar}
            title={t('sidebar.reopen')}
            aria-label={t('sidebar.reopen')}
          >
            <MaterialSymbol name="left_panel_open" size={20} />
          </button>
        ) : null}
        {showSessionLabel ? (
          <label className="inbox-interakt-list-header__account-select-wrap">
            <select
              className="inbox-interakt-list-header__account-select"
              value={accountValue}
              onChange={e => onAccountChange(e.target.value === 'all' ? 'all' : e.target.value)}
              aria-label={t('inbox.allAccounts')}
            >
              <option value="all">{t('inbox.allAccounts')}</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
            <span className="inbox-interakt-list-header__account-title" aria-hidden>
              <span className="inbox-interakt-list-header__account-title-text">
                {accountValue === 'all'
                  ? t('inbox.allAccounts')
                  : sessions.find(s => s.id === sessionId)?.name ?? t('inbox.session')}
              </span>
              <span className="inbox-interakt-list-header__list-count">{chatCountLabel}</span>
            </span>
            <MaterialSymbol
              name="keyboard_arrow_down"
              size={18}
              className="inbox-interakt-list-header__account-chevron"
            />
          </label>
        ) : (
          <h2 className="inbox-interakt-list-header__list-title">
            <span>{t('inbox.conversations')}</span>
            <span className="inbox-interakt-list-header__list-count">{chatCountLabel}</span>
          </h2>
        )}
        <div className="inbox-interakt-list-header__actions">
          {onRefresh ? (
            <button
              type="button"
              className={`inbox-interakt-list-header__icon-btn${
                refreshing ? ' is-active' : ''
              }`}
              onClick={onRefresh}
              disabled={refreshing}
              aria-busy={refreshing}
              title={t('inbox.refreshHint')}
              aria-label={t('inbox.refresh')}
            >
              <MaterialSymbol name="refresh" size={20} spin={refreshing} />
            </button>
          ) : null}
          {onNewChat ? (
            <button
              type="button"
              className="inbox-interakt-list-header__icon-btn"
              title={t('inbox.newChat')}
              aria-label={t('inbox.newChat')}
              onClick={onNewChat}
            >
              <MaterialSymbol name="edit_square" size={20} />
            </button>
          ) : null}
          {!interaktV2Shell ? (
            <button
              type="button"
              className={`inbox-interakt-list-header__icon-btn${searchOpen ? ' is-active' : ''}`}
              title={t('inbox.searchPlaceholder')}
              aria-label={t('inbox.searchPlaceholder')}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen(!searchOpen);
                if (!searchOpen) window.setTimeout(() => searchInputRef.current?.focus(), 0);
                if (filterDropdownOpen) setFilterDropdownOpen(false);
              }}
            >
              <MaterialSymbol name="search" size={20} />
            </button>
          ) : null}
        </div>
      </div>

      {searchOpen ? (
        <div className="inbox-interakt-list-header__panel inbox-interakt-list-header__panel--search">
          <input
            ref={searchInputRef}
            type="search"
            className="inbox-interakt-list-header__search-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('inbox.searchPlaceholder')}
            aria-label={t('inbox.searchPlaceholder')}
          />
        </div>
      ) : null}

      {staffPickerOpen ? (
        <div className="inbox-interakt-list-header__panel inbox-interakt-list-header__panel--staff">
          <p className="inbox-interakt-filter-panel__label">{t('inbox.interakt.pickMyStaff')}</p>
          <div className="inbox-interakt-filter-panel__chips">
            {staff.map(member => (
              <button
                key={member.id}
                type="button"
                className="inbox-interakt-filter-panel__chip"
                onClick={() => handleStaffPick(member.id)}
              >
                {member.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inbox-interakt-filter-panel__cancel"
            onClick={() => setStaffPickerOpen(false)}
          >
            {t('common.cancel')}
          </button>
        </div>
      ) : null}

      <div className="inbox-interakt-filter-bar">
        <InboxInteraktSwipeFilters
          conversations={conversations}
          searchQuery={searchQuery}
          activeFilter={activeFilter}
          hideGroups={hideGroups}
          myStaffId={myStaffId}
          queueCounts={queueCounts}
          preferClientQueueCounts={preferClientQueueCounts}
          onSelectStatus={setActiveFilter}
          onHideGroupsChange={setHideGroups}
          onGroupsOnly={() => {
            setActiveFilter('groups');
            setHideGroups(false);
          }}
          onNeedStaffPick={() => setStaffPickerOpen(true)}
        />
        <button
          ref={filterTriggerRef}
          type="button"
          className={`inbox-interakt-filter-bar__more${
            filterDropdownOpen ? ' is-open' : ''
          }${chipActive ? ' is-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={filterDropdownOpen}
          aria-label={t('inbox.interakt.filterMore')}
          title={chipLabel}
          onClick={() => {
            setFilterDropdownOpen(v => !v);
            if (searchOpen) setSearchOpen(false);
          }}
        >
          <MaterialSymbol name="tune" size={18} />
          {chipActive ? <span className="inbox-interakt-filter-bar__more-dot" aria-hidden /> : null}
        </button>
      </div>

      {filterMenu ? createPortal(filterMenu, document.body) : null}
    </div>
  );
}
