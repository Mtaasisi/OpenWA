import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import {
  followupApi,
  messageApi,
  quoteApi,
  type FollowUpQueueFilter,
  type FollowupQueueItemView,
  type PipelineCard,
} from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { AskAiLink } from '../components/AskAiLink';
import { PipelineLeadDetail } from '../components/PipelineLeadDetail';
import { useSessionsQuery } from '../hooks/queries';
import { useLinkedChannels } from '../hooks/useLinkedChannels';
import { useToast } from '../components/Toast';
import { ModalOverlay } from '../components/ModalOverlay';
import { downloadFollowupsCsv } from '../lib/followups-csv';
import {
  FollowupMetricBento,
  FollowupViewChips,
  FollowupFilterBar,
  FollowupQueueTable,
  FollowupDetailDrawer,
  FollowupOutcomeModal,
  FollowupNewTaskModal,
  FollowupScheduleModal,
  chipToFilter,
  sortQueueItems,
  isAutopilotChip,
  isFollowupViewChip,
  type FollowupMetrics,
  type FollowupSortKey,
  type FollowupViewChip,
} from '../components/followups';
import { WorkspacePageHeader } from '../components/workspace';
import { LostDemandFollowupsPanel } from '../components/LostDemandFollowupsPanel';
import { FollowupsStitchWorkspace } from '../components/followups/FollowupsStitchWorkspace';
import { useTheme } from '../hooks/useTheme';
import { useShellInboxSearchPublisher } from '../lib/shell-inbox-search-context';
import './Followups.css';

const LOST_REASONS = [
  'price_too_high',
  'stopped_replying',
  'bought_elsewhere',
  'followup_failed',
  'staff_failed_followup',
  'other',
] as const;

function getCurrentKeyId(): string | null {
  return sessionStorage.getItem('openwa_key_id');
}

