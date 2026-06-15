import type { TFunction } from 'i18next';

const TONE_IDS = [
  'boss_friendly_mtaani',
  'professional',
  'short_sales_reply',
  'policy_explanation',
  'technical_explanation',
] as const;

export function learningToneOptions(t: TFunction) {
  return TONE_IDS.map(id => ({
    id,
    label: t(`ai.learning.modals.tones.${id}`),
  }));
}

export function formatLearningOutcome(t: TFunction, outcome?: string | null): string {
  if (!outcome) return '—';
  return t(`ai.learning.outcomes.${outcome}`, { defaultValue: outcome.replace(/_/g, ' ') });
}

const CATALOG_REQUEST_STATUSES = ['open', 'in_progress', 'done', 'cancelled'] as const;

export function formatCatalogRequestStatus(t: TFunction, status?: string | null): string {
  if (!status) return '—';
  if ((CATALOG_REQUEST_STATUSES as readonly string[]).includes(status)) {
    return t(`ai.learning.requestStatus.${status}`);
  }
  return status.replace(/_/g, ' ');
}

export const catalogRequestStatusFilters = [
  'active',
  'open',
  'in_progress',
  'done',
  'cancelled',
  'all',
] as const;

export type CatalogRequestStatusFilter = (typeof catalogRequestStatusFilters)[number];
