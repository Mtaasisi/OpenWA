import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { formatCustomerLabel } from '../lib/inbox-customer-display';
import { storageApi, whatsAppSafetyApi } from '../services/api';
import type { DashboardScope } from '../lib/dashboard-scope';
import { getDashboardStaffId } from '../lib/dashboard-scope';
import {
  useSessionsQuery,
  useSessionStatsQuery,
  useOverviewStatsQuery,
  useDashboardInboxSnapshotQuery,
  useFollowupQueueCountsQuery,
  usePipelineDashboardQuery,
  usePipelineCountsQuery,
  usePipelineBucketQuery,
  useFollowupQueueQuery,
  useQuotesSummaryQuery,
  useAuditRecentQuery,
  useAuditMessageSentQuery,
  useInauzwaSyncStatusQuery,
  useFollowupReportsQuery,
  useFollowupStaffQuery,
  useConversionReportQuery,
  useAiStatusQuery,
  useAutoReplyHealthQuery,
  useAiSignalsQuery,
  useAiLearningAlertsQuery,
} from './queries';
import {
  sumUnread,
  countUnreplied,
  countAiPaused,
  countAssignedConversations,
  countUnreadAssigned,
  buildQuoteSummary,
  buildPipelineStages,
  aggregateProductDemand,
  buildAttentionAlerts,
  buildStaffAttentionAlerts,
  buildAdminCompoundKpis,
  buildStaffCompoundKpis,
  buildHeroKpis,
  countWonToday,
  countWonTodayLeads,
  buildTimelineEntries,
  countManualTakeovers,
  buildAiSafetyMetrics,
  attachPipelineStageValues,
  countAuditActionsSince,
  buildStaffMessageRepliesTodayMap,
  buildThreadValueLookup,
  mergeHotLeadsWithAiEscalations,
  escalationAccountLabel,
  escalationCustomerLabel,
  stockingReminderAccountLabel,
  stockingReminderCustomerLabel,
  buildThreadAssigneeMap,
  buildThreadDisplayLookup,
  scopeAiEscalationsForPipeline,
  type WorkQueueItem,
  type SessionSafetyInfo,
} from '../lib/dashboard-metrics';
import { countDirectAiBlocked, countDirectAiEligible } from '../lib/inbox-ai-takeover';
import { whatsappSafetyTabHref } from '../components/settings/settings-nav-registry';
import { useSmsStatus } from './useLinkedChannels';
import type { FollowupKpiReport } from '../services/api';

