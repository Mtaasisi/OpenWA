import { useMemo, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { queryKeys } from '../hooks/queries';
import { useChannelsLayout } from '../hooks/useChannelsLayout';
import { useSmsStatus } from '../hooks/useLinkedChannels';
import { useRole } from '../hooks/useRole';
import { WhatsAppChannelPanel } from '../components/WhatsAppChannelPanel';
import { SmsChannelPanel } from '../components/SmsChannelPanel';
import { AddChannelModal } from '../components/AddChannelModal';
import { ChannelSmsCard } from '../components/channels/ChannelSmsCard';
import { ChannelAddCard } from '../components/channels/ChannelAddCard';
import { ChannelsDetailShell } from '../components/channels/ChannelsDetailShell';
import { smsStatusBadgeVariant } from '../components/channels/channel-row-utils';
import {
  addChannelMatchesGridFilter,
  countGridExtras,
  smsMatchesGridFilter,
} from '../components/channels/channel-grid-utils';
import type { ChannelsGridFilter } from '../components/channels/channel-grid-utils';
import type { ChannelId } from '../lib/channels';
import './Channels.css';

type DetailView = 'whatsapp' | 'sms';

export function Channels() {
  const { t } = useTranslation();
  const { canWrite } = useRole();
  const queryClient = useQueryClient();
  const { isMobile, mobilePane, openDetail, openList } = useChannelsLayout();
  const [searchParams, setSearchParams] = useSearchParams();
  const focusChannel = searchParams.get('channel') as ChannelId | null;
  const shouldOpenAdd =
    searchParams.get('add') === '1' || searchParams.get('add') === 'channel';
  const focusSessionId = searchParams.get('focus');
  const shouldReconnect = searchParams.get('reconnect') === '1';
  const initialStatusFilter = searchParams.get('filter');
  const initialSearchQuery = searchParams.get('q') ?? '';

  const handleWorkspaceFiltersChange = useCallback(
    ({ statusFilter, searchQuery: q }: { statusFilter: string; searchQuery: string }) => {
      const next = new URLSearchParams(searchParams);
      if (statusFilter === 'all') next.delete('filter');
      else next.set('filter', statusFilter);
      if (!q.trim()) next.delete('q');
      else next.set('q', q.trim());
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const { data: smsStatusData } = useSmsStatus();
  const smsConfigured = smsStatusData?.configured ?? false;

  const [addOpen, setAddOpen] = useState(false);
  const [addInitialType, setAddInitialType] = useState<ChannelId | undefined>();
  const [detailView, setDetailView] = useState<DetailView>(
    focusChannel === 'sms' ? 'sms' : 'whatsapp',
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(focusSessionId);

  useDocumentTitle(t('channels.pageTitle'));

  useEffect(() => {
    if (focusChannel === 'sms') {
      setDetailView('sms');
      openDetail();
      if (!smsConfigured && canWrite) {
        setAddInitialType('sms');
        setAddOpen(true);
      }
    } else if (focusChannel === 'whatsapp') {
      setDetailView('whatsapp');
    }
  }, [focusChannel, smsConfigured, canWrite, openDetail]);

  useEffect(() => {
    if (focusSessionId) {
      setSelectedSessionId(focusSessionId);
      openDetail();
    }
  }, [focusSessionId, openDetail]);

  useEffect(() => {
    if (!shouldOpenAdd || !canWrite) return;
    const type =
      focusChannel === 'sms' || focusChannel === 'whatsapp' ? focusChannel : undefined;
    setAddInitialType(type);
    setAddOpen(true);
  }, [shouldOpenAdd, focusChannel, canWrite]);

  const clearAddParam = () => {
    if (!searchParams.get('add')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('add');
    setSearchParams(next, { replace: true });
  };

  const syncDetailInUrl = useCallback(
    (view: DetailView, sessionId: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (view === 'sms') {
        next.set('channel', 'sms');
        next.delete('focus');
        next.delete('reconnect');
      } else if (sessionId) {
        next.set('focus', sessionId);
        next.delete('channel');
        next.delete('reconnect');
      } else {
        next.delete('focus');
        next.delete('channel');
        next.delete('reconnect');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const openAddChannel = (type?: ChannelId) => {
    setAddInitialType(type);
    setAddOpen(true);
  };

  const clearReconnectParam = useCallback(() => {
    if (searchParams.get('reconnect') !== '1') return;
    const next = new URLSearchParams(searchParams);
    next.delete('reconnect');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const syncListViewInUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    next.delete('channel');
    next.delete('reconnect');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleMobileBack = useCallback(() => {
    openList();
    syncListViewInUrl();
  }, [openList, syncListViewInUrl]);

  const getExtraGridCount = useCallback(
    (filter: ChannelsGridFilter) =>
      countGridExtras(filter, {
        smsConfigured,
        sms: smsStatusData,
        canWrite,
        labels: {
          smsTitle: t('channels.smsSetupTitle'),
          addChannel: t('channels.addChannel'),
          smsProvider: t('channels.smsProvider'),
        },
      }),
    [canWrite, smsConfigured, smsStatusData, t],
  );

  const gridExtras = useMemo(
    () =>
      ({ searchQuery, statusFilter }: { searchQuery: string; statusFilter: string }) => {
        const filter = { searchQuery, statusFilter };
        const labels = {
          smsTitle: t('channels.smsSetupTitle'),
          addChannel: t('channels.addChannel'),
          smsProvider: t('channels.smsProvider'),
        };
        const showSms =
          smsConfigured &&
          smsStatusData &&
          smsMatchesGridFilter(smsStatusData, filter, labels);
        const showAdd = canWrite && addChannelMatchesGridFilter(filter, labels);

        return (
          <>
            {showSms ? (
              <ChannelSmsCard
                sms={smsStatusData}
                selected={detailView === 'sms'}
                onSelect={() => {
                  setDetailView('sms');
                  setSelectedSessionId(null);
                  openDetail();
                  syncDetailInUrl('sms', null);
                }}
              />
            ) : null}
            {showAdd ? <ChannelAddCard onClick={() => openAddChannel()} /> : null}
          </>
        );
      },
    [canWrite, detailView, openDetail, smsConfigured, smsStatusData, syncDetailInUrl, t],
  );

  const smsDetailPane = useMemo(() => {
    if (detailView !== 'sms' || !smsConfigured || !smsStatusData) return undefined;

    const hasError = Boolean(smsStatusData.lastError?.trim());
    const variant = smsStatusBadgeVariant(smsStatusData);
    const statusTone =
      variant === 'success' ? 'ok' : variant === 'error' ? 'error' : 'warn';

    return (
      <ChannelsDetailShell
        title={t('channels.smsSetupTitle')}
        subtitle={
          hasError
            ? smsStatusData.lastError?.trim() || undefined
            : smsStatusData.lastBalance != null
              ? `${t('channels.smsBalance')}: ${smsStatusData.lastBalance}`
              : t('channels.smsProvider')
        }
        statusLabel={t(`channels.smsStatus.${smsStatusData.status}`)}
        statusTone={statusTone}
        showBack={isMobile}
        onBack={handleMobileBack}
        onClose={
          !isMobile
            ? () => {
                setDetailView('whatsapp');
                syncDetailInUrl('whatsapp', selectedSessionId);
              }
            : undefined
        }
      >
        <SmsChannelPanel compact />
      </ChannelsDetailShell>
    );
  }, [detailView, handleMobileBack, isMobile, selectedSessionId, smsConfigured, smsStatusData, syncDetailInUrl, t]);

  const handleAddComplete = (addedType?: ChannelId) => {
    void queryClient.invalidateQueries({ queryKey: ['sms'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
    setDetailView(addedType === 'sms' ? 'sms' : 'whatsapp');
    openDetail();
  };

  return (
    <div className="cc-page">
      <WhatsAppChannelPanel
        splitDetailPane
        hideCreateActions
        onAddChannelClick={() => openAddChannel()}
        appendGridCards={gridExtras}
        externalDetailPane={smsDetailPane}
        isMobile={isMobile}
        mobilePane={mobilePane}
        onMobileShowDetail={openDetail}
        onMobileBack={handleMobileBack}
        selectedSessionId={detailView === 'whatsapp' ? selectedSessionId : null}
        onSessionSelect={sessionId => {
          if (sessionId) {
            setSelectedSessionId(sessionId);
            setDetailView('whatsapp');
            openDetail();
            syncDetailInUrl('whatsapp', sessionId);
          } else {
            setSelectedSessionId(null);
            syncDetailInUrl('whatsapp', null);
          }
        }}
        focusSessionId={focusSessionId}
        autoOpenSessionQr={shouldReconnect}
        getExtraGridCount={getExtraGridCount}
        initialStatusFilter={initialStatusFilter ?? undefined}
        initialSearchQuery={initialSearchQuery}
        onWorkspaceFiltersChange={handleWorkspaceFiltersChange}
        onAutoReconnectHandled={clearReconnectParam}
      />

      <AddChannelModal
        open={addOpen}
        initialType={addInitialType}
        onClose={() => {
          setAddOpen(false);
          setAddInitialType(undefined);
          clearAddParam();
        }}
        onComplete={addedType => {
          handleAddComplete(addedType ?? addInitialType);
          setAddInitialType(undefined);
        }}
      />
    </div>
  );
}
