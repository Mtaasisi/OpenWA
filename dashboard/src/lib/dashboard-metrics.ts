import type { LucideIcon } from 'lucide-react';
import {
  MessageSquare,
  Mail,
  AlertTriangle,
  Clock,
  CreditCard,
  Flame,
  FileText,
  Trophy,
  XCircle,
  Smartphone,
  Package,
  ShieldCheck,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { formatCustomerLabel, enrichConversationIdentity } from './inbox-customer-display';
import { channelsUrl } from './channel-routes';
import { settingsPanelHref, whatsappSafetyTabHref } from '../components/settings/settings-nav-registry';
import type {
  AuditLog,
  Conversation,
  FollowUpQueueFilter,
  PipelineBucket,
  PipelineCard,
  PipelineDashboardStats,
  Quote,
  Session,
  SessionStats,
  OverviewStats,
  AiStatusView,
} from '../services/api';
import { inboxDeepLink } from '../components/customers/customer-utils';
import type { MetricSeverity } from '../components/workspace/MetricCard';
import {
  translateStorageWarning,
  storageAttentionTitle,
  storageAttentionAction,
} from './storage-i18n';

export type DashboardTab =
  | 'overview'
  | 'today'
  | 'inbox_ai'
  | 'sales'
  | 'operations'
  | 'system';

export type AttentionSeverity = 'high' | 'medium';

export interface AttentionAlert {
  id: string;
  severity: AttentionSeverity;
  title: string;
  description: string;
  accountName?: string;
  channel?: string;
  actionLabel: string;
  actionTo: string;
  actionState?: Record<string, unknown>;
}

export interface DashboardKpi {
  id: string;
  titleKey: string;
  helperKey?: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean | null;
  severity: MetricSeverity;
  icon: LucideIcon;
  linkTo: string;
  linkState?: Record<string, unknown>;
  priority: boolean;
}

export interface DashboardCompoundSegment {
  id: string;
  labelKey: string;
  value: number;
  severity: MetricSeverity;
}

export interface DashboardActivityBar {
  id: string;
  labelKey: string;
  value: number;
  tone: 'received' | 'sent';
}

export interface DashboardCompoundKpi {
  id: string;
  titleKey: string;
  helperKey?: string;
  icon: LucideIcon;
  severity: MetricSeverity;
  linkTo: string;
  linkState?: Record<string, unknown>;
  primaryValue: string | number;
  primaryLabelKey?: string;
  secondaryValue?: string | number;
  secondaryLabelKey?: string;
  segments?: DashboardCompoundSegment[];
  activityBars?: DashboardActivityBar[];
  allClear?: boolean;
  tabs?: DashboardTab[];
}

export interface DashboardHeroKpi {
  id: string;
  titleKey: string;
  value: string | number;
  footnoteKey?: string;
  footnoteParams?: Record<string, string | number>;
  trend?: string;
  trendUp?: boolean;
  severity: MetricSeverity;
  symbol: string;
  linkTo: string;
  linkState?: Record<string, unknown>;
}

export interface PipelineStageDisplay {
  id: string;
  labelKey: string;
  count: number;
  subLabel?: string;
  linkTo: string;
  bucket?: PipelineBucket;
}

export interface WorkQueueItem {
  id: string;
  customer: string;
  accountName: string;
  reasonKey: string;
  dueAt?: string;
  assignedStaff?: string | null;
  sessionId?: string;
  chatId?: string;
  conversationId?: string;
  kind:
    | 'followup'
    | 'quote'
    | 'conversation'
    | 'ai-escalation'
    | 'ai-stocking'
    | 'ai-learning'
    | 'demand-campaign'
    | 'profile-name-review'
    | 'profile-learning-review'
    | 'lost-demand-waiting'
    | 'wa-queue-approval'
    | 'wa-health-alert';
  actionTo?: string;
}

export interface SessionSafetyInfo {
  warmupDay?: number;
  automationPaused?: boolean;
  queuePending?: number;
  healthAlert?: string;
  linkSafetyReady?: boolean;
  linkSafetyIssues?: number;
}

export interface ProductDemandRow {
  name: string;
  requests: number;
  quotesCreated: number;
  wonCount: number;
  stockStatus?: string;
}

export interface QuoteSummary {
  draft: number;
  sent: number;
  accepted: number;
  rejected: number;
  expired: number;
  needsFollowup: number;
  totalQuotedValue: number;
}

export interface TimelineEntry {
  id: string;
  actionKey: string;
  meta: string;
  time: string;
  symbol: string;
}

export function sumUnread(conversations: Conversation[]): number {
  return conversations.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}

export function countUnreplied(conversations: Conversation[]): Conversation[] {
  return conversations.filter(c => !c.resolved && c.lastDirection === 'incoming');
}

export function countAiPaused(conversations: Conversation[]): Conversation[] {
  return conversations.filter(
    c =>
      !c.resolved &&
      (c.aiAutoReplyPaused === true || c.aiHandlingState === 'waiting_human'),
  );
}

export function countManualTakeovers(conversations: Conversation[]): number {
  return conversations.filter(
    c =>
      !c.resolved &&
      (c.aiAutoReplyPaused === true ||
        c.aiHandlingState === 'waiting_human' ||
        c.aiHandlingState === 'human_handling'),
  ).length;
}

export type AiCoreStatus = 'optimal' | 'standby' | 'degraded' | 'offline' | 'setup';

export interface AiSafetyMetrics {
  autonomyPct: number;
  coreStatus: AiCoreStatus;
  manualTakeovers: number;
  aiTakeovers24h: number;
  aiReplies24h: number;
  flaggedUrgent: number;
  openEscalations: number;
  autoReplyMasterEnabled?: boolean;
  autoReplyReady?: boolean;
  pendingLearning?: number;
  unknownQuestionsToday?: number;
  lowConfidenceReplies?: number;
  aiPausedChats?: number;
  directAiEligible?: number;
  directAiBlocked?: number;
  profileNameReview?: number;
  profileLearningReview?: number;
  lostDemandWaiting?: number;
  waBlockedToday?: number;
  waQueuePending?: number;
}

export function countAuditActionsSince(
  logs: AuditLog[],
  actions: string[],
  hours = 24,
): number {
  const since = Date.now() - hours * 3_600_000;
  return logs.filter(l => {
    if (!actions.includes(l.action)) return false;
    const ts = new Date(l.createdAt).getTime();
    return !Number.isNaN(ts) && ts >= since;
  }).length;
}

function startOfLocalDayMs(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

/** Staff outbound messages today from audit `message_sent` rows (apiKeyId = staff key id). */
export function countStaffMessageRepliesToday(
  logs: AuditLog[],
  staffKeyId: string | null,
): number {
  if (!staffKeyId) return 0;
  const since = startOfLocalDayMs();
  return logs.filter(l => {
    if (l.action !== 'message_sent' || l.apiKeyId !== staffKeyId) return false;
    const ts = new Date(l.createdAt).getTime();
    return !Number.isNaN(ts) && ts >= since;
  }).length;
}

export function buildStaffMessageRepliesTodayMap(logs: AuditLog[]): Map<string, number> {
  const since = startOfLocalDayMs();
  const map = new Map<string, number>();
  for (const log of logs) {
    if (log.action !== 'message_sent' || !log.apiKeyId) continue;
    const ts = new Date(log.createdAt).getTime();
    if (Number.isNaN(ts) || ts < since) continue;
    map.set(log.apiKeyId, (map.get(log.apiKeyId) ?? 0) + 1);
  }
  return map;
}

export function formatCompactCurrency(amount: number, currency = ''): string {
  const abs = Math.abs(amount);
  let formatted: string;
  if (abs >= 1_000_000) {
    formatted = `${(amount / 1_000_000).toFixed(1)}M`;
  } else if (abs >= 1_000) {
    formatted = `${(amount / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  } else {
    formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return currency ? `${currency} ${formatted}` : formatted;
}

export function attachPipelineStageValues(
  stages: PipelineStageDisplay[],
  quotes: Quote[],
): PipelineStageDisplay[] {
  let quotedValue = 0;
  let paymentValue = 0;
  let wonValue = 0;
  let currency = '';

  for (const q of quotes) {
    if (!currency && q.currency) currency = q.currency;
    const amt = q.totalAmount ?? 0;
    if (q.status === 'sent') {
      quotedValue += amt;
      paymentValue += amt;
    } else if (q.status === 'draft') {
      quotedValue += amt;
    } else if (q.status === 'accepted' || q.status === 'converted_to_sale') {
      wonValue += amt;
    }
  }

  const values: Record<string, number | undefined> = {
    quoted: quotedValue > 0 ? quotedValue : undefined,
    payment: paymentValue > 0 ? paymentValue : undefined,
    won: wonValue > 0 ? wonValue : undefined,
  };

  return stages.map(stage => ({
    ...stage,
    subLabel:
      values[stage.id] != null
        ? formatCompactCurrency(values[stage.id]!, currency)
        : stage.subLabel,
  }));
}

export function buildAiSafetyMetrics(
  aiStatus: AiStatusView | undefined,
  manualTakeovers: number,
  flaggedUrgent: number,
  aiReplies24h = 0,
  aiTakeovers24h = 0,
  openEscalations = 0,
  waBlockedToday = 0,
  waQueuePending = 0,
  autoReplyHealth?: { masterEnabled: boolean; ready: boolean },
): AiSafetyMetrics {
  if (!aiStatus?.enabled) {
    return {
      autonomyPct: 0,
      coreStatus: 'offline',
      manualTakeovers,
      aiTakeovers24h,
      aiReplies24h,
      flaggedUrgent,
      openEscalations,
    };
  }
  if (!aiStatus.apiKeySet) {
    return {
      autonomyPct: 0,
      coreStatus: 'setup',
      manualTakeovers,
      aiTakeovers24h,
      aiReplies24h,
      flaggedUrgent,
      openEscalations,
    };
  }
  if (aiStatus.testStatus === 'failed') {
    return {
      autonomyPct: 25,
      coreStatus: 'degraded',
      manualTakeovers,
      aiTakeovers24h,
      aiReplies24h,
      flaggedUrgent,
      openEscalations,
    };
  }

  let pct = 35;
  const masterOn = autoReplyHealth?.masterEnabled ?? aiStatus.autoReplyEnabled === true;
  const autoReplyReady = autoReplyHealth?.ready ?? (masterOn && aiStatus.autoReplyEnabled === true);
  if (masterOn) pct += 40;
  if (autoReplyReady) pct += 10;
  if (aiStatus.toolCallingEnabled) pct += 15;
  if (aiStatus.testStatus === 'ok' || aiStatus.testStatus === 'passed') pct += 10;
  pct = Math.min(100, pct);

  const coreStatus: AiCoreStatus =
    flaggedUrgent > 0
      ? 'degraded'
      : masterOn && autoReplyReady
        ? 'optimal'
        : masterOn
          ? 'degraded'
          : 'standby';

  return {
    autonomyPct: pct,
    coreStatus,
    manualTakeovers,
    aiTakeovers24h,
    aiReplies24h,
    flaggedUrgent,
    openEscalations,
    waBlockedToday,
    waQueuePending,
    autoReplyMasterEnabled: masterOn,
    autoReplyReady,
  };
}

export interface ThreadValue {
  amount: number;
  currency?: string | null;
}

export function buildThreadValueLookup(
  quotes: Quote[],
  leads: PipelineCard[],
): Map<string, ThreadValue> {
  const map = new Map<string, ThreadValue>();

  for (const q of quotes) {
    const key = `${q.sessionId}:${q.chatId}`;
    const amt = q.totalAmount ?? 0;
    const existing = map.get(key);
    if (!existing || amt > existing.amount) {
      map.set(key, { amount: amt, currency: q.currency ?? existing?.currency });
    }
  }

  for (const lead of leads) {
    const budget = lead.budget;
    if (budget == null || budget <= 0) continue;
    const key = `${lead.sessionId}:${lead.chatId}`;
    const existing = map.get(key);
    if (!existing || budget > existing.amount) {
      map.set(key, { amount: budget, currency: existing?.currency });
    }
  }

  return map;
}

export function countWonToday(quotes: Quote[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return quotes.filter(q => {
    if (q.status !== 'accepted' && q.status !== 'converted_to_sale') return false;
    const updated = new Date(q.updatedAt);
    return updated >= start;
  }).length;
}

export function countWonTodayLeads(cards: PipelineCard[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return cards.filter(c => {
    const closed = c.closedAt ? new Date(c.closedAt) : null;
    return closed != null && !Number.isNaN(closed.getTime()) && closed >= start;
  }).length;
}

export function countLostTodayLeads(cards: PipelineCard[]): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return cards.filter(c => {
    const closed = c.closedAt ? new Date(c.closedAt) : null;
    return closed != null && !Number.isNaN(closed.getTime()) && closed >= start;
  }).length;
}

export function countAssignedConversations(
  conversations: Conversation[],
  staffId: string | null,
): Conversation[] {
  if (!staffId) return [];
  return conversations.filter(c => c.assignedStaffId === staffId && !c.resolved);
}

export function countUnreadAssigned(
  conversations: Conversation[],
  staffId: string | null,
): number {
  if (!staffId) return 0;
  return conversations
    .filter(c => c.assignedStaffId === staffId)
    .reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
}

export function buildQuoteSummary(quotes: Quote[]): QuoteSummary {
  const now = Date.now();
  let needsFollowup = 0;
  let totalQuotedValue = 0;

  const counts = { draft: 0, sent: 0, accepted: 0, rejected: 0, expired: 0 };

  for (const q of quotes) {
    if (q.status in counts) {
      counts[q.status as keyof typeof counts]++;
    }
    if (q.status === 'sent' || q.status === 'accepted') {
      totalQuotedValue += q.totalAmount ?? 0;
    }
    if (q.status === 'sent' && q.validUntil) {
      const due = new Date(q.validUntil).getTime();
      if (!Number.isNaN(due) && due < now) needsFollowup++;
    }
  }

  return { ...counts, needsFollowup, totalQuotedValue };
}

export type AiEscalationCard = {
  id: string;
  sessionId: string;
  chatId: string;
  reason: string;
  detail: string | null;
  createdAt: string;
  assignedStaffId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  displayName?: string | null;
  sessionName?: string | null;
};

export function escalationCustomerLabel(
  esc: AiEscalationCard,
  options?: { threadDisplay?: ThreadDisplayLookup; t?: TFunction },
): string {
  const hasApiIdentity = Boolean(
    esc.customerName?.trim() || esc.customerPhone?.trim() || esc.displayName?.trim(),
  );
  if (hasApiIdentity) {
    const fromApi = formatCustomerLabel(
      {
        chatId: esc.chatId,
        customerName: esc.customerName,
        customerPhone: esc.customerPhone,
        displayName: esc.displayName,
      },
      options?.t,
    );
    if (fromApi && fromApi !== esc.chatId) return fromApi;
  }

  const fromThread = options?.threadDisplay?.customerLabel(esc.sessionId, esc.chatId);
  if (fromThread && fromThread !== esc.chatId) return fromThread;

  return formatCustomerLabel(
    {
      chatId: esc.chatId,
      customerName: esc.customerName,
      customerPhone: esc.customerPhone,
      displayName: esc.displayName,
    },
    options?.t,
  );
}

export function escalationAccountLabel(
  esc: AiEscalationCard,
  options?: { threadDisplay?: ThreadDisplayLookup },
): string {
  return (
    esc.sessionName?.trim() ||
    options?.threadDisplay?.accountLabel(esc.sessionId) ||
    'WhatsApp'
  );
}

export function stockingReminderCustomerLabel(
  row: {
    productName?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    displayName?: string | null;
    sessionName?: string | null;
    createdAt?: string;
    id?: string;
  },
  options?: { threadDisplay?: ThreadDisplayLookup; t?: TFunction },
): string {
  if (row.productName?.trim()) return row.productName.trim();
  if (!row.sessionId || !row.chatId) return '—';
  return escalationCustomerLabel(
    {
      id: row.id ?? 'stocking',
      sessionId: row.sessionId,
      chatId: row.chatId,
      reason: '',
      detail: null,
      createdAt: row.createdAt ?? new Date(0).toISOString(),
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      displayName: row.displayName,
      sessionName: row.sessionName,
    },
    options,
  );
}

export function stockingReminderAccountLabel(
  row: { sessionId?: string | null; sessionName?: string | null },
  options?: { threadDisplay?: ThreadDisplayLookup },
): string {
  if (!row.sessionId) return '—';
  return (
    row.sessionName?.trim() ||
    options?.threadDisplay?.accountLabel(row.sessionId) ||
    'WhatsApp'
  );
}

/** Product demand rows must not include raw JIDs, session ids, or group-lead chatter. */
export function isUnusableProductInterestName(name: string): boolean {
  const n = name.trim();
  if (!n) return true;
  if (/^group lead:/i.test(n)) return true;
  if (/@(c|g|s|lid)\.us$/i.test(n)) return true;
  if (/^\d{12,}@/i.test(n)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n)) return true;
  return false;
}

export function escalationDetailToProductInterest(
  detail: string | null | undefined,
  reason: string,
): string | null {
  if (reason === 'group_lead') return null;
  const raw = detail?.trim();
  if (!raw || /^group lead:/i.test(raw) || isUnusableProductInterestName(raw)) return null;
  return raw;
}

export type ThreadDisplayLookup = {
  customerLabel: (sessionId: string, chatId: string) => string;
  accountLabel: (sessionId: string) => string;
};

export function buildThreadDisplayLookup(
  conversations: Array<{
    sessionId: string;
    chatId: string;
    customerName?: string | null;
    customerPhone?: string | null;
    displayName?: string | null;
    sessionName?: string | null;
  }>,
  sessions: Array<{ id: string; name?: string | null }>,
  t?: TFunction,
): ThreadDisplayLookup {
  const convMap = new Map(conversations.map(c => [`${c.sessionId}:${c.chatId}`, c]));
  const sessionMap = new Map(sessions.map(s => [s.id, s.name?.trim() || s.id]));

  return {
    customerLabel(sessionId, chatId) {
      const conv = convMap.get(`${sessionId}:${chatId}`);
      const enriched = conv
        ? enrichConversationIdentity({
            chatId,
            customerName: conv.customerName,
            customerPhone: conv.customerPhone,
            displayName: conv.displayName,
          })
        : { customerName: null, customerPhone: null };
      return formatCustomerLabel(
        {
          chatId,
          customerName: enriched.customerName,
          customerPhone: enriched.customerPhone,
          displayName: conv?.displayName ?? conv?.customerName,
        },
        t,
      );
    },
    accountLabel(sessionId) {
      const conv = conversations.find(c => c.sessionId === sessionId && c.sessionName?.trim());
      return conv?.sessionName?.trim() || sessionMap.get(sessionId) || sessionId;
    },
  };
}

export function buildThreadAssigneeMap(
  conversations: Array<{ sessionId: string; chatId: string; assignedStaffId?: string | null }>,
): Map<string, string | null | undefined> {
  const map = new Map<string, string | null | undefined>();
  for (const c of conversations) {
    map.set(`${c.sessionId}:${c.chatId}`, c.assignedStaffId);
  }
  return map;
}

/** Staff workspace: escalations assigned to them or on threads they own. */
export function filterAiEscalationsForStaff(
  escalations: AiEscalationCard[] | undefined,
  staffId: string | null | undefined,
  assigneeByThread: Map<string, string | null | undefined>,
): AiEscalationCard[] {
  if (!escalations?.length) return [];
  if (!staffId) return escalations;
  return escalations.filter(esc => {
    if (esc.assignedStaffId === staffId) return true;
    return assigneeByThread.get(`${esc.sessionId}:${esc.chatId}`) === staffId;
  });
}

/** Pipeline / dashboard: respect staff filter chip and non-admin viewer scope. */
export function scopeAiEscalationsForPipeline(
  escalations: AiEscalationCard[] | undefined,
  options: {
    staffFilterId?: string;
    viewerStaffId?: string | null;
    isAdmin?: boolean;
    assigneeByThread: Map<string, string | null | undefined>;
  },
): AiEscalationCard[] {
  if (!escalations?.length) return [];
  if (options.staffFilterId) {
    return escalations.filter(
      esc =>
        esc.assignedStaffId === options.staffFilterId ||
        options.assigneeByThread.get(`${esc.sessionId}:${esc.chatId}`) === options.staffFilterId,
    );
  }
  if (!options.isAdmin && options.viewerStaffId) {
    return filterAiEscalationsForStaff(
      escalations,
      options.viewerStaffId,
      options.assigneeByThread,
    );
  }
  return escalations;
}

export function isGroupLeadEscalation(esc: Pick<AiEscalationCard, 'reason' | 'detail'>): boolean {
  if (esc.reason === 'group_lead') return true;
  return /^group lead:/i.test(esc.detail?.trim() ?? '');
}

/** Prepends open AI escalations not already in the pipeline hot-leads bucket. */
export function mergeHotLeadsWithAiEscalations(
  leads: PipelineCard[],
  escalations: AiEscalationCard[] | undefined,
  options?: { threadDisplay?: ThreadDisplayLookup },
): { leads: PipelineCard[]; aiOnlyCount: number } {
  if (!escalations?.length) {
    return { leads, aiOnlyCount: 0 };
  }

  const existing = new Set(leads.map(l => `${l.sessionId}:${l.chatId}`));
  const extras: PipelineCard[] = [];

  for (const esc of escalations) {
    const key = `${esc.sessionId}:${esc.chatId}`;
    if (existing.has(key)) continue;
    existing.add(key);

    const isGroupLead = isGroupLeadEscalation(esc);
    const detail = esc.detail?.trim() ?? null;
    const customerName = escalationCustomerLabel(esc, options);
    const accountName = escalationAccountLabel(esc, options);

    extras.push({
      id: `ai-esc-${esc.id}`,
      sessionId: esc.sessionId,
      chatId: esc.chatId,
      customerName,
      customerPhone: null,
      customerHandle: null,
      source: isGroupLead ? 'whatsapp' : 'AI',
      channel: accountName,
      stage: isGroupLead ? 'group_lead' : 'ai_escalation',
      productInterest: isGroupLead
        ? null
        : escalationDetailToProductInterest(detail, esc.reason) ??
          esc.reason.replace(/_/g, ' '),
      priority: 'hot',
      lastCustomerMessageAt: esc.createdAt,
      lastStaffMessageAt: null,
      nextFollowupAt: null,
      nextAction: isGroupLead ? detail?.slice(0, 160) ?? null : null,
      assignedStaffId: esc.assignedStaffId ?? null,
      assignedStaffName: null,
      isManual: false,
      linkedSaleId: null,
      responseTimeSeconds: null,
    });
  }

  return { leads: [...extras, ...leads], aiOnlyCount: extras.length };
}

export function buildPipelineStages(
  pipelineCounts: Record<PipelineBucket, number> | undefined,
  pipelineDashboard: PipelineDashboardStats | undefined,
  options?: { hotLeadBoost?: number },
): PipelineStageDisplay[] {
  const counts = pipelineCounts ?? ({} as Record<PipelineBucket, number>);
  const byStage = pipelineDashboard?.leadsByStage ?? {};
  const hotLeadBoost = options?.hotLeadBoost ?? 0;

  const quoted =
    (byStage.price_sent ?? 0) + (byStage.product_suggested ?? 0);

  return [
    {
      id: 'new',
      labelKey: 'dashboard.controlRoom.pipeline.new',
      count: counts.new_leads ?? 0,
      linkTo: '/pipeline',
      bucket: 'new_leads',
    },
    {
      id: 'hot',
      labelKey: 'dashboard.controlRoom.pipeline.hot',
      count: (counts.hot_leads ?? 0) + hotLeadBoost,
      linkTo: '/pipeline',
      bucket: 'hot_leads',
    },
    {
      id: 'interested',
      labelKey: 'dashboard.controlRoom.pipeline.interested',
      count: (counts.waiting_reply ?? 0) + (counts.followup_needed ?? 0),
      linkTo: '/pipeline',
      bucket: 'waiting_reply',
    },
    {
      id: 'quoted',
      labelKey: 'dashboard.controlRoom.pipeline.quoted',
      count: quoted,
      linkTo: '/customers',
    },
    {
      id: 'payment',
      labelKey: 'dashboard.controlRoom.pipeline.waitingPayment',
      count: counts.payment_pending ?? pipelineDashboard?.paymentPending ?? 0,
      linkTo: '/pipeline',
      bucket: 'payment_pending',
    },
    {
      id: 'won',
      labelKey: 'dashboard.controlRoom.pipeline.won',
      count: counts.won_leads ?? pipelineDashboard?.wonLeads ?? 0,
      linkTo: '/pipeline',
      bucket: 'won_leads',
    },
    {
      id: 'lost',
      labelKey: 'dashboard.controlRoom.pipeline.lost',
      count: counts.lost_leads ?? pipelineDashboard?.lostLeads ?? 0,
      linkTo: '/pipeline',
      bucket: 'lost_leads',
    },
  ];
}

export function aggregateProductDemand(
  cards: PipelineCard[],
  quotes: Quote[],
): ProductDemandRow[] {
  const map = new Map<string, { requests: number; quotesCreated: number; wonCount: number }>();

  for (const card of cards) {
    const name = card.productInterest?.trim();
    if (!name || isUnusableProductInterestName(name)) continue;
    const entry = map.get(name) ?? { requests: 0, quotesCreated: 0, wonCount: 0 };
    entry.requests++;
    if (card.stage === 'won') entry.wonCount++;
    map.set(name, entry);
  }

  for (const quote of quotes) {
    for (const item of quote.items ?? []) {
      const name = item.itemName?.trim();
      if (!name) continue;
      const entry = map.get(name) ?? { requests: 0, quotesCreated: 0, wonCount: 0 };
      entry.quotesCreated++;
      map.set(name, entry);
    }
  }

  return [...map.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);
}

export function buildAttentionAlerts(input: {
  unreplied: Conversation[];
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  failedSends: number;
  disconnectedSessions: Session[];
  qrSessions: Session[];
  relinkSessions?: Session[];
  unassignedHotLeads: PipelineCard[];
  aiPaused: Conversation[];
  syncError?: string | null;
  quotesNeedingFollowup?: number;
  staffMissedFollowups?: number;
  storageWarnings?: Array<{ id: string; severity: 'high' | 'medium'; message: string }>;
  smsStatus?: {
    configured: boolean;
    connected: boolean;
    status: string;
    isEnabled: boolean;
    lowBalance: boolean;
    lastBalance: number | null;
    lastError: string | null;
  } | null;
  aiSignals?: {
    discountRequests: number;
    installmentRequests: number;
    paymentConfirmations: number;
    openEscalations: number;
    stockingReminders: number;
  } | null;
  learningAlerts?: {
    pendingCount: number;
    repeatedUnknownCount: number;
    urgentWaitingCustomers: number;
    staffCorrectionsWaiting: number;
  } | null;
  demandAlerts?: {
    draftCampaignsCount: number;
    approvedCampaignsCount?: number;
  } | null;
  profileAlerts?: {
    nameReview: number;
    learningReview: number;
    lostWaiting: number;
  } | null;
  whatsappSafety?: {
    blockedToday: number;
    pendingQueue: number;
    approvalRequired: number;
  } | null;
  linkSafetyNotReady?: Array<{
    sessionId: string;
    sessionName: string;
    issueCount: number;
    blockingOk: boolean;
  }>;
  t: (key: string, opts?: Record<string, unknown>) => string;
}): AttentionAlert[] {
  const alerts: AttentionAlert[] = [];

  const linkSafetyNotReady = input.linkSafetyNotReady ?? [];
  if (linkSafetyNotReady.length > 0) {
    const names = linkSafetyNotReady
      .slice(0, 3)
      .map(row => row.sessionName)
      .join(', ');
    alerts.push({
      id: 'link-safety-not-ready',
      severity: linkSafetyNotReady.some(row => !row.blockingOk) ? 'high' : 'medium',
      title: input.t('dashboard.controlRoom.alerts.linkSafetyNotReadyTitle'),
      description: input.t('dashboard.controlRoom.alerts.linkSafetyNotReadyDesc', {
        count: linkSafetyNotReady.length,
        names,
      }),
      channel: 'whatsapp',
      actionLabel: input.t('whatsappLinkSafety.bannerAction'),
      actionTo: whatsappSafetyTabHref('overview'),
    });
  }

  if (input.whatsappSafety && input.whatsappSafety.approvalRequired > 0) {
    alerts.push({
      id: 'wa-queue-approval',
      severity: 'medium',
      title: 'WhatsApp sends need approval',
      description: `${input.whatsappSafety.approvalRequired} queued message(s) require admin approval`,
      channel: 'whatsapp',
      actionLabel: 'Review queue',
      actionTo: whatsappSafetyTabHref('queue'),
    });
  }

  if (input.whatsappSafety && input.whatsappSafety.blockedToday > 0) {
    alerts.push({
      id: 'wa-blocked-sends',
      severity: 'medium',
      title: 'WhatsApp sends blocked today',
      description: `${input.whatsappSafety.blockedToday} outbound message(s) blocked by safety guard`,
      channel: 'whatsapp',
      actionLabel: 'View safety',
      actionTo: whatsappSafetyTabHref('activity'),
    });
  }

  if (input.whatsappSafety && input.whatsappSafety.pendingQueue > 10) {
    alerts.push({
      id: 'wa-queue-backlog',
      severity: 'medium',
      title: 'WhatsApp send queue backlog',
      description: `${input.whatsappSafety.pendingQueue} messages waiting in send queue`,
      channel: 'whatsapp',
      actionLabel: 'Open queue',
      actionTo: whatsappSafetyTabHref('queue'),
    });
  }

  if (input.unreplied.length > 0) {
    const top = input.unreplied[0];
    alerts.push({
      id: 'unreplied',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.unrepliedTitle'),
      description: input.t('dashboard.controlRoom.alerts.unrepliedDesc', {
        count: input.unreplied.length,
      }),
      accountName: top.sessionName,
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'needs_reply' },
    });
  }

  if ((input.queueCounts.overdue ?? 0) > 0) {
    alerts.push({
      id: 'overdue',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.overdueTitle'),
      description: input.t('dashboard.controlRoom.alerts.overdueDesc', {
        count: input.queueCounts.overdue,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewFollowups'),
      actionTo: '/followups',
      actionState: { filter: 'overdue' },
    });
  }

  if ((input.queueCounts.needs_approval ?? 0) > 0) {
    alerts.push({
      id: 'autopilot-approval',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.autopilotApprovalTitle'),
      description: input.t('dashboard.controlRoom.alerts.autopilotApprovalDesc', {
        count: input.queueCounts.needs_approval,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewFollowups'),
      actionTo: '/followups',
      actionState: { filter: 'needs_approval' },
    });
  }

  if (input.failedSends > 0) {
    alerts.push({
      id: 'failed-sends',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.failedSendsTitle'),
      description: input.t('dashboard.controlRoom.alerts.failedSendsDesc', {
        count: input.failedSends,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewLogs'),
      actionTo: '/logs',
    });
  }

  const relinkSessions = input.relinkSessions ?? [];
  if (relinkSessions.length > 1) {
    alerts.push({
      id: 'engine-relink-summary',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.engineRelinkSummaryTitle'),
      description: input.t('dashboard.controlRoom.alerts.engineRelinkSummaryDesc', {
        count: relinkSessions.length,
        names: relinkSessions
          .slice(0, 3)
          .map(s => s.name)
          .join(', '),
      }),
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.openChannels'),
      actionTo: channelsUrl({ channel: 'whatsapp' }),
    });
  }
  for (const s of relinkSessions.slice(0, relinkSessions.length > 1 ? 0 : 3)) {
    alerts.push({
      id: `engine-relink-${s.id}`,
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.engineRelinkTitle'),
      description: input.t('dashboard.controlRoom.alerts.engineRelinkDesc', { name: s.name }),
      accountName: s.name,
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.scanQr'),
      actionTo: channelsUrl({ channel: 'whatsapp', sessionFocus: s.id, reconnect: true }),
    });
  }

  for (const s of input.disconnectedSessions.slice(0, 3)) {
    alerts.push({
      id: `disconnected-${s.id}`,
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.disconnectedTitle'),
      description: input.t('dashboard.controlRoom.alerts.disconnectedDesc', { name: s.name }),
      accountName: s.name,
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.openChannels'),
      actionTo: channelsUrl({ channel: 'whatsapp', sessionFocus: s.id, reconnect: true }),
    });
  }

  for (const s of input.qrSessions.slice(0, 2)) {
    alerts.push({
      id: `qr-${s.id}`,
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.qrTitle'),
      description: input.t('dashboard.controlRoom.alerts.qrDesc', { name: s.name }),
      accountName: s.name,
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.scanQr'),
      actionTo: channelsUrl({ channel: 'whatsapp', sessionFocus: s.id, reconnect: true }),
    });
  }

  if (input.unassignedHotLeads.length > 0) {
    alerts.push({
      id: 'unassigned-hot',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.unassignedHotTitle'),
      description: input.t('dashboard.controlRoom.alerts.unassignedHotDesc', {
        count: input.unassignedHotLeads.length,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.assignStaff'),
      actionTo: '/pipeline',
    });
  }

  if (input.aiPaused.length > 0) {
    alerts.push({
      id: 'ai-paused',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.aiPausedTitle'),
      description: input.t('dashboard.controlRoom.alerts.aiPausedDesc', {
        count: input.aiPaused.length,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'needs_human' },
    });
  }

  const signals = input.aiSignals;
  if (signals && signals.openEscalations > 0) {
    alerts.push({
      id: 'ai-escalations',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.aiEscalationsTitle'),
      description: input.t('dashboard.controlRoom.alerts.aiEscalationsDesc', {
        count: signals.openEscalations,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'needs_human' },
    });
  }
  if (signals && signals.discountRequests > 0) {
    alerts.push({
      id: 'ai-discount-requests',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.aiDiscountTitle'),
      description: input.t('dashboard.controlRoom.alerts.aiDiscountDesc', {
        count: signals.discountRequests,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openPipeline'),
      actionTo: '/pipeline',
    });
  }
  if (signals && signals.installmentRequests > 0) {
    alerts.push({
      id: 'ai-installment-requests',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.aiInstallmentTitle'),
      description: input.t('dashboard.controlRoom.alerts.aiInstallmentDesc', {
        count: signals.installmentRequests,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openPipeline'),
      actionTo: '/pipeline',
    });
  }
  if (signals && signals.paymentConfirmations > 0) {
    alerts.push({
      id: 'ai-payment-confirmations',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.aiPaymentTitle'),
      description: input.t('dashboard.controlRoom.alerts.aiPaymentDesc', {
        count: signals.paymentConfirmations,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'payment_pending' },
    });
  }
  if (signals && signals.stockingReminders > 0) {
    alerts.push({
      id: 'ai-stocking-reminders',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.aiStockingTitle'),
      description: input.t('dashboard.controlRoom.alerts.aiStockingDesc', {
        count: signals.stockingReminders,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewProducts'),
      actionTo: '/products',
    });
  }

  const learning = input.learningAlerts;
  if (learning && learning.pendingCount > 0) {
    alerts.push({
      id: 'ai-learning-pending',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.aiLearningPendingTitle', {
        defaultValue: 'AI learning pending review',
      }),
      description: input.t('dashboard.controlRoom.alerts.aiLearningPendingDesc', {
        count: learning.pendingCount,
        defaultValue: '{{count}} unknown questions need admin review',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openAiLearning', {
        defaultValue: 'Open AI Learning',
      }),
      actionTo: settingsPanelHref('ai-learning'),
    });
  }
  if (learning && learning.repeatedUnknownCount > 0) {
    alerts.push({
      id: 'repeated-unknown',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.repeatedUnknownTitle', {
        defaultValue: 'Repeated unknown questions',
      }),
      description: input.t('dashboard.controlRoom.alerts.repeatedUnknownDesc', {
        count: learning.repeatedUnknownCount,
        defaultValue: '{{count}} questions asked 3+ times',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openAiLearning', {
        defaultValue: 'Teach AI',
      }),
      actionTo: settingsPanelHref('ai-learning'),
    });
  }
  if (learning && learning.urgentWaitingCustomers > 0) {
    alerts.push({
      id: 'urgent-waiting',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.urgentWaitingTitle', {
        defaultValue: 'Customers waiting for answer',
      }),
      description: input.t('dashboard.controlRoom.alerts.urgentWaitingDesc', {
        count: learning.urgentWaitingCustomers,
        defaultValue: '{{count}} chats waiting for human reply',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'needs_human' },
    });
  }
  const demand = input.demandAlerts;
  if (demand && demand.draftCampaignsCount > 0) {
    alerts.push({
      id: 'demand-campaigns-draft',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.draftCampaignsTitle'),
      description: input.t('dashboard.controlRoom.alerts.draftCampaignsDesc', {
        count: demand.draftCampaignsCount,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openCampaigns'),
      actionTo: '/campaigns',
    });
  }

  if (demand && (demand.approvedCampaignsCount ?? 0) > 0) {
    alerts.push({
      id: 'demand-campaigns-approved',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.approvedCampaignsTitle', {
        defaultValue: 'WhatsApp campaigns approved to send',
      }),
      description: input.t('dashboard.controlRoom.alerts.approvedCampaignsDesc', {
        count: demand.approvedCampaignsCount,
        defaultValue: '{{count}} campaign(s) passed preflight — confirm send on Campaigns',
      }),
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.openCampaigns'),
      actionTo: '/campaigns',
    });
  }

  if (learning && learning.staffCorrectionsWaiting > 0) {
    alerts.push({
      id: 'staff-corrections',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.staffCorrectionsTitle', {
        defaultValue: 'Staff corrections waiting review',
      }),
      description: input.t('dashboard.controlRoom.alerts.staffCorrectionsDesc', {
        count: learning.staffCorrectionsWaiting,
        defaultValue: '{{count}} staff-edited AI replies to review',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openAiLearning', {
        defaultValue: 'Review suggestions',
      }),
      actionTo: settingsPanelHref('ai-learning'),
    });
  }

  const profile = input.profileAlerts;
  if (profile && profile.nameReview > 0) {
    alerts.push({
      id: 'profile-name-review',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.profileNameReviewTitle', {
        defaultValue: 'Customer names need review',
      }),
      description: input.t('dashboard.controlRoom.alerts.profileNameReviewDesc', {
        count: profile.nameReview,
        defaultValue: '{{count}} AI-detected names need staff approval',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openCustomers', {
        defaultValue: 'Open Customers',
      }),
      actionTo: '/customers',
    });
  }
  if (profile && profile.learningReview > 0) {
    alerts.push({
      id: 'profile-learning-review',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.profileLearningReviewTitle', {
        defaultValue: 'Profile learning needs review',
      }),
      description: input.t('dashboard.controlRoom.alerts.profileLearningReviewDesc', {
        count: profile.learningReview,
        defaultValue: '{{count}} profile field updates need review',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openCustomers', {
        defaultValue: 'Open Customers',
      }),
      actionTo: '/customers',
    });
  }
  if (profile && profile.lostWaiting > 0) {
    alerts.push({
      id: 'lost-demand-waiting',
      severity: 'high',
      title: input.t('dashboard.controlRoom.alerts.lostDemandWaitingTitle', {
        defaultValue: 'Customers waiting for stock',
      }),
      description: input.t('dashboard.controlRoom.alerts.lostDemandWaitingDesc', {
        count: profile.lostWaiting,
        defaultValue: '{{count}} customers asked to be notified when product is available',
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewFollowups', {
        defaultValue: 'View Follow-ups',
      }),
      actionTo: '/followups',
    });
  }

  const sms = input.smsStatus;
  if (sms?.configured) {
    if (sms.status === 'failed') {
      alerts.push({
        id: 'sms-failed',
        severity: 'high',
        title: input.t('dashboard.controlRoom.alerts.smsFailedTitle'),
        description: sms.lastError
          ? input.t('dashboard.controlRoom.alerts.smsFailedDesc', { error: sms.lastError })
          : input.t('dashboard.controlRoom.alerts.smsFailedDescGeneric'),
        channel: 'sms',
        actionLabel: input.t('dashboard.controlRoom.actions.openSmsSettings'),
        actionTo: channelsUrl({ channel: 'sms' }),
      });
    } else if (sms.lowBalance || sms.status === 'low_balance') {
      alerts.push({
        id: 'sms-low-balance',
        severity: 'medium',
        title: input.t('dashboard.controlRoom.alerts.smsLowBalanceTitle'),
        description:
          sms.lastBalance != null
            ? input.t('dashboard.controlRoom.alerts.smsLowBalanceDesc', { balance: sms.lastBalance })
            : input.t('dashboard.controlRoom.alerts.smsLowBalanceDescGeneric'),
        channel: 'sms',
        actionLabel: input.t('dashboard.controlRoom.actions.openSmsSettings'),
        actionTo: channelsUrl({ channel: 'sms' }),
      });
    } else if (sms.isEnabled && !sms.connected && sms.status === 'not_connected') {
      alerts.push({
        id: 'sms-not-connected',
        severity: 'medium',
        title: input.t('dashboard.controlRoom.alerts.smsNotConnectedTitle'),
        description: input.t('dashboard.controlRoom.alerts.smsNotConnectedDesc'),
        channel: 'sms',
        actionLabel: input.t('dashboard.controlRoom.actions.openSmsSettings'),
        actionTo: channelsUrl({ channel: 'sms', add: true }),
      });
    } else if (sms.status === 'disabled') {
      alerts.push({
        id: 'sms-disabled',
        severity: 'medium',
        title: input.t('dashboard.controlRoom.alerts.smsDisabledTitle'),
        description: input.t('dashboard.controlRoom.alerts.smsDisabledDesc'),
        channel: 'sms',
        actionLabel: input.t('dashboard.controlRoom.actions.openSmsSettings'),
        actionTo: channelsUrl({ channel: 'sms' }),
      });
    }
  }

  if (input.syncError) {
    alerts.push({
      id: 'sync-fail',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.syncFailTitle'),
      description: input.syncError,
      actionLabel: input.t('dashboard.controlRoom.actions.productSettings'),
      actionTo: settingsPanelHref('products'),
    });
  }

  if ((input.quotesNeedingFollowup ?? 0) > 0) {
    alerts.push({
      id: 'quotes-followup',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.quotesFollowupTitle'),
      description: input.t('dashboard.controlRoom.alerts.quotesFollowupDesc', {
        count: input.quotesNeedingFollowup,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewQuotes'),
      actionTo: '/quotes',
    });
  }

  if ((input.staffMissedFollowups ?? 0) > 0) {
    alerts.push({
      id: 'staff-missed',
      severity: 'medium',
      title: input.t('dashboard.controlRoom.alerts.staffMissedTitle'),
      description: input.t('dashboard.controlRoom.alerts.staffMissedDesc', {
        count: input.staffMissedFollowups,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewReports'),
      actionTo: '/reports?section=staff',
    });
  }

  for (const warning of input.storageWarnings ?? []) {
    alerts.push({
      id: `storage-${warning.id}`,
      severity: warning.severity,
      title: storageAttentionTitle(input.t),
      description: translateStorageWarning(warning, input.t),
      actionLabel: storageAttentionAction(input.t),
      actionTo: '/settings/storage-backup',
    });
  }

  return alerts.slice(0, 8);
}

export function buildStaffAttentionAlerts(input: {
  unreplied: Conversation[];
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  assignedUnread: number;
  aiEscalations?: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
}): AttentionAlert[] {
  const alerts: AttentionAlert[] = [];

  if (input.unreplied.length > 0) {
    const top = input.unreplied[0];
    alerts.push({
      id: 'my-unreplied',
      severity: 'high',
      title: input.t('dashboard.myWorkspace.alerts.unrepliedTitle'),
      description: input.t('dashboard.myWorkspace.alerts.unrepliedDesc', {
        count: input.unreplied.length,
      }),
      accountName: top.sessionName,
      channel: 'whatsapp',
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'assigned_to_me' },
    });
  }

  if (input.assignedUnread > 0) {
    alerts.push({
      id: 'my-unread',
      severity: 'high',
      title: input.t('dashboard.myWorkspace.alerts.unreadTitle'),
      description: input.t('dashboard.myWorkspace.alerts.unreadDesc', {
        count: input.assignedUnread,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'unread' },
    });
  }

  if ((input.queueCounts.overdue ?? 0) > 0) {
    alerts.push({
      id: 'my-overdue',
      severity: 'high',
      title: input.t('dashboard.myWorkspace.alerts.overdueTitle'),
      description: input.t('dashboard.myWorkspace.alerts.overdueDesc', {
        count: input.queueCounts.overdue,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewFollowups'),
      actionTo: '/followups',
      actionState: { filter: 'overdue', view: 'my' },
    });
  }

  if ((input.queueCounts.due_today ?? 0) > 0) {
    alerts.push({
      id: 'my-due-today',
      severity: 'medium',
      title: input.t('dashboard.myWorkspace.alerts.dueTodayTitle'),
      description: input.t('dashboard.myWorkspace.alerts.dueTodayDesc', {
        count: input.queueCounts.due_today,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewFollowups'),
      actionTo: '/followups',
      actionState: { filter: 'due_today', view: 'my' },
    });
  }

  if ((input.queueCounts.payment_pending ?? 0) > 0) {
    alerts.push({
      id: 'my-payment',
      severity: 'medium',
      title: input.t('dashboard.myWorkspace.alerts.paymentTitle'),
      description: input.t('dashboard.myWorkspace.alerts.paymentDesc', {
        count: input.queueCounts.payment_pending,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.viewFollowups'),
      actionTo: '/followups',
      actionState: { filter: 'payment_pending', view: 'my' },
    });
  }

  if ((input.aiEscalations ?? 0) > 0) {
    alerts.push({
      id: 'my-ai-escalations',
      severity: 'high',
      title: input.t('dashboard.myWorkspace.alerts.aiEscalationsTitle'),
      description: input.t('dashboard.myWorkspace.alerts.aiEscalationsDesc', {
        count: input.aiEscalations,
      }),
      actionLabel: input.t('dashboard.controlRoom.actions.openInbox'),
      actionTo: '/inbox',
      actionState: { filter: 'needs_human' },
    });
  }

  return alerts.slice(0, 8);
}

export function buildKpis(input: {
  unread: number;
  overview?: OverviewStats;
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  pipelineCounts?: Record<PipelineBucket, number>;
  quotes: Quote[];
  sessionStats?: SessionStats;
  wonToday: number;
  hotLeadBoost?: number;
}): DashboardKpi[] {
  const overview = input.overview;
  const messagesToday = overview?.messages.today.received ?? 0;
  const messagesTotal = overview?.messages.today.total ?? 0;
  const failed = overview?.messages.failed ?? 0;
  const ready = input.sessionStats?.ready ?? 0;
  const disconnected = input.sessionStats?.disconnected ?? 0;
  const hotLeads =
    (input.queueCounts.hot_leads ?? input.pipelineCounts?.hot_leads ?? 0) +
    (input.hotLeadBoost ?? 0);
  const quotesSent = input.quotes.filter(q => q.status === 'sent').length;

  return [
    {
      id: 'unread',
      titleKey: 'dashboard.controlRoom.kpi.unread',
      helperKey: 'dashboard.controlRoom.kpi.unreadHelper',
      value: input.unread,
      severity: input.unread > 0 ? 'warning' : 'neutral',
      icon: MessageSquare,
      linkTo: '/inbox',
      linkState: { filter: 'unread' },
      priority: true,
    },
    {
      id: 'new-messages',
      titleKey: 'dashboard.controlRoom.kpi.newMessages',
      helperKey: 'dashboard.controlRoom.kpi.newMessagesHelper',
      value: messagesToday,
      trend: messagesTotal > 0 ? String(messagesTotal) : undefined,
      trendUp: messagesToday > 0 ? true : null,
      severity: 'neutral',
      icon: Mail,
      linkTo: '/inbox',
      priority: false,
    },
    {
      id: 'overdue',
      titleKey: 'dashboard.controlRoom.kpi.overdue',
      helperKey: 'dashboard.controlRoom.kpi.overdueHelper',
      value: input.queueCounts.overdue ?? 0,
      severity: (input.queueCounts.overdue ?? 0) > 0 ? 'danger' : 'neutral',
      icon: AlertTriangle,
      linkTo: '/followups',
      linkState: { filter: 'overdue' },
      priority: true,
    },
    {
      id: 'due-today',
      titleKey: 'dashboard.controlRoom.kpi.dueToday',
      helperKey: 'dashboard.controlRoom.kpi.dueTodayHelper',
      value: input.queueCounts.due_today ?? 0,
      severity: (input.queueCounts.due_today ?? 0) > 0 ? 'warning' : 'neutral',
      icon: Clock,
      linkTo: '/followups',
      linkState: { filter: 'due_today' },
      priority: false,
    },
    {
      id: 'waiting-payment',
      titleKey: 'dashboard.controlRoom.kpi.waitingPayment',
      helperKey: 'dashboard.controlRoom.kpi.waitingPaymentHelper',
      value: input.queueCounts.payment_pending ?? 0,
      severity: (input.queueCounts.payment_pending ?? 0) > 0 ? 'warning' : 'neutral',
      icon: CreditCard,
      linkTo: '/followups',
      linkState: { filter: 'payment_pending' },
      priority: true,
    },
    {
      id: 'hot-leads',
      titleKey: 'dashboard.controlRoom.kpi.hotLeads',
      helperKey: 'dashboard.controlRoom.kpi.hotLeadsHelper',
      value: hotLeads,
      severity: hotLeads > 0 ? 'hot' : 'neutral',
      icon: Flame,
      linkTo: '/pipeline',
      priority: true,
    },
    {
      id: 'quotes-sent',
      titleKey: 'dashboard.controlRoom.kpi.quotesSent',
      helperKey: 'dashboard.controlRoom.kpi.quotesSentHelper',
      value: quotesSent,
      severity: 'neutral',
      icon: FileText,
      linkTo: '/pipeline',
      priority: false,
    },
    {
      id: 'won-today',
      titleKey: 'dashboard.controlRoom.kpi.wonToday',
      helperKey: 'dashboard.controlRoom.kpi.wonTodayHelper',
      value: input.wonToday > 0 ? input.wonToday : '—',
      severity: input.wonToday > 0 ? 'success' : 'neutral',
      icon: Trophy,
      linkTo: '/pipeline',
      priority: false,
    },
    {
      id: 'failed-sends',
      titleKey: 'dashboard.controlRoom.kpi.failedSends',
      helperKey: 'dashboard.controlRoom.kpi.failedSendsHelper',
      value: failed,
      severity: failed > 0 ? 'danger' : 'neutral',
      icon: XCircle,
      linkTo: '/logs',
      priority: false,
    },
    {
      id: 'connected',
      titleKey: 'dashboard.controlRoom.kpi.connected',
      helperKey: disconnected > 0
        ? 'dashboard.controlRoom.kpi.disconnectedHelper'
        : 'dashboard.controlRoom.kpi.connectedHelper',
      value: ready,
      trend: ready > 0 ? `+${ready}` : undefined,
      trendUp: ready > 0 ? true : null,
      severity: ready > 0 ? 'success' : 'danger',
      icon: Smartphone,
      linkTo: '/channels',
      priority: true,
    },
  ];
}

export function buildAdminKpis(input: {
  unread: number;
  overview?: OverviewStats;
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  pipelineCounts?: Record<PipelineBucket, number>;
  quotes: Quote[];
  sessionStats?: SessionStats;
  wonToday: number;
  lostToday: number;
  qrNeeded: number;
  disconnected: number;
  engineRelinkNeeded?: number;
  linkSafetyNotReady?: number;
  aiSignals?: {
    discountRequests: number;
    installmentRequests: number;
    paymentConfirmations: number;
    openEscalations: number;
    stockingReminders: number;
  } | null;
  hotLeadBoost?: number;
}): DashboardKpi[] {
  const base = buildKpis({
    unread: input.unread,
    overview: input.overview,
    queueCounts: input.queueCounts,
    pipelineCounts: input.pipelineCounts,
    quotes: input.quotes,
    sessionStats: input.sessionStats,
    wonToday: input.wonToday,
    hotLeadBoost: input.hotLeadBoost,
  });

  const signals = input.aiSignals;
  const signalKpis: DashboardKpi[] = [];
  if (signals && signals.openEscalations > 0) {
    signalKpis.push({
      id: 'ai-escalations',
      titleKey: 'dashboard.controlRoom.kpi.aiEscalations',
      helperKey: 'dashboard.controlRoom.kpi.aiEscalationsHelper',
      value: signals.openEscalations,
      severity: 'danger',
      icon: AlertTriangle,
      linkTo: '/inbox',
      linkState: { filter: 'needs_human' },
      priority: true,
    });
  }
  if (signals && signals.discountRequests > 0) {
    signalKpis.push({
      id: 'ai-discounts',
      titleKey: 'dashboard.controlRoom.kpi.aiDiscounts',
      value: signals.discountRequests,
      severity: 'warning',
      icon: Flame,
      linkTo: '/pipeline',
      priority: false,
    });
  }
  if (signals && signals.installmentRequests > 0) {
    signalKpis.push({
      id: 'ai-installments',
      titleKey: 'dashboard.controlRoom.kpi.aiInstallments',
      value: signals.installmentRequests,
      severity: 'hot',
      icon: Flame,
      linkTo: '/pipeline',
      priority: true,
    });
  }
  if (signals && signals.paymentConfirmations > 0) {
    signalKpis.push({
      id: 'ai-payments',
      titleKey: 'dashboard.controlRoom.kpi.aiPayments',
      value: signals.paymentConfirmations,
      severity: 'warning',
      icon: CreditCard,
      linkTo: '/inbox',
      priority: true,
    });
  }
  if (signals && signals.stockingReminders > 0) {
    signalKpis.push({
      id: 'ai-stocking',
      titleKey: 'dashboard.controlRoom.kpi.aiStocking',
      value: signals.stockingReminders,
      severity: 'warning',
      icon: Package,
      linkTo: '/products',
      priority: false,
    });
  }

  const extra: DashboardKpi[] = [...signalKpis];
  if ((input.engineRelinkNeeded ?? 0) > 0) {
    extra.push({
      id: 'engine-relink',
      titleKey: 'dashboard.controlRoom.kpi.engineRelink',
      helperKey: 'dashboard.controlRoom.kpi.engineRelinkHelper',
      value: input.engineRelinkNeeded!,
      severity: 'danger',
      icon: Smartphone,
      linkTo: channelsUrl({ channel: 'whatsapp' }),
      priority: true,
    });
  }
  if ((input.linkSafetyNotReady ?? 0) > 0) {
    extra.push({
      id: 'link-safety-not-ready',
      titleKey: 'dashboard.controlRoom.kpi.linkSafetyNotReady',
      helperKey: 'dashboard.controlRoom.kpi.linkSafetyNotReadyHelper',
      value: input.linkSafetyNotReady!,
      severity: 'warning',
      icon: ShieldCheck,
      linkTo: settingsPanelHref('whatsapp-safety', { waTab: 'overview' }),
      priority: true,
    });
  }
  extra.push(
    {
      id: 'lost-today',
      titleKey: 'dashboard.controlRoom.kpi.lostToday',
      helperKey: 'dashboard.controlRoom.kpi.lostTodayHelper',
      value: input.lostToday > 0 ? input.lostToday : '—',
      severity: input.lostToday > 0 ? 'danger' : 'neutral',
      icon: XCircle,
      linkTo: '/reports?section=pipeline',
      priority: false,
    },
    {
      id: 'qr-needed',
      titleKey: 'dashboard.controlRoom.kpi.qrNeeded',
      helperKey: 'dashboard.controlRoom.kpi.qrNeededHelper',
      value: input.qrNeeded,
      severity: input.qrNeeded > 0 ? 'warning' : 'neutral',
      icon: Smartphone,
      linkTo: '/channels',
      priority: input.qrNeeded > 0,
    },
    {
      id: 'disconnected',
      titleKey: 'dashboard.controlRoom.kpi.disconnected',
      helperKey: 'dashboard.controlRoom.kpi.disconnectedHelper',
      value: input.disconnected,
      severity: input.disconnected > 0 ? 'danger' : 'neutral',
      icon: XCircle,
      linkTo: '/channels',
      priority: input.disconnected > 0,
    },
  );

  return [...base, ...extra];
}

export function buildStaffKpis(input: {
  assignedCount: number;
  unreadAssigned: number;
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  pipelineCounts?: Record<PipelineBucket, number>;
  wonToday: number;
  followupsCompleted: number;
  missedTasks: number;
  repliesToday: number;
  hotLeadBoost?: number;
  myAiEscalations?: number;
}): DashboardKpi[] {
  const hotLeads =
    (input.queueCounts.hot_leads ?? input.pipelineCounts?.hot_leads ?? 0) +
    (input.hotLeadBoost ?? 0);

  return [
    {
      id: 'assigned',
      titleKey: 'dashboard.myWorkspace.kpi.assigned',
      helperKey: 'dashboard.myWorkspace.kpi.assignedHelper',
      value: input.assignedCount,
      severity: input.assignedCount > 0 ? 'warning' : 'neutral',
      icon: MessageSquare,
      linkTo: '/inbox',
      linkState: { filter: 'assigned_to_me' },
      priority: true,
    },
    {
      id: 'unread-assigned',
      titleKey: 'dashboard.myWorkspace.kpi.unreadAssigned',
      value: input.unreadAssigned,
      severity: input.unreadAssigned > 0 ? 'warning' : 'neutral',
      icon: Mail,
      linkTo: '/inbox',
      linkState: { filter: 'unread' },
      priority: true,
    },
    {
      id: 'due-followups',
      titleKey: 'dashboard.myWorkspace.kpi.dueFollowups',
      value: input.queueCounts.due_today ?? 0,
      severity: (input.queueCounts.due_today ?? 0) > 0 ? 'warning' : 'neutral',
      icon: Clock,
      linkTo: '/followups',
      linkState: { filter: 'due_today', view: 'my' },
      priority: true,
    },
    {
      id: 'overdue-followups',
      titleKey: 'dashboard.myWorkspace.kpi.overdueFollowups',
      value: input.queueCounts.overdue ?? 0,
      severity: (input.queueCounts.overdue ?? 0) > 0 ? 'danger' : 'neutral',
      icon: AlertTriangle,
      linkTo: '/followups',
      linkState: { filter: 'overdue', view: 'my' },
      priority: true,
    },
    {
      id: 'waiting-payment',
      titleKey: 'dashboard.myWorkspace.kpi.waitingPayment',
      value: input.queueCounts.payment_pending ?? 0,
      severity: (input.queueCounts.payment_pending ?? 0) > 0 ? 'warning' : 'neutral',
      icon: CreditCard,
      linkTo: '/followups',
      linkState: { filter: 'payment_pending', view: 'my' },
      priority: true,
    },
    {
      id: 'hot-leads',
      titleKey: 'dashboard.myWorkspace.kpi.hotLeads',
      value: hotLeads,
      severity: hotLeads > 0 ? 'hot' : 'neutral',
      icon: Flame,
      linkTo: '/customers',
      priority: true,
    },
    ...((input.myAiEscalations ?? 0) > 0
      ? [
          {
            id: 'ai-escalations',
            titleKey: 'dashboard.controlRoom.kpi.aiEscalations',
            helperKey: 'dashboard.controlRoom.kpi.aiEscalationsHelper',
            value: input.myAiEscalations!,
            severity: 'danger' as const,
            icon: AlertTriangle,
            linkTo: '/inbox',
            linkState: { filter: 'needs_human' },
            priority: true,
          },
        ]
      : []),
    {
      id: 'replies-today',
      titleKey: 'dashboard.myWorkspace.kpi.repliesToday',
      value: input.repliesToday > 0 ? input.repliesToday : '—',
      severity: 'neutral',
      icon: MessageSquare,
      linkTo: '/inbox',
      priority: false,
    },
    {
      id: 'completed-followups',
      titleKey: 'dashboard.myWorkspace.kpi.completedFollowups',
      value: input.followupsCompleted,
      severity: 'success',
      icon: Trophy,
      linkTo: '/followups',
      priority: false,
    },
    {
      id: 'won-today',
      titleKey: 'dashboard.myWorkspace.kpi.wonToday',
      value: input.wonToday > 0 ? input.wonToday : '—',
      severity: input.wonToday > 0 ? 'success' : 'neutral',
      icon: Trophy,
      linkTo: '/customers',
      priority: false,
    },
    {
      id: 'missed-tasks',
      titleKey: 'dashboard.myWorkspace.kpi.missedTasks',
      value: input.missedTasks,
      severity: input.missedTasks > 0 ? 'danger' : 'neutral',
      icon: XCircle,
      linkTo: '/followups',
      linkState: { view: 'my' },
      priority: true,
    },
  ];
}

function followupSegments(
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>,
): DashboardCompoundSegment[] {
  const overdue = queueCounts.overdue ?? 0;
  const dueToday = queueCounts.due_today ?? 0;
  const payment = queueCounts.payment_pending ?? 0;
  return [
    {
      id: 'overdue',
      labelKey: 'dashboard.controlRoom.kpi.overdue',
      value: overdue,
      severity: overdue > 0 ? 'danger' : 'neutral',
    },
    {
      id: 'due-today',
      labelKey: 'dashboard.controlRoom.kpi.dueToday',
      value: dueToday,
      severity: dueToday > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'waiting-payment',
      labelKey: 'dashboard.controlRoom.kpi.waitingPayment',
      value: payment,
      severity: payment > 0 ? 'warning' : 'neutral',
    },
  ];
}

export function buildAdminCompoundKpis(input: {
  unread: number;
  overview?: OverviewStats;
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  sessionStats?: SessionStats;
  ready: number;
  qrNeeded: number;
  disconnected: number;
  failedSends: number;
  engineRelinkNeeded?: number;
}): DashboardCompoundKpi[] {
  const received = input.overview?.messages.today.received ?? 0;
  const sent = input.overview?.messages.today.sent ?? 0;

  const followupSegs = followupSegments(input.queueCounts);
  const followupTotal = followupSegs.reduce((sum, s) => sum + s.value, 0);

  const channelIssues =
    input.qrNeeded + input.disconnected + input.failedSends + (input.engineRelinkNeeded ?? 0);
  const channelSegs: DashboardCompoundSegment[] = [
    {
      id: 'connected',
      labelKey: 'dashboard.controlRoom.compound.connected',
      value: input.ready,
      severity: input.ready > 0 ? 'success' : 'danger',
    },
  ];
  if (input.qrNeeded > 0 || input.engineRelinkNeeded) {
    channelSegs.push({
      id: 'qr-needed',
      labelKey: 'dashboard.controlRoom.kpi.qrNeeded',
      value: input.qrNeeded + (input.engineRelinkNeeded ?? 0),
      severity: 'warning',
    });
  }
  if (input.disconnected > 0) {
    channelSegs.push({
      id: 'disconnected',
      labelKey: 'dashboard.controlRoom.kpi.disconnected',
      value: input.disconnected,
      severity: 'danger',
    });
  }
  if (input.failedSends > 0) {
    channelSegs.push({
      id: 'failed-sends',
      labelKey: 'dashboard.controlRoom.kpi.failedSends',
      value: input.failedSends,
      severity: 'danger',
    });
  }

  return [
    {
      id: 'inbox',
      titleKey: 'dashboard.controlRoom.compound.inbox',
      icon: MessageSquare,
      severity: input.unread > 0 ? 'warning' : 'neutral',
      linkTo: '/inbox',
      linkState: { filter: 'unread' },
      primaryValue: input.unread,
      primaryLabelKey: 'dashboard.controlRoom.compound.unread',
      secondaryValue: received,
      secondaryLabelKey: 'dashboard.controlRoom.compound.receivedToday',
      tabs: ['overview', 'today'],
    },
    {
      id: 'activity',
      titleKey: 'dashboard.controlRoom.compound.activity',
      helperKey: 'dashboard.controlRoom.compound.activityHelper',
      icon: Mail,
      severity: 'neutral',
      linkTo: '/inbox',
      primaryValue: received + sent,
      primaryLabelKey: 'dashboard.controlRoom.compound.messagesToday',
      activityBars: [
        {
          id: 'received',
          labelKey: 'dashboard.controlRoom.compound.received',
          value: received,
          tone: 'received',
        },
        {
          id: 'sent',
          labelKey: 'dashboard.controlRoom.compound.sent',
          value: sent,
          tone: 'sent',
        },
      ],
      tabs: ['overview'],
    },
    {
      id: 'followups',
      titleKey: 'dashboard.controlRoom.compound.followups',
      helperKey: followupTotal === 0 ? 'dashboard.controlRoom.compound.followupsClear' : undefined,
      icon: Clock,
      severity:
        (input.queueCounts.overdue ?? 0) > 0
          ? 'danger'
          : followupTotal > 0
            ? 'warning'
            : 'neutral',
      linkTo: '/followups',
      linkState: (input.queueCounts.overdue ?? 0) > 0 ? { filter: 'overdue' } : { filter: 'due_today' },
      primaryValue: followupTotal,
      primaryLabelKey: 'dashboard.controlRoom.compound.followupsTotal',
      segments: followupSegs,
      allClear: followupTotal === 0,
      tabs: ['overview', 'today'],
    },
    {
      id: 'channels',
      titleKey: 'dashboard.controlRoom.compound.channels',
      helperKey:
        channelIssues === 0
          ? 'dashboard.controlRoom.compound.channelsHealthy'
          : 'dashboard.controlRoom.compound.channelsIssues',
      icon: Smartphone,
      severity:
        channelIssues > 0 ? 'danger' : input.ready > 0 ? 'success' : 'danger',
      linkTo: channelIssues > 0 && input.failedSends > 0 ? '/logs' : '/channels',
      primaryValue: input.ready,
      primaryLabelKey: 'dashboard.controlRoom.compound.accountsOnline',
      segments: channelSegs,
      tabs: ['overview'],
    },
  ];
}

export function buildStaffCompoundKpis(input: {
  assignedCount: number;
  unreadAssigned: number;
  queueCounts: Partial<Record<FollowUpQueueFilter, number>>;
  hotLeads: number;
  myAiEscalations?: number;
  missedTasks: number;
}): DashboardCompoundKpi[] {
  const followupSegs = followupSegments(input.queueCounts);
  const followupTotal = followupSegs.reduce((sum, s) => sum + s.value, 0);
  const pipelineTotal = input.hotLeads + (input.myAiEscalations ?? 0);

  const cards: DashboardCompoundKpi[] = [
    {
      id: 'my-inbox',
      titleKey: 'dashboard.controlRoom.compound.myInbox',
      icon: MessageSquare,
      severity: input.unreadAssigned > 0 ? 'warning' : 'neutral',
      linkTo: '/inbox',
      linkState: { filter: 'assigned_to_me' },
      primaryValue: input.assignedCount,
      primaryLabelKey: 'dashboard.myWorkspace.assignedOpen',
      secondaryValue: input.unreadAssigned,
      secondaryLabelKey: 'dashboard.myWorkspace.unreadAssigned',
    },
    {
      id: 'followups',
      titleKey: 'dashboard.controlRoom.compound.followups',
      helperKey: followupTotal === 0 ? 'dashboard.controlRoom.compound.followupsClear' : undefined,
      icon: Clock,
      severity:
        (input.queueCounts.overdue ?? 0) > 0
          ? 'danger'
          : followupTotal > 0
            ? 'warning'
            : 'neutral',
      linkTo: '/followups',
      linkState: { filter: 'due_today', view: 'my' },
      primaryValue: followupTotal,
      primaryLabelKey: 'dashboard.controlRoom.compound.followupsTotal',
      segments: followupSegs,
      allClear: followupTotal === 0,
    },
  ];

  if (pipelineTotal > 0 || input.missedTasks > 0) {
    const segs: DashboardCompoundSegment[] = [];
    if (input.hotLeads > 0) {
      segs.push({
        id: 'hot-leads',
        labelKey: 'dashboard.controlRoom.kpi.hotLeads',
        value: input.hotLeads,
        severity: 'hot',
      });
    }
    if ((input.myAiEscalations ?? 0) > 0) {
      segs.push({
        id: 'ai-escalations',
        labelKey: 'dashboard.controlRoom.kpi.aiEscalations',
        value: input.myAiEscalations!,
        severity: 'danger',
      });
    }
    if (input.missedTasks > 0) {
      segs.push({
        id: 'missed-tasks',
        labelKey: 'dashboard.myWorkspace.kpi.missedTasks',
        value: input.missedTasks,
        severity: 'danger',
      });
    }
    cards.push({
      id: 'pipeline',
      titleKey: 'dashboard.controlRoom.compound.pipeline',
      icon: Flame,
      severity: pipelineTotal > 0 ? 'hot' : 'danger',
      linkTo: input.missedTasks > 0 ? '/followups' : '/customers',
      linkState: input.missedTasks > 0 ? { view: 'my' } : undefined,
      primaryValue: pipelineTotal || input.missedTasks,
      primaryLabelKey: 'dashboard.controlRoom.compound.pipelineTotal',
      segments: segs,
    });
  }

  return cards;
}

export function buildHeroKpis(input: {
  needsReply: number;
  overview?: OverviewStats;
  hotLeads: number;
  paymentPending: number;
  quoteSummary: QuoteSummary;
  wonToday: number;
  alertsCount: number;
  criticalAlerts: number;
}): DashboardHeroKpi[] {
  const receivedToday = input.overview?.messages.today.received ?? 0;
  const salesValue =
    input.quoteSummary.accepted > 0
      ? input.quoteSummary.totalQuotedValue
      : input.wonToday;

  return [
    {
      id: 'needs-reply',
      titleKey: 'dashboard.controlRoom.hero.needsReply',
      value: input.needsReply,
      trend: input.needsReply > 0 ? `+${Math.min(input.needsReply, 99)}` : undefined,
      trendUp: input.needsReply > 0,
      severity: input.needsReply > 0 ? 'warning' : 'neutral',
      symbol: 'forum',
      linkTo: '/inbox',
      linkState: { filter: 'needs_reply' },
    },
    {
      id: 'new-chats-today',
      titleKey: 'dashboard.controlRoom.hero.newChatsToday',
      value: receivedToday,
      trend: receivedToday > 0 ? `+${receivedToday}` : undefined,
      trendUp: receivedToday > 0,
      severity: 'neutral',
      symbol: 'add_comment',
      linkTo: '/inbox',
    },
    {
      id: 'hot-leads',
      titleKey: 'dashboard.controlRoom.hero.hotLeads',
      value: input.hotLeads,
      footnoteKey:
        input.hotLeads > 0 ? 'dashboard.controlRoom.hero.hotLeadsPriority' : undefined,
      footnoteParams: input.hotLeads > 0 ? { count: Math.min(input.hotLeads, 99) } : undefined,
      severity: input.hotLeads > 0 ? 'hot' : 'neutral',
      symbol: 'local_fire_department',
      linkTo: '/pipeline',
    },
    {
      id: 'pending-payments',
      titleKey: 'dashboard.controlRoom.hero.pendingPayments',
      value: input.paymentPending,
      severity: input.paymentPending > 0 ? 'warning' : 'neutral',
      symbol: 'payments',
      linkTo: '/followups',
      linkState: { filter: 'payment_pending' },
    },
    {
      id: 'today-sales',
      titleKey: 'dashboard.controlRoom.hero.todaySales',
      value: salesValue > 0 ? salesValue.toLocaleString() : '—',
      trend: input.wonToday > 0 ? `+${input.wonToday}` : undefined,
      trendUp: input.wonToday > 0,
      severity: input.wonToday > 0 ? 'success' : 'neutral',
      symbol: 'account_balance_wallet',
      linkTo: '/quotes',
    },
    {
      id: 'safety-alerts',
      titleKey: 'dashboard.controlRoom.hero.safetyAlerts',
      value: input.alertsCount,
      footnoteKey:
        input.criticalAlerts > 0 ? 'dashboard.controlRoom.hero.criticalAlerts' : undefined,
      footnoteParams:
        input.criticalAlerts > 0 ? { count: input.criticalAlerts } : undefined,
      severity: input.alertsCount > 0 ? 'danger' : 'neutral',
      symbol: 'report',
      linkTo: '/settings/whatsapp-safety',
    },
  ];
}

export function filterCompoundKpisForTab(
  kpis: DashboardCompoundKpi[],
  tab: DashboardTab,
): DashboardCompoundKpi[] {
  return kpis.filter(k => !k.tabs || k.tabs.includes(tab));
}

const AUDIT_ACTION_MAP: Record<string, { actionKey: string; symbol: string }> = {
  message_sent: { actionKey: 'dashboard.controlRoom.activity.staffReplied', symbol: 'send' },
  message_failed: { actionKey: 'dashboard.controlRoom.activity.failedSend', symbol: 'error' },
  ai_reply: { actionKey: 'dashboard.controlRoom.activity.aiReplied', symbol: 'smart_toy' },
  followup_auto_sent: { actionKey: 'dashboard.controlRoom.activity.followupSent', symbol: 'event_upcoming' },
  session_connected: { actionKey: 'dashboard.controlRoom.activity.reconnected', symbol: 'phonelink_ring' },
  session_disconnected: { actionKey: 'dashboard.controlRoom.activity.disconnected', symbol: 'phonelink_off' },
  inbox_chat_resolved: { actionKey: 'dashboard.controlRoom.activity.resolved', symbol: 'check_circle' },
  inbox_ai_takeover: { actionKey: 'dashboard.controlRoom.activity.aiTakeover', symbol: 'person' },
  inbox_ai_resumed: { actionKey: 'dashboard.controlRoom.activity.aiResumed', symbol: 'smart_toy' },
};

export function buildTimelineEntries(logs: AuditLog[]): TimelineEntry[] {
  return logs
    .filter(l => AUDIT_ACTION_MAP[l.action])
    .map(l => {
      const mapped = AUDIT_ACTION_MAP[l.action];
      const actor = l.apiKeyName ?? 'System';
      const account = l.sessionName ?? l.sessionId ?? '';
      return {
        id: l.id,
        actionKey: mapped.actionKey,
        meta: account ? `${actor} · ${account}` : actor,
        time: l.createdAt,
        symbol: mapped.symbol,
      };
    });
}

export function formatRelativeTime(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return t('common.justNow');
  if (diff < 3_600_000) return t('common.minAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('common.hoursAgo', { count: Math.floor(diff / 3_600_000) });
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function inboxLink(sessionId: string, chatId: string, groupMemberId?: string | null): string {
  return inboxDeepLink(sessionId, chatId, groupMemberId);
}

export function unreadBySession(conversations: Conversation[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of conversations) {
    if (c.resolved) continue;
    map[c.sessionId] = (map[c.sessionId] ?? 0) + (c.unreadCount ?? 0);
  }
  return map;
}
