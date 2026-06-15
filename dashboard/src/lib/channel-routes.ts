import type { ChannelId } from './channels';

export type ChannelsUrlOptions = {
  channel?: ChannelId;
  /** Open the add-channel popup on arrival */
  add?: boolean;
  sessionFocus?: string;
  /** Scroll to session and open QR / reconnect flow */
  reconnect?: boolean;
};

/** Build `/channels` URL with optional query params for focus + add popup. */
export function channelsUrl(options: ChannelsUrlOptions = {}): string {
  const params = new URLSearchParams();
  if (options.channel) params.set('channel', options.channel);
  if (options.add) params.set('add', '1');
  if (options.sessionFocus) params.set('focus', options.sessionFocus);
  if (options.reconnect) params.set('reconnect', '1');
  const query = params.toString();
  return query ? `/channels?${query}` : '/channels';
}
