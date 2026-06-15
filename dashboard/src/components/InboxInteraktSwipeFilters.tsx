import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Conversation, InboxQueueCounts } from '../services/api';
import type { ConversationFilter } from '../pages/inbox-helpers';
import { getInboxFilterLabel } from '../pages/inbox-features';
import { resolveInboxFilterBadgeCount } from '../lib/inbox-queue-counts';
import {
  INBOX_INTERAKT_SWIPE_FILTERS,
  isInboxSwipeFilterActive,
  type InboxSwipeFilterKey,
} from '../pages/inbox-filter-ui';
import './InboxInteraktSwipeFilters.css';

type Props = {
  conversations: Conversation[];
  searchQuery: string;
  activeFilter: ConversationFilter;
  hideGroups: boolean;
  myStaffId?: string | null;
  queueCounts?: InboxQueueCounts | null;
  preferClientQueueCounts?: boolean;
  onSelectStatus: (filter: ConversationFilter) => void;
  onHideGroupsChange: (value: boolean) => void;
  onGroupsOnly: () => void;
  onNeedStaffPick: () => void;
};

function swipeFilterLabel(key: InboxSwipeFilterKey, t: ReturnType<typeof useTranslation>['t']): string {
  if (key === 'people') return t('inbox.interakt.filterChipPeople');
  return getInboxFilterLabel(key, t);
}

function swipeFilterCount(
  key: InboxSwipeFilterKey,
  conversations: Conversation[],
  searchQuery: string,
  options: {
    myStaffId?: string | null;
    queueCounts?: InboxQueueCounts | null;
    preferClientQueueCounts?: boolean;
  },
): number {
  if (key === 'people') {
    return resolveInboxFilterBadgeCount('private', conversations, searchQuery, options);
  }
  return resolveInboxFilterBadgeCount(key, conversations, searchQuery, options);
}

export function InboxInteraktSwipeFilters({
  conversations,
  searchQuery,
  activeFilter,
  hideGroups,
  myStaffId,
  queueCounts,
  preferClientQueueCounts,
  onSelectStatus,
  onHideGroupsChange,
  onGroupsOnly,
  onNeedStaffPick,
}: Props) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<InboxSwipeFilterKey, HTMLButtonElement>());

  const filterOptions = useMemo(
    () => ({ myStaffId, queueCounts, preferClientQueueCounts }),
    [myStaffId, queueCounts, preferClientQueueCounts],
  );

  useEffect(() => {
    const scrollKey: InboxSwipeFilterKey = activeFilter === 'groups' ? 'groups' : activeFilter;
    chipRefs.current.get(scrollKey)?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeFilter]);

  const pick = (key: InboxSwipeFilterKey) => {
    if (key === 'people') {
      onHideGroupsChange(true);
      if (activeFilter === 'groups') onSelectStatus('needs_reply');
      return;
    }
    if (key === 'groups') {
      onGroupsOnly();
      return;
    }
    if (key === 'assigned_to_me' && !myStaffId) {
      onNeedStaffPick();
      return;
    }
    if (key === 'all') {
      onHideGroupsChange(false);
    }
    if (key === 'unread') {
      onHideGroupsChange(true);
    }
    onSelectStatus(key);
  };

  return (
    <div className="inbox-interakt-filter-bar__track">
      <div
        ref={scrollRef}
        className="inbox-interakt-filter-chips inbox-interakt-filter-chips--swipe"
        role="tablist"
        aria-label={t('inbox.interakt.swipeFilters')}
      >
        {INBOX_INTERAKT_SWIPE_FILTERS.map(key => {
          const selected = isInboxSwipeFilterActive(key, activeFilter, hideGroups);
          const count = swipeFilterCount(key, conversations, searchQuery, filterOptions);
          return (
            <button
              key={key}
              ref={node => {
                if (node) chipRefs.current.set(key, node);
                else chipRefs.current.delete(key);
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`inbox-interakt-filter-chip--swipe${selected ? ' is-active' : ''}`}
              onClick={() => pick(key)}
            >
              <span className="inbox-interakt-filter-chip--swipe__label">{swipeFilterLabel(key, t)}</span>
              {count > 0 ? (
                <span className="inbox-interakt-filter-chip--swipe__count">{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
