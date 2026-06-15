import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation, InboxQueueCounts, InboxSavedViewRow } from '../services/api';
import type { ChannelId } from '../lib/channels';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import { LEAD_SOURCES, leadSourceLabel } from '../lib/lead-sources';
import { loadUserPreferences } from '../lib/user-preferences';
import type { ConversationFilter, InboxConversationSort } from '../pages/inbox-helpers';
import { getInboxFilterLabel } from '../pages/inbox-features';
import { resolveInboxFilterBadgeCount } from '../lib/inbox-queue-counts';
import {
  getInboxFilterIconTone,
  INBOX_FILTER_ICONS,
  INBOX_INTERAKT_MENU_STATUS_FILTERS,
} from '../pages/inbox-filter-ui';
import { MaterialSymbol } from './MaterialSymbol';

type ChatTypeMode = 'people' | 'all' | 'groups';

type Props = {
  menuRef: RefObject<HTMLDivElement | null>;
  style: { top: number; left: number; minWidth: number };
  conversations: Conversation[];
  searchQuery: string;
  activeFilter: ConversationFilter;
  hideGroups: boolean;
  leadSourceFilter: string;
  conversationSort: InboxConversationSort;
  channelFilter: ChannelId | 'all';
  onSelectStatus: (filter: ConversationFilter) => void;
  onHideGroupsChange: (value: boolean) => void;
  onGroupsOnlyChange: (value: boolean) => void;
  onLeadSourceChange: (value: string) => void;
  onSortChange: (sort: InboxConversationSort) => void;
  onChannelChange: (channel: ChannelId | 'all') => void;
  onClose: () => void;
  onNeedStaffPick: () => void;
  filteredUnreadCount: number;
  filtersActive: boolean;
  canMarkAllRead: boolean;
  onMarkAllRead: () => void;
  onResetFilters: () => void;
  queueCounts?: InboxQueueCounts | null;
  preferClientQueueCounts?: boolean;
  savedViews?: InboxSavedViewRow[];
  onApplySavedView?: (view: InboxSavedViewRow) => void;
  onSaveCurrentView?: () => void;
  onDeleteSavedView?: (id: string) => void;
  canSaveView?: boolean;
};