export function Followups() {
  const { t } = useTranslation();
  useDocumentTitle(t('followups.dashboardTitle'));
  const { activeTheme } = useTheme();
  const isStitch = activeTheme.effects === 'stitch';
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { canWrite } = useRole();
  const toast = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationParam = searchParams.get('conversation');
  const taskParam = searchParams.get('task');
  const viewParam = searchParams.get('view');
  const missedTaskRef = useRef<string | null>(null);

  const [viewChip, setViewChip] = useState<FollowupViewChip>('my');
  const [filter, setFilter] = useState<FollowUpQueueFilter>('due_now');
  const [sortKey, setSortKey] = useState<FollowupSortKey>('priority');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [channelFilter, setChannelFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const [selectedItem, setSelectedItem] = useState<FollowupQueueItemView | null>(null);

  const selectFollowup = useCallback(
    (item: FollowupQueueItemView | null) => {
      setSelectedItem(item);
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (item?.id) next.set('task', item.id);
          else next.delete('task');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [outcomeModal, setOutcomeModal] = useState<FollowupQueueItemView | null>(null);
  const [outcome, setOutcome] = useState('still_thinking');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'snooze' | 'autopilot'>('snooze');
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignStaffId, setReassignStaffId] = useState('');
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReason, setLostReason] = useState<string>(LOST_REASONS[0]);
  const [sendChannel, setSendChannel] = useState<'whatsapp' | 'sms' | 'both'>('whatsapp');
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  const { data: sessions = [] } = useSessionsQuery();
  const { isSmsReady } = useLinkedChannels();

  const effectiveStaffId = useMemo(() => {
    if (staffFilter) return staffFilter;
    if (viewChip === 'my') return getCurrentKeyId() ?? undefined;
    return undefined;
  }, [staffFilter, viewChip]);

  const { data: counts = {} as Record<FollowUpQueueFilter, number> } = useQuery({
    queryKey: ['followups', 'queue', 'counts', effectiveStaffId],
    queryFn: () => followupApi.getQueueCounts(undefined, effectiveStaffId),
    refetchInterval: 60_000,
  });

  const { data: items = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['followups', 'queue', filter, effectiveStaffId],
    queryFn: () => followupApi.getQueue(filter, undefined, effectiveStaffId),
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['followups', 'reports'],
    queryFn: () => followupApi.getReports(),
    refetchInterval: 120_000,
  });

  const { data: staff = [] } = useQuery({
    queryKey: ['followups', 'staff'],
    queryFn: () => followupApi.listStaff(),
  });

  useEffect(() => {
    const stateFilter = (location.state as { filter?: FollowUpQueueFilter } | null)?.filter;
    if (stateFilter) {
      setFilter(stateFilter);
      if (stateFilter === 'overdue') setViewChip('overdue');
      else if (stateFilter === 'due_today') setViewChip('due_today');
      else if (isAutopilotChip(stateFilter as FollowupViewChip)) {
        setViewChip(stateFilter as FollowupViewChip);
      }
    }
  }, [location.state]);

  const sessionName = (sessionId: string) =>
    sessions.find(s => s.id === sessionId)?.name ?? sessionId.slice(0, 8);

  const metrics: FollowupMetrics = useMemo(() => {
    const doneToday = reports.reduce(
      (sum, r) => sum + r.followupsCompletedOnTime + r.followupsCompletedLate,
      0,
    );
    const converted = reports.reduce((sum, r) => sum + r.conversionsAfterFollowup, 0);
    const missed = reports.reduce((sum, r) => sum + r.followupsMissed, 0);
    return {
      due_today: counts.due_today ?? 0,
      overdue: counts.overdue ?? 0,
      payment_pending: counts.payment_pending ?? 0,
      hot_leads: counts.hot_leads ?? 0,
      done_today: doneToday,
      converted,
      missed,
    };
  }, [counts, reports]);

  const doneGoal = useMemo(() => {
    const due = reports.reduce((sum, r) => sum + r.followupsDue, 0);
    return due > 0 ? due : undefined;
  }, [reports]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(item => {
      if (channelFilter && item.source !== channelFilter) return false;
      if (sessionFilter && item.sessionId !== sessionFilter) return false;
      if (stageFilter && item.stage !== stageFilter) return false;
      if (!q) return true;
      const hay = [
        item.customerName,
        item.customerPhone,
        item.chatId,
        item.recommendedAction,
        item.productInterest,
        item.stage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [items, channelFilter, sessionFilter, stageFilter, search]);

  const sortedItems = useMemo(
    () => sortQueueItems(filteredItems, sortKey),
    [filteredItems, sortKey],
  );

  useEffect(() => {
    if (!taskParam || selectedItem?.id === taskParam) return;
    const found = items.find(i => i.id === taskParam);
    if (found) selectFollowup(found);
  }, [taskParam, items, selectedItem?.id, selectFollowup]);

  useEffect(() => {
    if (!taskParam || isLoading) return;
    if (items.some(i => i.id === taskParam)) {
      missedTaskRef.current = null;
      return;
    }
    if (missedTaskRef.current === taskParam) return;
    missedTaskRef.current = taskParam;
    toast.error(t('followups.stitch.taskNotFound'));
    selectFollowup(null);
  }, [taskParam, items, isLoading, selectFollowup, toast, t]);

  useEffect(() => {
    if (!viewParam || !isFollowupViewChip(viewParam)) return;
    setViewChip(viewParam);
    if (viewParam !== 'my' && viewParam !== 'team') {
      setFilter(chipToFilter(viewParam));
    }
  }, [viewParam]);

  useEffect(() => {
    if (!selectedItem || isLoading) return;
    if (items.some(i => i.id === selectedItem.id)) return;
    selectFollowup(null);
  }, [selectedItem, items, isLoading, selectFollowup]);

  const stages = useMemo(() => {
    const set = new Set(items.map(i => i.stage).filter(Boolean));
    return Array.from(set).sort();
  }, [items]);

  const { data: drawerConversation, isLoading: drawerConvLoading } = useQuery({
    queryKey: ['followups', 'conversation', selectedItem?.conversationId],
    queryFn: () => followupApi.getConversationById(selectedItem!.conversationId),
    enabled: !!selectedItem,
  });

  const { data: drawerHistory = [] } = useQuery({
    queryKey: ['followups', 'history', selectedItem?.conversationId],
    queryFn: () => followupApi.getHistory(selectedItem!.conversationId),
    enabled: !!selectedItem,
  });

  const { data: drawerMessages } = useQuery({
    queryKey: ['inbox', 'messages', selectedItem?.sessionId, selectedItem?.chatId],
    queryFn: () =>
      messageApi.list(selectedItem!.sessionId, { chatId: selectedItem!.chatId, limit: 6 }),
    enabled: !!selectedItem && selectedItem.sessionId !== 'manual',
  });

  const { data: drawerQuotes = [] } = useQuery({
    queryKey: ['quotes', 'list', selectedItem?.sessionId, selectedItem?.chatId],
    queryFn: () =>
      quoteApi.list({ sessionId: selectedItem!.sessionId, chatId: selectedItem!.chatId }),
    enabled: !!selectedItem && selectedItem.sessionId !== 'manual',
  });

  const drawerQuote = drawerQuotes[0] ?? null;

  const { data: linkedConversation } = useQuery({
    queryKey: ['followups', 'conversation', conversationParam],
    queryFn: () => followupApi.getConversationById(conversationParam!),
    enabled: !!conversationParam,
  });

  const linkedCard: PipelineCard | null = linkedConversation
    ? {
        id: linkedConversation.id,
        sessionId: linkedConversation.sessionId,
        chatId: linkedConversation.chatId,
        customerName: linkedConversation.customerName,
        customerPhone: linkedConversation.customerPhone,
        customerHandle: linkedConversation.customerHandle ?? null,
        source: linkedConversation.source,
        channel: linkedConversation.channel ?? null,
        stage: linkedConversation.stage,
        productInterest: linkedConversation.productInterest,
        priority: linkedConversation.priority ?? 'normal',
        lastCustomerMessageAt: linkedConversation.lastCustomerMessageAt,
        lastStaffMessageAt: linkedConversation.lastStaffMessageAt,
        nextFollowupAt: linkedConversation.nextFollowupAt,
        nextAction: linkedConversation.nextAction ?? null,
        assignedStaffId: linkedConversation.assignedStaffId,
        assignedStaffName: null,
        isManual: linkedConversation.isManual ?? false,
        linkedSaleId: linkedConversation.linkedSaleId,
        responseTimeSeconds: linkedConversation.responseTimeSeconds ?? null,
      }
    : null;

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['followups'] });
    void queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  };

  const sendMutation = useMutation({
    mutationFn: ({ id, channel }: { id: string; channel: 'whatsapp' | 'sms' | 'both' }) =>
      followupApi.sendFollowup(id, { channel }),
    onSuccess: () => {
      toast.success(t('followups.sendSuccess'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, outcome: o }: { id: string; outcome: string }) =>
      followupApi.completeFollowup(id, { outcome: o }),
    onSuccess: () => {
      setOutcomeModal(null);
      selectFollowup(null);
      toast.success(t('followups.completeSuccess'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) =>
      followupApi.rescheduleFollowup(id, { dueAt }),
    onSuccess: () => {
      setRescheduleOpen(false);
      toast.success(t('followups.rescheduleSuccess'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const scheduleAutopilotMutation = useMutation({
    mutationFn: ({ id, dueAt }: { id: string; dueAt: string }) =>
      followupApi.scheduleAutopilot(id, dueAt),
    onSuccess: () => {
      setRescheduleOpen(false);
      toast.success(t('followups.autopilot.scheduleSuccess'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const isAutopilotPendingApproval = (item: FollowupQueueItemView | null) =>
    Boolean(
      item?.isAutopilot &&
        (item.status === 'needs_approval' || item.status === 'ai_suggested'),
    );

  const reassignMutation = useMutation({
    mutationFn: ({ id, staffId }: { id: string; staffId: string }) =>
      followupApi.assignFollowup(id, staffId),
    onSuccess: () => {
      setReassignOpen(false);
      setReassignStaffId('');
      toast.success(t('followups.reassignSuccess'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const markWonMutation = useMutation({
    mutationFn: (conversationId: string) => followupApi.markWon(conversationId),
    onSuccess: () => {
      selectFollowup(null);
      toast.success(t('pipeline.markedWon'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const closeLostMutation = useMutation({
    mutationFn: (conversationId: string) =>
      followupApi.closeLost(conversationId, {
        lostReason,
        lostNotes: '',
        alternativeOffered: false,
      }),
    onSuccess: () => {
      setLostOpen(false);
      selectFollowup(null);
      toast.success(t('pipeline.closedLost'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const createManualMutation = useMutation({
    mutationFn: followupApi.createManualLead,
    onSuccess: () => {
      setNewTaskOpen(false);
      toast.success(t('followups.newTaskSuccess'));
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const approveAutopilotMutation = useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      followupApi.approveAutopilot(id, message),
    onSuccess: () => {
      toast.success('Autopilot message sent');
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const rejectAutopilotMutation = useMutation({
    mutationFn: (id: string) => followupApi.rejectAutopilot(id),
    onSuccess: () => {
      toast.success('Suggestion rejected');
      selectFollowup(null);
      invalidateAll();
    },
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const pauseAutopilotMutation = useMutation({
    mutationFn: ({ sessionId, chatId }: { sessionId: string; chatId: string }) =>
      followupApi.pauseAutopilot(sessionId, chatId),
    onSuccess: () => toast.success('Autopilot paused for this customer'),
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const resumeAutopilotMutation = useMutation({
    mutationFn: ({ sessionId, chatId }: { sessionId: string; chatId: string }) =>
      followupApi.resumeAutopilot(sessionId, chatId),
    onSuccess: () => toast.success('Autopilot resumed'),
    onError: (err: Error) => toast.error(t('common.errorGeneric'), err.message),
  });

  const autopilotCounts = useMemo(
    () => ({
      ai_suggested: counts.ai_suggested ?? 0,
      needs_approval: counts.needs_approval ?? 0,
      scheduled: counts.scheduled ?? 0,
      auto_sent: counts.auto_sent ?? 0,
      failed: counts.failed ?? 0,
      stopped: counts.stopped ?? 0,
      converted: counts.converted ?? 0,
    }),
    [counts],
  );

  const closeConversationModal = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('conversation');
    setSearchParams(next, { replace: true });
  };

  const syncViewParam = useCallback(
    (chip: FollowupViewChip) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (chip === 'my') next.delete('view');
          else next.set('view', chip);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleViewChip = (chip: FollowupViewChip) => {
    setViewChip(chip);
    setPage(1);
    syncViewParam(chip);
    if (chip === 'my' || chip === 'team') return;
    setFilter(chipToFilter(chip));
    if (isAutopilotChip(chip)) {
      setStaffFilter('');
    }
  };

  const handleMetricClick = (f: FollowUpQueueFilter) => {
    setFilter(f);
    setPage(1);
    let chip: FollowupViewChip = 'team';
    if (f === 'overdue') chip = 'overdue';
    else if (f === 'due_today') chip = 'due_today';
    else if (f === 'due_now') chip = 'upcoming';
    setViewChip(chip);
    syncViewParam(chip);
  };

  const resetFilters = () => {
    setChannelFilter('');
    setSessionFilter('');
    setStaffFilter('');
    setStageFilter('');
    setSearch('');
    setPage(1);
  };

  const handleExport = () => {
    downloadFollowupsCsv(
      sortedItems,
      `followups-${new Date().toISOString().slice(0, 10)}.csv`,
      sessionName,
    );
  };

  const applySearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const searchPlaceholder = t('followups.searchPlaceholder');

  useShellInboxSearchPublisher(isStitch, {
    searchInputRef,
    openThread: () => {},
    applyListSearch: applySearch,
    searchValue: search,
    placeholder: searchPlaceholder,
  });

  const detailDrawer = (
    <FollowupDetailDrawer
      item={selectedItem}
      conversation={drawerConversation}
      messages={drawerMessages?.messages}
      quote={drawerQuote}
      history={drawerHistory}
      loading={Boolean(selectedItem && drawerConvLoading && !drawerConversation)}
      canWrite={canWrite}
      layout="overlay"
      onClose={() => selectFollowup(null)}
      onSendTemplate={channel =>
        selectedItem && sendMutation.mutate({ id: selectedItem.id, channel })
      }
      sendChannel={sendChannel}
      onSendChannelChange={setSendChannel}
      smsAvailable={isSmsReady}
      onSnooze={() => {
        setScheduleMode('snooze');
        setRescheduleOpen(true);
      }}
      onMarkWon={() => selectedItem && markWonMutation.mutate(selectedItem.conversationId)}
      onMarkLost={() => {
        setLostReason(LOST_REASONS[0]);
        setLostOpen(true);
      }}
      onReassign={() => {
        setReassignStaffId(selectedItem?.assignedStaffId ?? '');
        setReassignOpen(true);
      }}
      sendPending={sendMutation.isPending}
      autopilotPending={approveAutopilotMutation.isPending || rejectAutopilotMutation.isPending}
      onApproveAutopilot={
        selectedItem &&
        (selectedItem.status === 'needs_approval' || selectedItem.status === 'ai_suggested')
          ? (message?: string) => approveAutopilotMutation.mutate({ id: selectedItem.id, message })
          : undefined
      }
      onRejectAutopilot={
        selectedItem &&
        (selectedItem.status === 'needs_approval' || selectedItem.status === 'ai_suggested')
          ? () => rejectAutopilotMutation.mutate(selectedItem.id)
          : undefined
      }
      onScheduleAutopilot={
        isAutopilotPendingApproval(selectedItem)
          ? () => {
              setScheduleMode('autopilot');
              setRescheduleOpen(true);
            }
          : undefined
      }
      onPauseAutopilot={
        selectedItem?.sessionId && selectedItem.sessionId !== 'manual'
          ? () =>
              pauseAutopilotMutation.mutate({
                sessionId: selectedItem.sessionId,
                chatId: selectedItem.chatId,
              })
          : undefined
      }
      onResumeAutopilot={
        selectedItem?.sessionId && selectedItem.sessionId !== 'manual'
          ? () =>
              resumeAutopilotMutation.mutate({
                sessionId: selectedItem.sessionId,
                chatId: selectedItem.chatId,
              })
          : undefined
      }
    />
  );

  const modals = (
    <>
      <FollowupOutcomeModal
        open={!!outcomeModal}
        outcome={outcome}
        onOutcomeChange={setOutcome}
        onClose={() => setOutcomeModal(null)}
        onConfirm={() =>
          outcomeModal && completeMutation.mutate({ id: outcomeModal.id, outcome })
        }
        pending={completeMutation.isPending}
      />

      <FollowupNewTaskModal
        open={newTaskOpen}
        staff={staff}
        onClose={() => setNewTaskOpen(false)}
        onSubmit={data => createManualMutation.mutate(data)}
        pending={createManualMutation.isPending}
      />

      <FollowupScheduleModal
        open={rescheduleOpen}
        item={selectedItem}
        mode={scheduleMode}
        onClose={() => setRescheduleOpen(false)}
        pending={rescheduleMutation.isPending || scheduleAutopilotMutation.isPending}
        onSchedule={({ dueAt, notes }) => {
          if (!selectedItem) return;
          const payload = { id: selectedItem.id, dueAt, notes };
          if (scheduleMode === 'autopilot') {
            scheduleAutopilotMutation.mutate({ id: selectedItem.id, dueAt });
          } else {
            rescheduleMutation.mutate(payload);
          }
        }}
      />

      {reassignOpen && selectedItem && (
        <ModalOverlay onClose={() => setReassignOpen(false)} className="fu-modal-overlay">
          <div className="fu-modal" onClick={e => e.stopPropagation()} role="dialog">
            <h3>{t('followups.reassign')}</h3>
            <label htmlFor="fu-reassign">{t('followups.newTaskForm.assignee')}</label>
            <select
              id="fu-reassign"
              value={reassignStaffId}
              onChange={e => setReassignStaffId(e.target.value)}
            >
              <option value="">{t('followups.drawer.unassigned')}</option>
              {staff.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="fu-modal__actions">
              <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setReassignOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="fu-btn fu-btn--primary"
                disabled={!reassignStaffId || reassignMutation.isPending}
                onClick={() =>
                  reassignMutation.mutate({ id: selectedItem.id, staffId: reassignStaffId })
                }
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {lostOpen && selectedItem && (
        <ModalOverlay onClose={() => setLostOpen(false)} className="fu-modal-overlay">
          <div className="fu-modal" onClick={e => e.stopPropagation()} role="dialog">
            <h3>{t('followups.markLost')}</h3>
            <label htmlFor="fu-lost-reason">{t('pipeline.lostReason')}</label>
            <select
              id="fu-lost-reason"
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
            >
              {LOST_REASONS.map(r => (
                <option key={r} value={r}>
                  {t(`pipeline.lostReasons.${r}`, { defaultValue: r })}
                </option>
              ))}
            </select>
            <div className="fu-modal__actions">
              <button type="button" className="fu-btn fu-btn--ghost" onClick={() => setLostOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="fu-btn fu-btn--primary"
                disabled={closeLostMutation.isPending}
                onClick={() => closeLostMutation.mutate(selectedItem.conversationId)}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {linkedCard && (
        <PipelineLeadDetail
          card={linkedCard}
          canWrite={canWrite}
          onClose={closeConversationModal}
        />
      )}
    </>
  );

  if (isStitch) {
    return (
      <>
        <FollowupsStitchWorkspace
          metrics={metrics}
          doneGoal={doneGoal}
          onMetricClick={handleMetricClick}
          viewChip={viewChip}
          onViewChipChange={handleViewChip}
          sortKey={sortKey}
          onSortChange={setSortKey}
          autopilotCounts={autopilotCounts}
          search={search}
          channelFilter={channelFilter}
          sessionFilter={sessionFilter}
          staffFilter={staffFilter}
          stageFilter={stageFilter}
          sessions={sessions}
          staff={staff}
          stages={stages}
          onChannelChange={v => {
            setChannelFilter(v);
            setPage(1);
          }}
          onSessionChange={v => {
            setSessionFilter(v);
            setPage(1);
          }}
          onStaffChange={v => {
            setStaffFilter(v);
            setPage(1);
          }}
          onStageChange={v => {
            setStageFilter(v);
            setPage(1);
          }}
          onClearSearch={() => {
            setSearch('');
            setPage(1);
          }}
          onResetFilters={resetFilters}
          rows={sortedItems}
          sessionName={sessionName}
          page={page}
          onPageChange={setPage}
          selectedItem={selectedItem}
          onRowClick={selectFollowup}
          onComplete={item => {
            setOutcome('still_thinking');
            setOutcomeModal(item);
          }}
          isLoading={isLoading}
          isFetching={isFetching}
          highlightConversationId={conversationParam}
          canWrite={canWrite}
          exportDisabled={sortedItems.length === 0}
          onRefresh={() => void refetch()}
          onExport={handleExport}
          onNewTask={() => setNewTaskOpen(true)}
        />
        {selectedItem ? detailDrawer : null}
        {modals}
      </>
    );
  }

  return (
    <div className="followups-interakt">
      <WorkspacePageHeader
        title={t('followups.dashboardTitle')}
        search={search}
        onSearchChange={v => {
          setSearch(v);
          setPage(1);
        }}
        onExport={handleExport}
        onNewTask={() => setNewTaskOpen(true)}
        exportDisabled={sortedItems.length === 0}
        showNewTask={canWrite}
        extraActions={
          <>
            <AskAiLink prompt={t('ai.prompts.followups')} />
            <Link to="/reports?section=staff" className="fu-btn fu-btn--ghost">
              {t('followups.reports.title')}
            </Link>
            <button
              type="button"
              className="fu-btn fu-btn--ghost"
              onClick={() => void refetch()}
              disabled={isFetching}
              title={t('common.refresh')}
            >
              <RefreshCw size={14} className={isFetching ? 'spin' : ''} />
              {t('common.refresh')}
            </button>
          </>
        }
      />

      <div className="followups-interakt__scroll">
        <FollowupMetricBento metrics={metrics} doneGoal={doneGoal} onMetricClick={handleMetricClick} />
        <LostDemandFollowupsPanel />
        <div>
          <FollowupViewChips
            activeChip={viewChip}
            onChipChange={handleViewChip}
            sortKey={sortKey}
            onSortChange={setSortKey}
            autopilotCounts={autopilotCounts}
          />
          <FollowupFilterBar
            channel={channelFilter}
            sessionId={sessionFilter}
            staffId={staffFilter}
            stage={stageFilter}
            sessions={sessions.map(s => ({ id: s.id, name: s.name ?? s.id }))}
            staff={staff}
            stages={stages}
            onChannelChange={v => {
              setChannelFilter(v);
              setPage(1);
            }}
            onSessionChange={v => {
              setSessionFilter(v);
              setPage(1);
            }}
            onStaffChange={v => {
              setStaffFilter(v);
              setPage(1);
            }}
            onStageChange={v => {
              setStageFilter(v);
              setPage(1);
            }}
            onReset={resetFilters}
          />
        </div>
        <FollowupQueueTable
          rows={sortedItems}
          sessionName={sessionName}
          page={page}
          onPageChange={setPage}
          onRowClick={selectFollowup}
          onComplete={item => {
            setOutcome('still_thinking');
            setOutcomeModal(item);
          }}
          isLoading={isLoading}
          highlightConversationId={conversationParam}
          canWrite={canWrite}
        />
      </div>

      {detailDrawer}
      {modals}
    </div>
  );
}
