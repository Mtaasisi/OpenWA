import { describe, expect, it } from 'vitest';
import {
  buildBulkApproveDraftEdits,
  buildBulkApproveOverrides,
  getBulkItemAnswer,
} from './ai-training-bulk';
import type { AiLearningItem } from '../services/api';

const item = (id: string, draft?: string): AiLearningItem =>
  ({
    id,
    question: `Q ${id}`,
    aiDraftAnswer: draft ?? null,
    adminFinalAnswer: null,
    status: 'pending_review',
  }) as AiLearningItem;

describe('ai-training-bulk', () => {
  it('prefers adminFinalAnswer over aiDraftAnswer', () => {
    expect(
      getBulkItemAnswer({
        adminFinalAnswer: 'Final',
        aiDraftAnswer: 'Draft',
      }),
    ).toBe('Final');
  });

  it('builds overrides from saved drafts and edited values', () => {
    const items = [item('a', 'Draft A'), item('b', 'Draft B')];
    const overrides = buildBulkApproveOverrides(items, ['a', 'b'], { a: 'Edited A' });
    expect(overrides).toEqual([
      { id: 'a', customAnswer: 'Edited A' },
      { id: 'b', customAnswer: 'Draft B' },
    ]);
  });

  it('builds initial draft edits map for bulk modal', () => {
    expect(buildBulkApproveDraftEdits([item('a', 'Draft A'), item('b')], ['a', 'b'])).toEqual({
      a: 'Draft A',
    });
  });
});
