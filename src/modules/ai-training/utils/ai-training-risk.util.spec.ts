import { itemRequiresAdminApproval, isHighRiskTargetFile } from './ai-training-risk.util';
import { AiTrainingSuggestionActionType } from '../ai-training.types';

describe('ai-training-risk.util', () => {
  it('detects payment target files', () => {
    expect(isHighRiskTargetFile('BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md')).toBe(true);
    expect(isHighRiskTargetFile('FAQ.md')).toBe(false);
  });

  it('flags tool-rule suggestions as admin-only', () => {
    expect(
      itemRequiresAdminApproval(
        { question: 'Hello', issueType: null, targetFile: 'FAQ.md' },
        AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
      ),
    ).toBe(true);
  });
});
