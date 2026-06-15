import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MaterialSymbol } from './MaterialSymbol';
import type { Session, Conversation } from '../services/api';
import type { ConversationFilter, InboxConversationSort } from '../pages/inbox-helpers';
import { getInboxFilterBadgeCount } from '../pages/inbox-features';
import { shouldShowSessionLabel } from '../pages/inbox-helpers';

type StitchQuickTab = 'all' | 'groups' | 'unread';

type StitchMenuFilter = ConversationFilter | 'archived';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
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
  onContextMenu?: (event: React.MouseEvent) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  backgroundSyncing?: boolean;
}

const STITCH_MENU_ITEMS: { key: StitchMenuFilter; labelKey: string; icon: string }[] = [
  { key: 'all', labelKey: 'inbox.stitch.filterShowAll', icon: 'check' },
  { key: 'unread', labelKey: 'inbox.stitch.filterUnreadOnly', icon: 'mark_chat_unread' },
  { key: 'needs_reply', labelKey: 'inbox.stitch.filterFlagged', icon: 'flag' },
  { key: 'needs_human', labelKey: 'inbox.stitch.filterAwaiting', icon: 'hourglass_empty' },
  { key: 'resolved', labelKey: 'inbox.stitch.filterArchived', icon: 'archive' },
];

function activeQuickTab(
  filter: ConversationFilter,
  hideGroups: boolean,
): StitchQuickTab | null {
  if (filter === 'groups') return 'groups';
  if (filter === 'unread') return 'unread';
  if (filter === 'all' && !hideGroups) return 'all';
  return null;
}

export function InboxStitchListHeader({
  searchQuery,
  activeFilter,
  setActiveFilter,
  hideGroups,
  setHideGroups,
  conversations,
  onContextMenu,
  onRefresh,
  refreshing = false,
  backgroundSyncing = false,
}: Props) {
  const { t } = useTranslation();
  const headerRef = useRef<HTMLDivElement>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const groupsCount = getInboxFilterBadgeCount('groups', conversations, searchQuery);
  const unreadCount = getInboxFilterBadgeCount('unread', conversations, searchQuery);
  const quickTab = activeQuickTab(activeFilter, hideGroups);
  const menuFilterActive = quickTab === null;

  const selectQuickTab = (tab: StitchQuickTab) => {
    if (tab === 'all') {
      setActiveFilter('all');
      setHideGroups(false);
    } else if (tab === 'groups') {
      setActiveFilter('groups');
      setHideGroups(false);
    } else if (tab === 'unread') {
      setActiveFilter('unread');
    }
  };

  const selectMenuFilter = (key: StitchMenuFilter) => {
    if (key === 'all') {
      setActiveFilter('all');
      setHideGroups(false);
    } else {
      setActiveFilter(key === 'archived' ? 'resolved' : key);
    }
    setFilterOpen(false);
  };

  useEffect(() => {
    if (!filterOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterOpen]);

  const menuActiveKey: StitchMenuFilter =
    activeFilter === 'resolved' ? 'resolved' : activeFilter;

  return (
    <div className="inbox-stitch-list-header" ref={headerRef} onContextMenu={onContextMenu}>
      <div className="inbox-stitch-list-header__tabs">
        <button
          type="button"
          className={`inbox-stitch-list-header__tab${quickTab === 'all' ? ' is-active' : ''}`}
          onClick={() => selectQuickTab('all')}
        >
          <span className="inbox-stitch-list-header__tab-label">{t('inbox.stitch.tabAll')}</span>
        </button>
        <button
          type="button"
          className={`inbox-stitch-list-header__tab${quickTab === 'groups' ? ' is-active' : ''}`}
          onClick={() => selectQuickTab('groups')}
        >
          <span className="inbox-stitch-list-header__tab-label">
            {t('inbox.stitch.tabGroups')}
            {groupsCount > 0 ? (
              <span className="inbox-stitch-list-header__tab-count">&nbsp;{groupsCount}</span>
            ) : null}
          </span>
        </button>
        <button
          type="button"
          className={`inbox-stitch-list-header__tab${quickTab === 'unread' ? ' is-active' : ''}`}
          onClick={() => selectQuickTab('unread')}
        >
          <span className="inbox-stitch-list-header__tab-label">
            {t('inbox.stitch.tabUnread')}
            {unreadCount > 0 ? (
              <span className="inbox-stitch-list-header__tab-count">&nbsp;{unreadCount}</span>
            ) : null}
          </span>
        </button>
        <div className="inbox-stitch-list-header__filter-wrap">
          {onRefresh ? (
            <button
              type="button"
              className={[
                'inbox-stitch-list-header__icon-btn',
                'inbox-stitch-list-header__icon-btn--refresh',
                refreshing ? 'is-active' : '',
                backgroundSyncing && !refreshing ? 'is-syncing' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={onRefresh}
              disabled={refreshing}
              aria-busy={refreshing || backgroundSyncing}
              title={t('inbox.refreshHint')}
              aria-label={t('inbox.refresh')}
            >
              <MaterialSymbol name="refresh" size={20} spin={refreshing} />
            </button>
          ) : null}
          <button
            type="button"
            className={[
              'inbox-stitch-list-header__filter-btn',
              filterOpen ? 'is-open' : '',
              menuFilterActive ? 'is-filtered' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={t('inbox.stitch.manageFilters')}
            aria-label={t('inbox.stitch.manageFilters')}
            aria-expanded={filterOpen}
            onClick={() => {
              setFilterOpen(v => !v);
            }}
          >
            <MaterialSymbol name="filter_list" size={20} />
          </button>
          {filterOpen ? (
            <div className="inbox-stitch-filter-menu" role="menu">
              {STITCH_MENU_ITEMS.map((item, index) => (
                <span key={item.key}>
                  {index === STITCH_MENU_ITEMS.length - 1 ? (
                    <div className="inbox-stitch-filter-menu__divider" />
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    className={`inbox-stitch-filter-menu__item${
                      menuActiveKey === item.key ? ' is-active' : ''
                    }`}
                    onClick={() => selectMenuFilter(item.key)}
                  >
                    <span>{t(item.labelKey)}</span>
                    <MaterialSymbol
                      name={menuActiveKey === item.key ? 'check' : item.icon}
                      size={18}
                      className={menuActiveKey === item.key ? 'is-filled' : undefined}
                    />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export { shouldShowSessionLabel };
