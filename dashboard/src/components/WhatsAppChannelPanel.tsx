import type { ReactNode } from 'react';
import { Sessions } from '../pages/Sessions';
import type { ChannelsMobilePane } from '../hooks/useChannelsLayout';
import type { ChannelsGridExtrasRender } from './channels/channels-grid-types';
import type { ChannelsGridFilter } from './channels/channel-grid-utils';

type WhatsAppChannelPanelProps = {
  hideCreateActions?: boolean;
  onAddChannelClick?: () => void;
  appendGridCards?: ReactNode | ChannelsGridExtrasRender;
  onSessionSelect?: (sessionId: string | null) => void;
  focusSessionId?: string | null;
  selectedSessionId?: string | null;
  autoOpenSessionQr?: boolean;
  splitDetailPane?: boolean;
  externalDetailPane?: ReactNode;
  isMobile?: boolean;
  mobilePane?: ChannelsMobilePane;
  onMobileShowDetail?: () => void;
  onMobileBack?: () => void;
  getExtraGridCount?: (filter: ChannelsGridFilter) => number;
  initialStatusFilter?: string;
  initialSearchQuery?: string;
  onWorkspaceFiltersChange?: (filters: { statusFilter: string; searchQuery: string }) => void;
  onAutoReconnectHandled?: () => void;
};

/** WhatsApp account management — reuses Sessions in workspace-embedded mode. */
export function WhatsAppChannelPanel({
  hideCreateActions = false,
  onAddChannelClick,
  appendGridCards,
  onSessionSelect,
  focusSessionId,
  selectedSessionId,
  autoOpenSessionQr,
  splitDetailPane = false,
  externalDetailPane,
  isMobile = false,
  mobilePane = 'list',
  onMobileShowDetail,
  onMobileBack,
  getExtraGridCount,
  initialStatusFilter,
  initialSearchQuery,
  onWorkspaceFiltersChange,
  onAutoReconnectHandled,
}: WhatsAppChannelPanelProps) {
  return (
    <Sessions
      embedded
      embedContext="workspace"
      compactSettingsEmbed
      hideCreateActions={hideCreateActions}
      onAddChannelClick={onAddChannelClick}
      appendGridCards={appendGridCards}
      onSessionSelect={onSessionSelect}
      focusSessionId={focusSessionId}
      selectedSessionId={selectedSessionId}
      autoOpenSessionQr={autoOpenSessionQr}
      splitDetailPane={splitDetailPane}
      externalDetailPane={externalDetailPane}
      isMobile={isMobile}
      mobilePane={mobilePane}
      onMobileShowDetail={onMobileShowDetail}
      onMobileBack={onMobileBack}
      getExtraGridCount={getExtraGridCount}
      initialStatusFilter={initialStatusFilter}
      initialSearchQuery={initialSearchQuery}
      onWorkspaceFiltersChange={onWorkspaceFiltersChange}
      onAutoReconnectHandled={onAutoReconnectHandled}
    />
  );
}
