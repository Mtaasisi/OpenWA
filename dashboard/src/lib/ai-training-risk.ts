import type { AiLearningItem } from '../services/api';

const HIGH_RISK_TARGETS = /PAYMENT|DISCOUNT|WARRANTY|BRANCH_PROFILE/i;
const HIGH_RISK_QUESTION =
  /malipo|payment|warranty|garansi|discount|punguzo|customer care|namba ya kupiga/i;

export function itemRequiresAdminApproval(
  item: Pick<AiLearningItem, 'issueType' | 'targetFile' | 'question' | 'suggestedTargetFile'>,
  requireAdminApproval = true,
): boolean {
  if (!requireAdminApproval) return false;

  const target = item.targetFile ?? item.suggestedTargetFile ?? '';
  if (HIGH_RISK_TARGETS.test(target)) return true;

  const issue = item.issueType ?? '';
  if (/customer_service|payment|warranty|discount|missing_policy/i.test(issue)) return true;

  return HIGH_RISK_QUESTION.test(item.question ?? '');
}

export function countBulkApprovable(
  items: AiLearningItem[],
  selectedIds: string[],
  options: { requireAdminApproval: boolean; isAdmin: boolean },
): number {
  return selectedIds.filter(id => {
    const item = items.find(i => i.id === id);
    if (!item) return false;
    if (!['pending_review', 'suggested'].includes(item.status)) return false;
    if (itemRequiresAdminApproval(item, options.requireAdminApproval) && !options.isAdmin) return false;
    return Boolean(item.aiDraftAnswer || item.adminFinalAnswer || item.status === 'suggested');
  }).length;
}
