import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getChannelDef, type ChannelId } from '../../lib/channels';
import { useLinkedChannels } from '../../hooks/useLinkedChannels';

export type ChannelType =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'telegram'
  | 'sms'
  | 'email'
  | 'website'
  | 'generic';

const CHANNEL_TYPE_TO_ID: Partial<Record<ChannelType, ChannelId>> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  telegram: 'telegram',
  sms: 'sms',
  email: 'email',
  website: 'live_chat',
};

const STATIC_LABELS: Record<ChannelType, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  facebook: 'Messenger',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  sms: 'SMS',
  email: 'Email',
  website: 'Live Chat',
  generic: 'Channel',
};

type ChannelBadgeProps = {
  channelId?: ChannelId;
  /** Static display mode (dashboard alerts) — skips linked-channel gate */
  channel?: ChannelType;
  label?: string;
  disabled?: boolean;
  className?: string;
  forceShow?: boolean;
};

export function ChannelBadge({
  channelId,
  channel,
  label,
  disabled,
  className = '',
  forceShow = false,
}: ChannelBadgeProps) {
  const { t } = useTranslation();
  const { isChannelLinked, showChannelBadge } = useLinkedChannels();

  if (channel && !channelId) {
    const mappedId = CHANNEL_TYPE_TO_ID[channel];
    const def = mappedId ? getChannelDef(mappedId) : null;
    const display = label ?? (def ? t(def.labelKey) : STATIC_LABELS[channel]);
    const color = def?.color ?? '#25d366';
    return (
      <span className={`ws-channel-badge ws-channel-badge--static ${className}`.trim()}>
        {channel === 'whatsapp' && <MessageCircle size={12} aria-hidden />}
        <span className="ws-channel-badge__dot" style={{ background: color }} />
        {display}
      </span>
    );
  }

  if (!channelId) return null;
  const def = getChannelDef(channelId);
  if (!def) return null;
  if (!forceShow && !isChannelLinked(channelId)) return null;
  if (!forceShow && !showChannelBadge) return null;

  const isDisabled = disabled ?? def.comingSoon;

  return (
    <span
      className={[
        'ws-channel-badge',
        isDisabled ? 'ws-channel-badge--disabled' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="ws-channel-badge__dot" style={{ background: def.color }} />
      {label ?? t(def.labelKey)}
    </span>
  );
}
