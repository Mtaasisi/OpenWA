import type { TFunction } from 'i18next';
import type { FollowupQueueItemView } from '../../services/api';
import { formatCustomerLabel, formatSanitizedPhoneDisplay, resolveCustomerPhone } from '../../lib/inbox-customer-display';

export type FollowupSortKey = 'priority' | 'due' | 'customer';

export type FollowupViewChip =
  | 'my'
  | 'team'
  | 'due_today'
  | 'overdue'
  | 'upcoming'
  | 'ai_suggested'
  | 'needs_approval'
  | 'scheduled'
  | 'auto_sent'
  | 'failed'
  | 'stopped'
  | 'converted';

export const AUTOPILOT_CHIPS = [
  'ai_suggested',
  'needs_approval',
  'scheduled',
  'auto_sent',
  'failed',
  'stopped',
  'converted',
] as const;

export type FollowupAutopilotChip = (typeof AUTOPILOT_CHIPS)[number];

export function isAutopilotChip(chip: FollowupViewChip): chip is FollowupAutopilotChip {
  return (AUTOPILOT_CHIPS as readonly FollowupViewChip[]).includes(chip);
}

const ALL_VIEW_CHIPS: FollowupViewChip[] = [
  'my',
  'team',
  'due_today',
  'overdue',
  'upcoming',
  ...AUTOPILOT_CHIPS,
];

export function isFollowupViewChip(value: string): value is FollowupViewChip {
  return (ALL_VIEW_CHIPS as readonly string[]).includes(value);
}

export function autopilotStatusBadge(status: string): string | null {
  switch (status) {
    case 'ai_suggested':
      return 'AI Suggested';
    case 'needs_approval':
      return 'Needs Approval';
    case 'auto_sent':
      return 'Auto Sent';
    case 'scheduled':
      return 'Scheduled';
    case 'stopped':
      return 'Stopped';
    case 'failed':
      return 'Failed';
    case 'converted':
      return 'Converted';
    case 'rejected':
      return 'Rejected';
    default:
      return null;
  }
}

export function riskBadgeClass(risk?: string | null): string {
  switch (risk) {
    case 'low':
      return 'ws-status-badge ws-status-badge--success';
    case 'medium':
      return 'ws-status-badge ws-status-badge--warning';
    case 'high':
      return 'ws-status-badge ws-status-badge--danger';
    default:
      return 'ws-status-badge';
  }
}

const PRIORITY_RANK: Record<string, number> = {
  hot: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export function followupCustomerLabel(
  item: Pick<FollowupQueueItemView, 'chatId' | 'customerName' | 'customerPhone'>,
  t?: TFunction,
): string {
  return formatCustomerLabel(
    {
      chatId: item.chatId,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
    },
    t,
  );
}

export function followupPhoneDisplay(
  chatId: string,
  phone: string | null | undefined,
  t?: TFunction,
): string | null {
  return formatSanitizedPhoneDisplay(chatId, resolveCustomerPhone(chatId, phone), t);
}

export function customerInitials(
  name: string | null,
  phone: string | null,
  chatId?: string,
  t?: TFunction,
): string {
  const base = chatId
    ? followupCustomerLabel({ chatId, customerName: name, customerPhone: phone }, t)
    : name?.trim() || phone?.trim() || '?';
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export function formatDueTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDueDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Today, ${formatDueTime(iso)}`;
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function overdueLabel(dueAt: string, status: string): string | null {
  if (status !== 'overdue' && status !== 'missed') {
    const due = new Date(dueAt).getTime();
    if (due >= Date.now()) return null;
  }
  const diffMs = Date.now() - new Date(dueAt).getTime();
  if (diffMs <= 0) return null;
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Overdue ${days}d`;
  }
  if (hours > 0) return `Overdue ${hours}h`;
  return `Overdue ${minutes}m`;
}

export function isDueOverdue(dueAt: string, status: string): boolean {
  return overdueLabel(dueAt, status) != null;
}

export function isHotPriority(priority?: string | null): boolean {
  return priority === 'hot' || priority === 'high';
}

export function reasonLabel(item: FollowupQueueItemView, stageLabel: (stage: string) => string): string {
  return item.recommendedAction || item.productInterest || stageLabel(item.stage) || item.stage;
}

export function lastMsgPreview(item: FollowupQueueItemView): string {
  if (item.isAutopilot) {
    const suggested = item.suggestedMessage?.trim();
    if (suggested) {
      return suggested.length > 48 ? `${suggested.slice(0, 48)}…` : suggested;
    }
  }
  if (item.templatePreview) {
    const t = item.templatePreview.trim();
    return t.length > 48 ? `${t.slice(0, 48)}…` : t;
  }
  if (item.recommendedAction) return item.recommendedAction;
  return '—';
}

export function sortQueueItems<T extends FollowupQueueItemView>(
  items: T[],
  sortKey: FollowupSortKey,
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sortKey === 'customer') {
      const an = followupCustomerLabel(a).toLowerCase();
      const bn = followupCustomerLabel(b).toLowerCase();
      return an.localeCompare(bn);
    }
    if (sortKey === 'due') {
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    }
    const ap = PRIORITY_RANK[a.priority ?? 'normal'] ?? 2;
    const bp = PRIORITY_RANK[b.priority ?? 'normal'] ?? 2;
    if (ap !== bp) return ap - bp;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  });
  return copy;
}

export function chipToFilter(chip: FollowupViewChip): import('../../services/api').FollowUpQueueFilter {
  if (chip === 'due_today') return 'due_today';
  if (chip === 'overdue') return 'overdue';
  if (chip === 'upcoming') return 'due_now';
  if (chip === 'my' || chip === 'team') return 'due_now';
  if (isAutopilotChip(chip)) return chip;
  return 'due_now';
}
