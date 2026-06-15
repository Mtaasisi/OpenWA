import type { AiLearningItem } from '../../ai/entities/ai-learning-item.entity';
import {
  AiTrainingIssueType,
  AiTrainingSuggestionActionType,
  HIGH_RISK_ACTION_TYPES,
} from '../ai-training.types';

export function isHighRiskActionType(actionType?: AiTrainingSuggestionActionType | string | null): boolean {
  if (!actionType) return false;
  return HIGH_RISK_ACTION_TYPES.includes(actionType as AiTrainingSuggestionActionType);
}

export function isHighRiskTargetFile(targetFile?: string | null): boolean {
  if (!targetFile) return false;
  return /PAYMENT|DISCOUNT|WARRANTY|BRANCH_PROFILE/i.test(targetFile);
}

export function itemRequiresAdminApproval(
  item: Pick<AiLearningItem, 'issueType' | 'targetFile' | 'question'>,
  actionType?: AiTrainingSuggestionActionType | string | null,
): boolean {
  if (isHighRiskActionType(actionType)) return true;
  if (isHighRiskTargetFile(item.targetFile)) return true;

  const issue = item.issueType ?? '';
  if (
    issue === AiTrainingIssueType.CUSTOMER_SERVICE_REQUEST ||
    /payment|warranty|discount|missing_policy/i.test(issue)
  ) {
    return true;
  }

  return /malipo|payment|warranty|garansi|discount|punguzo|customer care|namba ya kupiga/i.test(
    item.question ?? '',
  );
}
