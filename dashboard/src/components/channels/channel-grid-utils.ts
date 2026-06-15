import type { SmsStatusView } from '../../services/api';

export type ChannelsGridFilter = {
  searchQuery: string;
  statusFilter: string;
};

export type ChannelsGridFilterLabels = {
  smsTitle: string;
  addChannel: string;
  smsProvider: string;
};

function matchesSearch(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function smsMatchesStatusFilter(sms: SmsStatusView, statusFilter: string): boolean {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'connecting') return sms.status === 'testing';
  if (statusFilter === 'active') return sms.status === 'connected' && sms.connected;
  if (statusFilter === 'inactive') {
    return (
      sms.status === 'not_connected' ||
      sms.status === 'failed' ||
      sms.status === 'disabled' ||
      (!sms.connected && sms.status !== 'testing')
    );
  }
  return true;
}

export function smsMatchesGridFilter(
  sms: SmsStatusView,
  filter: ChannelsGridFilter,
  labels: ChannelsGridFilterLabels,
): boolean {
  if (!smsMatchesStatusFilter(sms, filter.statusFilter)) return false;
  const searchBlob = [labels.smsTitle, labels.smsProvider, 'sms', 'mobishastra', 'mobi'].join(' ');
  return matchesSearch(searchBlob, filter.searchQuery);
}

export function addChannelMatchesGridFilter(
  filter: ChannelsGridFilter,
  labels: ChannelsGridFilterLabels,
): boolean {
  const searchBlob = [labels.addChannel, 'add', 'channel', 'new'].join(' ');
  if (!matchesSearch(searchBlob, filter.searchQuery)) return false;
  return filter.statusFilter === 'all' || Boolean(filter.searchQuery.trim());
}

export function countGridExtras(
  filter: ChannelsGridFilter,
  options: {
    smsConfigured: boolean;
    sms?: SmsStatusView | null;
    canWrite: boolean;
    labels: ChannelsGridFilterLabels;
  },
): number {
  let count = 0;
  if (
    options.smsConfigured &&
    options.sms &&
    smsMatchesGridFilter(options.sms, filter, options.labels)
  ) {
    count += 1;
  }
  if (options.canWrite && addChannelMatchesGridFilter(filter, options.labels)) {
    count += 1;
  }
  return count;
}
