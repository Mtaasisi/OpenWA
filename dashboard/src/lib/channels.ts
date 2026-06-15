export type ChannelId =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'sms'
  | 'email'
  | 'live_chat'
  | 'telegram';

export type SmsChannelStatus =
  | 'not_connected'
  | 'testing'
  | 'connected'
  | 'low_balance'
  | 'failed'
  | 'disabled';

export type ChannelAction =
  | 'text'
  | 'image'
  | 'document'
  | 'product'
  | 'quote'
  | 'template'
  | 'location'
  | 'voice'
  | 'payment_info'
  | 'follow_up';

export type ChannelDef = {
  id: ChannelId;
  labelKey: string;
  color: string;
  active: boolean;
  comingSoon: boolean;
  supportedActions: ChannelAction[];
};

const WHATSAPP_ACTIONS: ChannelAction[] = [
  'text',
  'image',
  'document',
  'product',
  'quote',
  'template',
  'location',
  'voice',
  'payment_info',
  'follow_up',
];

export const CHANNELS: ChannelDef[] = [
  {
    id: 'whatsapp',
    labelKey: 'channels.whatsapp',
    color: '#25d366',
    active: true,
    comingSoon: false,
    supportedActions: WHATSAPP_ACTIONS,
  },
  {
    id: 'instagram',
    labelKey: 'channels.instagram',
    color: '#e4405f',
    active: false,
    comingSoon: true,
    supportedActions: [],
  },
  {
    id: 'facebook',
    labelKey: 'channels.facebook',
    color: '#1877f2',
    active: false,
    comingSoon: true,
    supportedActions: [],
  },
  {
    id: 'tiktok',
    labelKey: 'channels.tiktok',
    color: '#010101',
    active: false,
    comingSoon: true,
    supportedActions: [],
  },
  {
    id: 'sms',
    labelKey: 'channels.sms',
    color: '#6366f1',
    active: true,
    comingSoon: false,
    supportedActions: ['text', 'follow_up'],
  },
  {
    id: 'email',
    labelKey: 'channels.email',
    color: '#0ea5e9',
    active: false,
    comingSoon: true,
    supportedActions: [],
  },
  {
    id: 'live_chat',
    labelKey: 'channels.liveChat',
    color: '#8b5cf6',
    active: false,
    comingSoon: true,
    supportedActions: [],
  },
  {
    id: 'telegram',
    labelKey: 'channels.telegram',
    color: '#229ed9',
    active: false,
    comingSoon: true,
    supportedActions: [],
  },
];

export function getChannelDef(channelId: ChannelId): ChannelDef | undefined {
  return CHANNELS.find(c => c.id === channelId);
}

export function channelSupportsAction(channelId: ChannelId, action: ChannelAction): boolean {
  const def = getChannelDef(channelId);
  return def?.supportedActions.includes(action) ?? false;
}

export function getActiveChannels(): ChannelDef[] {
  return CHANNELS.filter(c => c.active);
}

export function getComingSoonChannels(): ChannelDef[] {
  return CHANNELS.filter(c => c.comingSoon);
}

/** Runtime state used to decide which channels the workspace has linked. */
export type ChannelLinkState = {
  whatsappSessionCount: number;
  smsConnected: boolean;
  smsStatus?: SmsChannelStatus;
};

const CHANNEL_LINK_CHECKS: Record<ChannelId, (state: ChannelLinkState) => boolean> = {
  whatsapp: state => state.whatsappSessionCount > 0,
  instagram: () => false,
  facebook: () => false,
  tiktok: () => false,
  sms: state => state.smsConnected,
  email: () => false,
  live_chat: () => false,
  telegram: () => false,
};

/** Publishing / social channels — Content & Campaigns nav hidden until one is linked. */
export const SOCIAL_PUBLISHING_CHANNEL_IDS: ChannelId[] = [
  'instagram',
  'facebook',
  'tiktok',
];

export function getLinkedChannelIds(state: ChannelLinkState): ChannelId[] {
  return CHANNELS.filter(ch => CHANNEL_LINK_CHECKS[ch.id](state)).map(ch => ch.id);
}

export function getLinkedChannels(state: ChannelLinkState): ChannelDef[] {
  const ids = new Set(getLinkedChannelIds(state));
  return CHANNELS.filter(c => ids.has(c.id));
}

export function isChannelLinked(channelId: ChannelId, state: ChannelLinkState): boolean {
  return getLinkedChannelIds(state).includes(channelId);
}

export function hasLinkedSocialChannel(state: ChannelLinkState): boolean {
  return getLinkedChannelIds(state).some(id => SOCIAL_PUBLISHING_CHANNEL_IDS.includes(id));
}

/** Channel picker / filter — only when multiple channels are linked. */
export function shouldShowChannelPicker(linkedCount: number): boolean {
  return linkedCount > 1;
}

/** Inline channel badges — only when multiple channels are linked. */
export function shouldShowChannelBadge(linkedCount: number): boolean {
  return linkedCount > 1;
}