export function InboxInteraktFilterMenu({
  menuRef,
  style,
  conversations,
  searchQuery,
  activeFilter,
  hideGroups,
  leadSourceFilter,
  conversationSort,
  channelFilter,
  onSelectStatus,
  onHideGroupsChange,
  onGroupsOnlyChange,
  onLeadSourceChange,
  onSortChange,
  onChannelChange,
  onClose,
  onNeedStaffPick,
  filteredUnreadCount,
  filtersActive,
  canMarkAllRead,
  onMarkAllRead,
  onResetFilters,
  queueCounts,
  preferClientQueueCounts,
  savedViews = [],
  onApplySavedView,
  onSaveCurrentView,
  onDeleteSavedView,
  canSaveView = false,
}: Props) {
  const { t } = useTranslation();
  const { linkedChannels, showChannelPicker } = useLinkedChannels();
  const myStaffId = loadUserPreferences().inboxMyStaffId;
  const filterOptions = { myStaffId, queueCounts, preferClientQueueCounts };
  const groupsOnly = activeFilter === 'groups';
  const chatTypeMode: ChatTypeMode = groupsOnly ? 'groups' : hideGroups ? 'people' : 'all';

  const pickStatus = (key: ConversationFilter) => {
    if (key === 'assigned_to_me' && !myStaffId) {
      onNeedStaffPick();
      onClose();
      return;
    }
    onSelectStatus(key);
    onClose();
  };

  const setChatTypeMode = (mode: ChatTypeMode) => {
    if (mode === 'groups') {
      onGroupsOnlyChange(true);
      return;
    }
    onGroupsOnlyChange(false);
    onHideGroupsChange(mode === 'people');
  };

  const chatTypeOptions: { mode: ChatTypeMode; label: string; icon: string }[] = [
    { mode: 'people', label: t('inbox.interakt.filterChipPeople'), icon: 'person' },
    { mode: 'all', label: t('inbox.interakt.filterChipAll'), icon: 'forum' },
    { mode: 'groups', label: t('inbox.filter.groups'), icon: 'groups' },
  ];

  const showActions = (canMarkAllRead && filteredUnreadCount > 0) || filtersActive;

  return (
    <div
      ref={menuRef}
      className="inbox-interakt-filter-dropdown__menu inbox-interakt-filter-dropdown__menu--portal inbox-interakt-filter-menu"
      style={style}
      role="dialog"
      aria-label={t('inbox.interakt.filterDropdown')}
    >
      <div className="inbox-interakt-filter-menu__header">
        <MaterialSymbol name="tune" size={18} className="inbox-interakt-filter-menu__header-icon" />
        <span className="inbox-interakt-filter-menu__header-title">{t('inbox.interakt.filterDropdown')}</span>
      </div>

      <div className="inbox-interakt-filter-menu__scroll">
        <section className="inbox-interakt-filter-menu__section">
          <h3 className="inbox-interakt-filter-menu__section-label">{t('inbox.interakt.filterSectionStatus')}</h3>
          <div className="inbox-interakt-filter-menu__status-list" role="listbox" aria-label={t('inbox.interakt.filterSectionStatus')}>
            {INBOX_INTERAKT_MENU_STATUS_FILTERS.map(key => {
              const count = resolveInboxFilterBadgeCount(key, conversations, searchQuery, filterOptions);
              const selected = activeFilter === key && !groupsOnly;
              const icon = INBOX_FILTER_ICONS[key] ?? 'filter_list';
              const tone = getInboxFilterIconTone(key);
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`inbox-interakt-filter-menu__status${selected ? ' is-active' : ''}`}
                  onClick={() => pickStatus(key)}
                >
                  <span className={`inbox-interakt-filter-menu__status-icon inbox-interakt-filter-menu__status-icon--${tone}`}>
                    <MaterialSymbol name={icon} size={18} />
                  </span>
                  <span className="inbox-interakt-filter-menu__status-label">{getInboxFilterLabel(key, t)}</span>
                  <span className="inbox-interakt-filter-menu__status-meta">
                    {count > 0 ? (
                      <span className="inbox-interakt-filter-menu__status-count">{count}</span>
                    ) : null}
                    {selected ? (
                      <MaterialSymbol name="check" size={18} className="inbox-interakt-filter-menu__status-check" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {(savedViews.length > 0 || canSaveView) ? (
          <section className="inbox-interakt-filter-menu__section" data-testid="inbox-saved-views-section">
            <h3 className="inbox-interakt-filter-menu__section-label">
              {t('inbox.savedViews.title', { defaultValue: 'Saved views' })}
            </h3>
            {savedViews.length > 0 ? (
              <div className="inbox-interakt-filter-menu__status-list" role="listbox" aria-label={t('inbox.savedViews.title', { defaultValue: 'Saved views' })}>
                {savedViews.map(view => (
                  <div key={view.id} className="inbox-interakt-filter-menu__saved-row">
                    <button
                      type="button"
                      className="inbox-interakt-filter-menu__status inbox-interakt-filter-menu__saved-btn"
                      data-testid={`inbox-saved-view-${view.id}`}
                      onClick={() => {
                        onApplySavedView?.(view);
                        onClose();
                      }}
                    >
                      <span className="inbox-interakt-filter-menu__status-icon inbox-interakt-filter-menu__status-icon--primary">
                        <MaterialSymbol name="bookmark" size={18} />
                      </span>
                      <span className="inbox-interakt-filter-menu__status-label">{view.name}</span>
                    </button>
                    {onDeleteSavedView ? (
                      <button
                        type="button"
                        className="inbox-interakt-filter-menu__saved-delete"
                        aria-label={t('inbox.savedViews.delete', { defaultValue: 'Remove saved view' })}
                        onClick={() => onDeleteSavedView(view.id)}
                      >
                        <MaterialSymbol name="close" size={16} />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            {canSaveView && onSaveCurrentView ? (
              <button
                type="button"
                className="inbox-interakt-filter-menu__footer-btn inbox-interakt-filter-menu__footer-btn--ghost inbox-interakt-filter-menu__save-view"
                data-testid="inbox-save-current-view"
                onClick={() => {
                  onSaveCurrentView();
                  onClose();
                }}
              >
                <MaterialSymbol name="bookmark_add" size={18} />
                <span>{t('inbox.savedViews.saveCurrent', { defaultValue: 'Save current filters' })}</span>
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="inbox-interakt-filter-menu__section">
          <h3 className="inbox-interakt-filter-menu__section-label">{t('inbox.interakt.filterSectionChatType')}</h3>
          <div className="inbox-interakt-filter-menu__segment" role="group" aria-label={t('inbox.interakt.filterSectionChatType')}>
            {chatTypeOptions.map(opt => (
              <button
                key={opt.mode}
                type="button"
                className={`inbox-interakt-filter-menu__segment-btn${chatTypeMode === opt.mode ? ' is-active' : ''}`}
                aria-pressed={chatTypeMode === opt.mode}
                onClick={() => setChatTypeMode(opt.mode)}
              >
                <MaterialSymbol name={opt.icon} size={16} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="inbox-interakt-filter-menu__section inbox-interakt-filter-menu__section--options">
          <h3 className="inbox-interakt-filter-menu__section-label">{t('inbox.interakt.filterSectionOptions')}</h3>

          <div className="inbox-interakt-filter-menu__option-block">
            <span className="inbox-interakt-filter-menu__option-label">{t('inbox.interakt.sortLabel')}</span>
            <div className="inbox-interakt-filter-menu__segment inbox-interakt-filter-menu__segment--compact" role="group">
              {(['newest', 'oldest'] as const).map(sort => (
                <button
                  key={sort}
                  type="button"
                  className={`inbox-interakt-filter-menu__segment-btn${conversationSort === sort ? ' is-active' : ''}`}
                  aria-pressed={conversationSort === sort}
                  onClick={() => onSortChange(sort)}
                >
                  <MaterialSymbol name={sort === 'newest' ? 'south' : 'north'} size={16} />
                  <span>{sort === 'newest' ? t('inbox.interakt.listNewest') : t('inbox.interakt.listOldest')}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="inbox-interakt-filter-menu__select-field">
            <span className="inbox-interakt-filter-menu__option-label">{t('leadSources.inboxFilter')}</span>
            <span className="inbox-interakt-filter-menu__select-wrap">
              <select value={leadSourceFilter} onChange={e => onLeadSourceChange(e.target.value)}>
                <option value="">{t('pipeline.allSources')}</option>
                {LEAD_SOURCES.map(src => (
                  <option key={src} value={src}>
                    {leadSourceLabel(src, t)}
                  </option>
                ))}
              </select>
              <MaterialSymbol name="expand_more" size={18} className="inbox-interakt-filter-menu__select-chevron" />
            </span>
          </label>

          {showChannelPicker ? (
            <label className="inbox-interakt-filter-menu__select-field">
              <span className="inbox-interakt-filter-menu__option-label">{t('inbox.channelFilter')}</span>
              <span className="inbox-interakt-filter-menu__select-wrap">
                <select
                  value={channelFilter}
                  onChange={e => onChannelChange(e.target.value as ChannelId | 'all')}
                >
                  <option value="all">{t('inbox.allChannels')}</option>
                  {linkedChannels.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      {t(ch.labelKey)}
                    </option>
                  ))}
                </select>
                <MaterialSymbol name="expand_more" size={18} className="inbox-interakt-filter-menu__select-chevron" />
              </span>
            </label>
          ) : null}
        </section>
      </div>

      {showActions ? (
        <footer className="inbox-interakt-filter-menu__footer">
          {canMarkAllRead && filteredUnreadCount > 0 ? (
            <button
              type="button"
              className="inbox-interakt-filter-menu__footer-btn inbox-interakt-filter-menu__footer-btn--primary"
              onClick={() => {
                onMarkAllRead();
                onClose();
              }}
            >
              <MaterialSymbol name="done_all" size={18} />
              <span>{t('inbox.interakt.markAllRead', { count: filteredUnreadCount })}</span>
            </button>
          ) : null}
          {filtersActive ? (
            <button
              type="button"
              className="inbox-interakt-filter-menu__footer-btn inbox-interakt-filter-menu__footer-btn--ghost"
              onClick={() => {
                onResetFilters();
                onClose();
              }}
            >
              <MaterialSymbol name="restart_alt" size={18} />
              <span>{t('inbox.interakt.resetFilters')}</span>
            </button>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}
