import { useTranslation } from 'react-i18next';
import { type ChannelId } from '../lib/channels';
import { useLinkedChannels } from '../hooks/useLinkedChannels';

type InboxChannelFilterProps = {
  activeChannel: ChannelId | 'all';
  onChange: (channel: ChannelId | 'all') => void;
};

export function InboxChannelFilter({ activeChannel, onChange }: InboxChannelFilterProps) {
  const { t } = useTranslation();
  const { linkedChannels, showChannelPicker } = useLinkedChannels();

  if (!showChannelPicker) return null;

  return (
    <div className="inbox-channel-filter" role="group" aria-label={t('inbox.channelFilter')}>
      <button
        type="button"
        className={`ws-filter-chip${activeChannel === 'all' ? ' ws-filter-chip--active' : ''}`}
        onClick={() => onChange('all')}
      >
        {t('inbox.allChannels')}
      </button>
      {linkedChannels.map(ch => (
        <button
          key={ch.id}
          type="button"
          className={`ws-filter-chip${activeChannel === ch.id ? ' ws-filter-chip--active' : ''}`}
          onClick={() => onChange(ch.id)}
        >
          {t(ch.labelKey)}
        </button>
      ))}
    </div>
  );
}