export function useDashboardData(scope: DashboardScope = 'staff') {
  const { t } = useTranslation();
  const staffId = scope === 'staff' ? getDashboardStaffId() : null;
  const staffFilter = staffId ?? undefined;

  const { data: inauzwaStatus } = useInauzwaSyncStatusQuery();
  const branchId =
    inauzwaStatus?.preferences?.branchId ?? inauzwaStatus?.branchId ?? undefined;

  const sessions = useSessionsQuery({ refetchInterval: 60_000 });
  const sessionStats = useSessionStatsQuery();
  const overview = useOverviewStatsQuery();
  const inbox = useDashboardInboxSnapshotQuery(branchId);
  const queueCounts = useFollowupQueueCountsQuery(branchId, staffFilter);
  const pipelineDashboard = usePipelineDashboardQuery(branchId);
  const pipelineCounts = usePipelineCountsQuery(branchId, staffFilter);
  const hotLeads = usePipelineBucketQuery('hot_leads', branchId, staffFilter);
  const wonLeads = usePipelineBucketQuery('won_leads', branchId, staffFilter);
  const lostLeads = usePipelineBucketQuery('lost_leads', branchId, scope === 'admin' ? undefined : staffFilter);
  const newLeads = usePipelineBucketQuery('new_leads', branchId, staffFilter);
  const waitingReply = usePipelineBucketQuery('waiting_reply', branchId, staffFilter);
  const dueNow = useFollowupQueueQuery('due_now', branchId, staffFilter);
  const dueToday = useFollowupQueueQuery('due_today', branchId, staffFilter);
  const paymentPending = useFollowupQueueQuery('payment_pending', branchId, staffFilter);
  const stockReminders = useFollowupQueueQuery('stock_reminders', branchId, staffFilter);
  const quotes = useQuotesSummaryQuery(branchId);
  const audit = useAuditRecentQuery(100);
  const auditMessageSent = useAuditMessageSentQuery(500);
  const followupReports = useFollowupReportsQuery();
  const followupStaff = useFollowupStaffQuery();
  const conversionReport = useConversionReportQuery(branchId);
  const aiStatus = useAiStatusQuery();
  const autoReplyHealth = useAutoReplyHealthQuery(scope === 'admin');
  const aiSignals = useAiSignalsQuery();
  const aiLearningAlerts = useAiLearningAlertsQuery(scope === 'admin');
  const storageUsage = useQuery({
    queryKey: ['storage', 'dashboard'],
    queryFn: () => storageApi.getUsage(),
    enabled: scope === 'admin',
    staleTime: 120_000,
    retry: false,
  });
  const smsStatusQuery = useSmsStatus();
  const waSafetyAlerts = useQuery({
    queryKey: ['whatsapp-safety', 'dashboard-alerts'],
    queryFn: () => whatsAppSafetyApi.getDashboardAlerts(),
    enabled: scope === 'admin',
    staleTime: 60_000,
    retry: false,
  });
  const linkPreflightSummary = useQuery({
    queryKey: ['whatsapp-safety', 'link-preflight-summary'],
    queryFn: () => whatsAppSafetyApi.getLinkPreflightSummary(),
    enabled: scope === 'admin',
    staleTime: 60_000,
    retry: false,
  });

  const conversations = inbox.data?.conversations ?? [];
  const quotesList = quotes.data ?? [];
  const hotLeadCardsRaw = hotLeads.data ?? [];

  const derived = useMemo(() => {
    const assigneeByThread = buildThreadAssigneeMap(conversations);
    const threadDisplay = buildThreadDisplayLookup(
      conversations,
      sessions.data ?? [],
      t,
    );
    const scopedEscalations = scopeAiEscalationsForPipeline(
      aiSignals.data?.recentEscalations,
      {
        viewerStaffId: scope === 'staff' ? staffId : null,
        isAdmin: scope === 'admin',
        assigneeByThread,
      },
    );

    const hotLeadMerge = mergeHotLeadsWithAiEscalations(hotLeadCardsRaw, scopedEscalations, {
      threadDisplay,
    });
    const hotLeadCards = hotLeadMerge.leads;
    const myAiEscalations = scope === 'staff' ? scopedEscalations.length : 0;
    const unread = scope === 'admin' ? sumUnread(conversations) : countUnreadAssigned(conversations, staffId);
    const unrepliedAll = countUnreplied(conversations);
    const unreplied =
      scope === 'staff' && staffId
        ? unrepliedAll.filter(c => c.assignedStaffId === staffId)
        : unrepliedAll;
    const aiPaused = countAiPaused(conversations);
    const manualTakeovers = countManualTakeovers(conversations);
    const unassignedHot = hotLeadCards.filter(c => !c.assignedStaffId);
    const assignedConversations = countAssignedConversations(conversations, staffId);
    const unreadAssigned = countUnreadAssigned(conversations, staffId);

    const relinkSessions = sessions.data?.filter(s => s.requiresRelink) ?? [];
    const disconnectedSessions =
      sessions.data?.filter(
        s => (s.status === 'disconnected' || s.status === 'failed') && !s.requiresRelink,
      ) ?? [];
    const qrSessions = sessions.data?.filter(s => s.status === 'qr_ready') ?? [];

    const quoteSummary = buildQuoteSummary(quotesList);
    const staffMissedFollowups = (followupReports.data ?? []).reduce(
      (sum, r) => sum + r.followupsMissed,
      0,
    );

    const myReport = staffId
      ? (followupReports.data ?? []).find(r => r.staffId === staffId)
      : undefined;

    const messageSentLogs = auditMessageSent.data?.data ?? [];
    const repliesTodayByStaff = buildStaffMessageRepliesTodayMap(messageSentLogs);

    const hotLeads =
      (queueCounts.data?.hot_leads ?? pipelineCounts.data?.hot_leads ?? 0) +
      hotLeadMerge.aiOnlyCount;

    const compoundKpis =
      scope === 'admin'
        ? buildAdminCompoundKpis({
            unread: sumUnread(conversations),
            overview: overview.data,
            queueCounts: queueCounts.data ?? {},
            sessionStats: sessionStats.data,
            ready: sessionStats.data?.ready ?? 0,
            qrNeeded: qrSessions.length,
            disconnected: disconnectedSessions.length,
            failedSends: overview.data?.messages.failed ?? 0,
            engineRelinkNeeded: relinkSessions.length,
          })
        : buildStaffCompoundKpis({
            assignedCount: assignedConversations.length,
            unreadAssigned,
            queueCounts: queueCounts.data ?? {},
            hotLeads,
            myAiEscalations,
            missedTasks: myReport?.followupsMissed ?? 0,
          });

    const alerts =
      scope === 'admin'
        ? buildAttentionAlerts({
            unreplied: unrepliedAll,
            queueCounts: queueCounts.data ?? {},
            failedSends: overview.data?.messages.failed ?? 0,
            disconnectedSessions,
            qrSessions,
            relinkSessions,
            unassignedHotLeads: unassignedHot,
            aiPaused,
            syncError: inauzwaStatus?.lastSyncError ?? null,
            quotesNeedingFollowup: quoteSummary.needsFollowup,
            staffMissedFollowups,
            storageWarnings: storageUsage.data?.warnings ?? [],
            smsStatus: smsStatusQuery.data ?? null,
            aiSignals: aiSignals.data ?? null,
            learningAlerts: aiLearningAlerts.data?.learning ?? null,
            demandAlerts: aiLearningAlerts.data?.demand
              ? {
                  draftCampaignsCount: aiLearningAlerts.data.demand.draftCampaignsCount ?? 0,
                  approvedCampaignsCount: aiLearningAlerts.data.demand.approvedCampaignsCount ?? 0,
                }
              : null,
            profileAlerts: aiLearningAlerts.data?.profile
              ? {
                  nameReview: aiLearningAlerts.data.profile.nameReview ?? 0,
                  learningReview: aiLearningAlerts.data.profile.learningReview ?? 0,
                  lostWaiting: aiLearningAlerts.data.profile.lostWaiting ?? 0,
                }
              : null,
            whatsappSafety: waSafetyAlerts.data
              ? {
                  blockedToday: waSafetyAlerts.data.blockedToday ?? 0,
                  pendingQueue: waSafetyAlerts.data.pendingQueue ?? 0,
                  approvalRequired: waSafetyAlerts.data.approvalRequired?.length ?? 0,
                }
              : null,
            linkSafetyNotReady:
              linkPreflightSummary.data?.sessions?.filter(row => !row.ready) ?? [],
            t,
          })
        : buildStaffAttentionAlerts({
            unreplied,
            queueCounts: queueCounts.data ?? {},
            assignedUnread: unreadAssigned,
            aiEscalations: myAiEscalations,
            t,
          });

    const wonToday = Math.max(
      countWonToday(quotesList),
      countWonTodayLeads(wonLeads.data ?? []),
    );
    const criticalAlerts = alerts.filter(a => a.severity === 'high').length;
    const heroKpis =
      scope === 'admin'
        ? buildHeroKpis({
            needsReply: unrepliedAll.length,
            overview: overview.data,
            hotLeads,
            paymentPending: queueCounts.data?.payment_pending ?? 0,
            quoteSummary,
            wonToday,
            alertsCount: alerts.length,
            criticalAlerts,
          })
        : [];

    const pipelineStages = attachPipelineStageValues(
      buildPipelineStages(pipelineCounts.data, pipelineDashboard.data, {
        hotLeadBoost: scope === 'admin' ? hotLeadMerge.aiOnlyCount : 0,
      }),
      quotesList,
    );

    const productCards = [
      ...hotLeadCards,
      ...(newLeads.data ?? []),
      ...(waitingReply.data ?? []),
    ];
    let productDemand = aggregateProductDemand(productCards, quotesList);
    const aiStocking = aiSignals.data?.openStockingReminders ?? [];
    for (const row of aiStocking) {
      const name = row.productName?.trim();
      if (!name) continue;
      const existing = productDemand.find(p => p.name === name);
      if (existing) {
        existing.stockStatus = 'stocking_needed';
      } else {
        productDemand.push({
          name,
          requests: 1,
          quotesCreated: 0,
          wonCount: 0,
          stockStatus: 'stocking_needed',
        });
      }
    }
    const demandApi = aiLearningAlerts.data?.demand;
    if (demandApi?.mostAskedProduct) {
      const name = String(demandApi.mostAskedProduct);
      const existing = productDemand.find(p => p.name === name);
      if (existing) {
        existing.requests += 1;
      } else {
        productDemand.push({
          name,
          requests: 1,
          quotesCreated: 0,
          wonCount: 0,
        });
      }
    }
    productDemand = productDemand
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    const workItems: WorkQueueItem[] = [];

    const queueCustomerLabel = (item: {
      chatId: string;
      customerName: string | null;
      customerPhone: string | null;
    }) =>
      formatCustomerLabel({
        chatId: item.chatId,
        customerName: item.customerName,
        customerPhone: item.customerPhone,
      });

    const matchesStaff = (assignedStaffId?: string | null) =>
      scope !== 'staff' || !staffId || assignedStaffId === staffId;

    const dueFollowups = (() => {
      const seen = new Set<string>();
      const merged = [];
      for (const item of [...(dueNow.data ?? []), ...(dueToday.data ?? [])]) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
        if (merged.length >= 8) break;
      }
      return merged;
    })();

    for (const item of dueFollowups) {
      if (!matchesStaff(item.assignedStaffId)) continue;
      workItems.push({
        id: `fu-${item.id}`,
        customer: queueCustomerLabel(item),
        accountName: item.source,
        reasonKey: 'dashboard.controlRoom.work.followupDue',
        dueAt: item.dueAt,
        assignedStaff: item.assignedStaffName,
        sessionId: item.sessionId,
        chatId: item.chatId,
        conversationId: item.conversationId,
        kind: 'followup',
      });
    }

    for (const item of (paymentPending.data ?? []).slice(0, 4)) {
      if (!matchesStaff(item.assignedStaffId)) continue;
      workItems.push({
        id: `pay-${item.id}`,
        customer: queueCustomerLabel(item),
        accountName: item.source,
        reasonKey: 'dashboard.controlRoom.work.paymentReminder',
        dueAt: item.dueAt,
        assignedStaff: item.assignedStaffName,
        sessionId: item.sessionId,
        chatId: item.chatId,
        conversationId: item.conversationId,
        kind: 'followup',
      });
    }

    for (const esc of scopedEscalations) {
      workItems.push({
        id: `ai-esc-${esc.id}`,
        customer: escalationCustomerLabel(esc, { threadDisplay, t }),
        accountName: escalationAccountLabel(esc, { threadDisplay }),
        reasonKey: 'dashboard.controlRoom.work.aiEscalation',
        sessionId: esc.sessionId,
        chatId: esc.chatId,
        kind: 'ai-escalation',
      });
    }

    for (const row of aiStocking.slice(0, 4)) {
      const sessionId = row.sessionId ?? '';
      const chatId = row.chatId ?? '';
      workItems.push({
        id: `ai-stock-${row.id}`,
        customer: stockingReminderCustomerLabel(row, { threadDisplay, t }),
        accountName: stockingReminderAccountLabel(row, { threadDisplay }),
        reasonKey: 'dashboard.controlRoom.work.aiStocking',
        sessionId: sessionId || undefined,
        chatId: chatId || undefined,
        kind: 'ai-stocking',
      });
    }

    if (scope === 'admin') {
      for (const item of (aiLearningAlerts.data?.learning.topPending ?? []).slice(0, 4)) {
        workItems.push({
          id: `ai-learn-${item.id}`,
          customer: item.question.slice(0, 48),
          accountName: item.branchId ?? '—',
          reasonKey: 'dashboard.controlRoom.work.teachAi',
          sessionId: item.sessionId ?? undefined,
          chatId: item.chatId ?? undefined,
          kind: 'ai-learning',
        });
      }

      for (const campaign of (aiLearningAlerts.data?.demand.topDraftCampaigns ?? []).slice(0, 3)) {
        workItems.push({
          id: `demand-camp-${campaign.id}`,
          customer: campaign.title,
          accountName: campaign.channel.toUpperCase(),
          reasonKey: 'dashboard.controlRoom.work.demandCampaign',
          kind: 'demand-campaign',
          actionTo: '/campaigns',
        });
      }

      const profileCounts = aiLearningAlerts.data?.profile;
      if (profileCounts && profileCounts.nameReview > 0) {
        workItems.push({
          id: 'profile-name-review',
          customer: t('dashboard.controlRoom.work.profileNameReviewCustomer', {
            defaultValue: 'AI-detected names',
          }),
          accountName: '—',
          reasonKey: 'dashboard.controlRoom.work.profileNameReview',
          kind: 'profile-name-review',
          actionTo: '/customers',
        });
      }
      if (profileCounts && profileCounts.lostWaiting > 0) {
        workItems.push({
          id: 'lost-demand-waiting',
          customer: t('dashboard.controlRoom.work.lostDemandCustomer', {
            defaultValue: 'Notify-when-available',
          }),
          accountName: '—',
          reasonKey: 'dashboard.controlRoom.work.lostDemandWaiting',
          kind: 'lost-demand-waiting',
          actionTo: '/followups',
        });
      }
    }

    if (scope === 'admin' && waSafetyAlerts.data) {
      for (const row of (waSafetyAlerts.data.approvalRequired ?? []).slice(0, 5)) {
        const sessionId = row.sessionId ?? '';
        const chatId = row.chatId ?? '';
        workItems.push({
          id: `wa-approve-${row.id}`,
          customer:
            sessionId && chatId ? threadDisplay.customerLabel(sessionId, chatId) : chatId || '—',
          accountName: sessionId ? threadDisplay.accountLabel(sessionId) : '—',
          reasonKey: 'dashboard.controlRoom.work.waQueueApproval',
          sessionId: row.sessionId,
          chatId: row.chatId,
          kind: 'wa-queue-approval',
          actionTo: whatsappSafetyTabHref('queue'),
        });
      }
      for (const row of (waSafetyAlerts.data.criticalAlerts ?? []).slice(0, 3)) {
        workItems.push({
          id: `wa-health-${row.id}`,
          customer: row.message ?? 'Session health alert',
          accountName: row.sessionId ?? '—',
          reasonKey: 'dashboard.controlRoom.work.waHealthAlert',
          kind: 'wa-health-alert',
          actionTo: whatsappSafetyTabHref('activity'),
        });
      }
    }

    if (scope === 'admin') {
      for (const item of (stockReminders.data ?? []).slice(0, 3)) {
        workItems.push({
          id: `stock-${item.id}`,
          customer: queueCustomerLabel(item),
          accountName: item.source,
          reasonKey: 'dashboard.controlRoom.work.stockReminder',
          dueAt: item.dueAt,
          assignedStaff: item.assignedStaffName,
          sessionId: item.sessionId,
          chatId: item.chatId,
          conversationId: item.conversationId,
          kind: 'followup',
        });
      }
    }

    for (const q of quotesList.filter(x => x.status === 'draft').slice(0, 4)) {
        workItems.push({
          id: `quote-${q.id}`,
          customer: formatCustomerLabel({
            chatId: q.chatId,
            customerName: q.customerName,
            customerPhone: q.customerPhone,
          }),
          accountName: threadDisplay.accountLabel(q.sessionId),
        reasonKey: 'dashboard.controlRoom.work.draftQuote',
        assignedStaff: null,
        sessionId: q.sessionId,
        chatId: q.chatId,
        kind: 'quote',
      });
    }

    const convPool =
      scope === 'staff' && staffId
        ? conversations.filter(x => x.assignedStaffId === staffId)
        : conversations.filter(x => x.assignedStaffId);

    for (const c of convPool.slice(0, 5)) {
      workItems.push({
        id: `conv-${c.sessionId}-${c.chatId}`,
        customer: c.customerName ?? c.displayName,
        accountName: c.sessionName,
        reasonKey: 'dashboard.controlRoom.work.assignedChat',
        assignedStaff: c.assignedStaffName,
        sessionId: c.sessionId,
        chatId: c.chatId,
        kind: 'conversation',
      });
    }

    const timeline = buildTimelineEntries(audit.data?.data ?? []);

    const openAiEscalations =
      scope === 'staff' ? myAiEscalations : (aiSignals.data?.openEscalations ?? 0);
    const aiFlaggedUrgent =
      (aiPaused.length > 0 ? 1 : 0) +
      (openAiEscalations > 0 ? 1 : 0) +
      (aiStatus.data?.enabled && !aiStatus.data.apiKeySet ? 1 : 0) +
      (aiStatus.data?.testStatus === 'failed' ? 1 : 0) +
      (autoReplyHealth.data?.masterEnabled && !autoReplyHealth.data.ready ? 1 : 0);

    const auditLogs = audit.data?.data ?? [];
    const aiReplies24h =
      autoReplyHealth.data?.stats.aiReplies24h ??
      countAuditActionsSince(auditLogs, ['ai_reply'], 24);
    const aiTakeovers24h = countAuditActionsSince(auditLogs, ['inbox_ai_takeover'], 24);

    const aiSafety = {
      ...buildAiSafetyMetrics(
        aiStatus.data,
        manualTakeovers,
        aiFlaggedUrgent,
        aiReplies24h,
        aiTakeovers24h,
        openAiEscalations,
        waSafetyAlerts.data?.blockedToday ?? 0,
        waSafetyAlerts.data?.pendingQueue ?? 0,
        autoReplyHealth.data
          ? {
              masterEnabled: autoReplyHealth.data.masterEnabled,
              ready: autoReplyHealth.data.ready,
            }
          : undefined,
      ),
      pendingLearning: aiLearningAlerts.data?.learning.pendingCount,
      unknownQuestionsToday: aiLearningAlerts.data?.learning.unknownToday,
      aiPausedChats: aiLearningAlerts.data?.learning.aiPausedChats,
      directAiEligible: countDirectAiEligible(conversations),
      directAiBlocked: countDirectAiBlocked(conversations),
      lowConfidenceReplies: aiLearningAlerts.data?.learning.pendingCount,
      profileNameReview: aiLearningAlerts.data?.profile?.nameReview,
      profileLearningReview: aiLearningAlerts.data?.profile?.learningReview,
      lostDemandWaiting: aiLearningAlerts.data?.profile?.lostWaiting,
    };

    const failedBySession = overview.data?.messages.failedBySession ?? {};
    const threadValueLookup = buildThreadValueLookup(quotesList, hotLeadCards);

    const sessionSafety: Record<string, SessionSafetyInfo> = {};
    if (scope === 'admin' && waSafetyAlerts.data) {
      for (const row of waSafetyAlerts.data.warmups ?? []) {
        const sessionId = row.sessionId ?? '';
        if (!sessionId) continue;
        sessionSafety[sessionId] = {
          ...sessionSafety[sessionId],
          warmupDay: row.dayNumber || undefined,
        };
      }
      for (const row of waSafetyAlerts.data.approvalRequired ?? []) {
        const sessionId = row.sessionId ?? '';
        if (!sessionId) continue;
        sessionSafety[sessionId] = {
          ...sessionSafety[sessionId],
          queuePending: (sessionSafety[sessionId]?.queuePending ?? 0) + 1,
        };
      }
      for (const row of waSafetyAlerts.data.criticalAlerts ?? []) {
        const sessionId = row.sessionId ?? '';
        if (!sessionId) continue;
        sessionSafety[sessionId] = {
          ...sessionSafety[sessionId],
          healthAlert: row.message,
          automationPaused:
            row.eventType === 'automation_paused' || sessionSafety[sessionId]?.automationPaused,
        };
      }
    }
    if (scope === 'admin' && linkPreflightSummary.data) {
      for (const row of linkPreflightSummary.data.sessions ?? []) {
        sessionSafety[row.sessionId] = {
          ...sessionSafety[row.sessionId],
          linkSafetyReady: row.ready,
          linkSafetyIssues: row.issueCount,
        };
      }
    }

    const staffRows: Array<{
      staffId: string;
      name: string;
      assigned: number;
      repliesSent: number;
      avgResponseMs: number;
      followupsCompleted: number;
      won: number;
      lost: number;
      overdue: number;
    }> = [];

    const staffList = followupStaff.data ?? [];
    const reports = followupReports.data ?? [];
    const byStaff = conversionReport.data?.byStaff ?? {};
    const leadsByStaff = pipelineDashboard.data?.leadsByStaff ?? {};

    const reportByStaff = new Map<string, FollowupKpiReport>();
    for (const r of reports) {
      if (!reportByStaff.has(r.staffId)) reportByStaff.set(r.staffId, r);
    }

    const staffIds = new Set<string>([
      ...reports.map(r => r.staffId),
      ...Object.keys(byStaff),
    ]);

    for (const id of staffIds) {
      const report = reportByStaff.get(id);
      const staff = staffList.find(s => s.id === id);
      const name = staff?.name ?? id.slice(0, 8);
      const conv = byStaff[name] ?? byStaff[id];
      staffRows.push({
        staffId: id,
        name,
        assigned: leadsByStaff[name] ?? 0,
        repliesSent: repliesTodayByStaff.get(id) ?? 0,
        avgResponseMs: report ? 0 : 0,
        followupsCompleted:
          (report?.followupsCompletedOnTime ?? 0) + (report?.followupsCompletedLate ?? 0),
        won: conv?.won ?? 0,
        lost: conv?.lost ?? 0,
        overdue: report?.overdueFollowups ?? 0,
      });
    }

    const myStaffRow = staffId ? staffRows.find(r => r.staffId === staffId) : undefined;

    return {
      scope,
      staffId,
      unread,
      unreplied,
      aiPaused,
      compoundKpis,
      heroKpis,
      wonToday,
      alerts,
      pipelineStages,
      quoteSummary,
      productDemand,
      workItems: workItems.slice(0, 15),
      timeline,
      staffRows,
      myStaffRow,
      hotLeadCards,
      assignedConversations,
      unreadAssigned,
      unassignedHot,
      manualTakeovers,
      aiSafety,
      threadValueLookup,
      failedBySession,
      sessionSafety,
      draftCampaignsCount: aiLearningAlerts.data?.demand.draftCampaignsCount ?? 0,
      lostDemandWaiting: aiLearningAlerts.data?.profile?.lostWaiting ?? 0,
    };
  }, [
    scope,
    staffId,
    conversations,
    quotesList,
    hotLeadCardsRaw,
    wonLeads.data,
    lostLeads.data,
    sessions.data,
    overview.data,
    queueCounts.data,
    pipelineCounts.data,
    pipelineDashboard.data,
    dueNow.data,
    dueToday.data,
    paymentPending.data,
    stockReminders.data,
    audit.data,
    auditMessageSent.data,
    followupReports.data,
    followupStaff.data,
    conversionReport.data,
    inauzwaStatus?.lastSyncError,
    newLeads.data,
    waitingReply.data,
    aiStatus.data,
    autoReplyHealth.data,
    aiSignals.data,
    aiLearningAlerts.data,
    waSafetyAlerts.data,
    linkPreflightSummary.data,
    storageUsage.data,
    smsStatusQuery.data,
    t,
  ]);

  const isLoading = sessions.isLoading || inbox.isLoading;

  const systemAlerts: string[] = [];
  const connected = sessions.data?.filter(s => s.status === 'ready').length ?? 0;
  if (scope === 'admin' && sessions.data && sessions.data.length > 0 && connected === 0) {
    systemAlerts.push(t('dashboard.controlRoom.system.noSessions'));
  }
  if (scope === 'admin' && inauzwaStatus?.configured && inauzwaStatus.lastSyncError) {
    systemAlerts.push(t('dashboard.controlRoom.system.syncFail', { error: inauzwaStatus.lastSyncError }));
  }
  if (scope === 'admin' && aiStatus.data?.enabled && !aiStatus.data.apiKeySet) {
    systemAlerts.push(t('dashboard.controlRoom.system.aiNoKey'));
  }
  if (scope === 'admin' && aiStatus.data?.testStatus === 'failed') {
    systemAlerts.push(t('dashboard.controlRoom.system.aiTestFail'));
  }
  if (
    scope === 'admin' &&
    autoReplyHealth.data?.masterEnabled &&
    !autoReplyHealth.data.ready
  ) {
    systemAlerts.push(t('dashboard.controlRoom.system.autoReplyNotReady'));
  }
  if (scope === 'admin' && (aiSignals.data?.stockingReminders ?? 0) > 0) {
    systemAlerts.push(
      t('dashboard.controlRoom.system.aiStocking', {
        count: aiSignals.data?.stockingReminders ?? 0,
      }),
    );
  }
  if (scope === 'admin' && (overview.data?.messages.failed ?? 0) > 0) {
    systemAlerts.push(
      t('dashboard.controlRoom.system.failedSends', { count: overview.data?.messages.failed }),
    );
  }
  if (scope === 'admin') {
    for (const warning of storageUsage.data?.warnings ?? []) {
      systemAlerts.push(warning.message);
    }
    const sms = smsStatusQuery.data;
    if (sms?.configured) {
      if (sms.status === 'failed') {
        systemAlerts.push(
          sms.lastError
            ? t('systemStatus.sms.failedWithError', { error: sms.lastError })
            : t('systemStatus.sms.failed'),
        );
      } else if (sms.lowBalance || sms.status === 'low_balance') {
        systemAlerts.push(
          sms.lastBalance != null
            ? t('systemStatus.sms.lowBalanceWithAmount', { balance: sms.lastBalance })
            : t('systemStatus.sms.lowBalance'),
        );
      } else if (sms.isEnabled && !sms.connected && sms.status === 'not_connected') {
        systemAlerts.push(t('systemStatus.sms.notConnected'));
      } else if (sms.status === 'disabled') {
        systemAlerts.push(t('systemStatus.sms.disabled'));
      }
    }
  }

  return {
    branchId,
    sessions: sessions.data ?? [],
    sessionStats: sessionStats.data,
    overview: overview.data,
    conversations,
    inauzwaStatus: inauzwaStatus,
    queueCounts: queueCounts.data ?? {},
    pipelineDashboard: pipelineDashboard.data,
    isLoading,
    systemAlerts,
    aiStatus: aiStatus.data,
    stopSession: sessions,
    ...derived,
  };
}
