import type { AiLearningItem } from '../services/api';

export type BulkApproveOverride = {
  id: string;
  customAnswer?: string;
  selectedSuggestionId?: string;
};

export function getBulkItemAnswer(
  item: Pick<AiLearningItem, 'adminFinalAnswer' | 'aiDraftAnswer'>,
): string {
  return (item.adminFinalAnswer ?? item.aiDraftAnswer ?? '').trim();
}

export function buildBulkApproveOverrides(
  items: AiLearningItem[],
  ids: string[],
  draftEdits: Record<string, string> = {},
): BulkApproveOverride[] {
  const overrides: BulkApproveOverride[] = [];
  for (const id of ids) {
    const item = items.find(row => row.id === id);
    if (!item) continue;
    const customAnswer = (draftEdits[id] ?? getBulkItemAnswer(item)).trim();
    if (customAnswer) overrides.push({ id, customAnswer });
  }
  return overrides;
}

export function buildBulkApproveDraftEdits(
  items: AiLearningItem[],
  ids: string[],
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const id of ids) {
    const item = items.find(row => row.id === id);
    if (!item) continue;
    const answer = getBulkItemAnswer(item);
    if (answer) drafts[id] = answer;
  }
  return drafts;
}
