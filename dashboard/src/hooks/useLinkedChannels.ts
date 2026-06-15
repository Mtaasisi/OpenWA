import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSessionsQuery } from './queries';
import { smsApi } from '../services/api';
import {
  getLinkedChannelIds,
  getLinkedChannels,
  hasLinkedSocialChannel,
  shouldShowChannelBadge,
  shouldShowChannelPicker,
  type ChannelId,
  type ChannelLinkState,
  type SmsChannelStatus,
} from '../lib/channels';

export function useSmsStatus() {
  return useQuery({
    queryKey: ['sms', 'status'],
    queryFn: () => smsApi.getStatus(),
    staleTime: 30_000,
  });
}

export function useLinkedChannels() {
  const { data: sessions = [], isLoading: sessionsLoading } = useSessionsQuery();
  const { data: smsStatus, isLoading: smsLoading } = useSmsStatus();

  const state: ChannelLinkState = useMemo(
    () => ({
      whatsappSessionCount: sessions.length,
      smsConnected: smsStatus?.connected ?? false,
      smsStatus: (smsStatus?.status as SmsChannelStatus | undefined) ?? 'not_connected',
    }),
    [sessions.length, smsStatus?.connected, smsStatus?.status],
  );

  const linkedIds = useMemo(() => getLinkedChannelIds(state), [state]);
  const linkedChannels = useMemo(() => getLinkedChannels(state), [state]);
  const linkedCount = linkedIds.length;

  return {
    isLoading: sessionsLoading || smsLoading,
    sessions,
    state,
    linkedIds,
    linkedChannels,
    linkedCount,
    showChannelPicker: shouldShowChannelPicker(linkedCount),
    showChannelBadge: shouldShowChannelBadge(linkedCount),
    hasWhatsApp: linkedIds.includes('whatsapp'),
    hasSms: linkedIds.includes('sms'),
    isSmsReady: smsStatus?.connected ?? false,
    smsStatus: state.smsStatus ?? 'not_connected',
    hasSocialChannels: hasLinkedSocialChannel(state),
    isWhatsAppSetupNeeded: sessions.length === 0,
    isChannelLinked: (channelId: ChannelId) => linkedIds.includes(channelId),
  };
}
