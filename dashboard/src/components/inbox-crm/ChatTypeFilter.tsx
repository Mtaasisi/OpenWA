import { useTranslation } from 'react-i18next';
import {
  CONVERSATION_TYPE_FILTERS,
  getConversationTypeLabel,
  type ConversationTypeFilter,
} from '../../lib/conversation-types';
import './inbox-crm.css';

type Props = {
  active: ConversationTypeFilter;
  onChange: (filter: ConversationTypeFilter) => void;
  /** Match Interakt or tactical inbox main filter chip row */
  variant?: 'default' | 'interakt' | 'tactical';
};

export function ChatTypeFilter({ active, onChange, variant = 'default' }: Props) {
  const { t } = useTranslation();
  const isInterakt = variant === 'interakt';
  const isTactical = variant === 'tactical';

  return (
    <div
      className={[
        'inbox-chat-type-filter',
        isInterakt ? 'inbox-chat-type-filter--interakt' : '',
        isTactical ? 'inbox-chat-type-filter--tactical' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="group"
      aria-label={t('inbox.chatType.filterLabel')}
    >
      {CONVERSATION_TYPE_FILTERS.map(filter => (
        <button
          key={filter}
          type="button"
          className={[
            isInterakt
              ? 'inbox-interakt-chip inbox-interakt-chip--type'
              : isTactical
                ? 'tac-type-chip'
                : 'inbox-chat-type-filter__chip',
            active === filter
              ? isInterakt
                ? ' is-active'
                : isTactical
                  ? ' active'
                  : ' inbox-chat-type-filter__chip--active'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(filter)}
        >
          {filter === 'all' ? t('inbox.chatType.all') : getConversationTypeLabel(filter, t)}
        </button>
      ))}
    </div>
  );
}
