import { describe, expect, it, vi } from 'vitest';
import { formatCatalogRequestStatus, formatLearningOutcome, learningToneOptions } from './learning-i18n';

describe('learning-i18n', () => {
  const t = vi.fn((key: string, opts?: { defaultValue?: string }) => {
    if (key === 'ai.learning.outcomes.customer_bought') return 'Customer bought';
    return opts?.defaultValue ?? key;
  });

  it('formats known outcomes via translation key', () => {
    expect(formatLearningOutcome(t, 'customer_bought')).toBe('Customer bought');
  });

  it('falls back for unknown outcomes', () => {
    expect(formatLearningOutcome(t, 'custom_outcome')).toBe('custom outcome');
  });

  it('returns dash when outcome missing', () => {
    expect(formatLearningOutcome(t, null)).toBe('—');
  });

  it('builds tone option labels', () => {
    const options = learningToneOptions(t);
    expect(options).toHaveLength(5);
    expect(options[0].id).toBe('boss_friendly_mtaani');
  });

  it('formats catalog request status labels', () => {
    t.mockImplementation((key: string) => {
      if (key === 'ai.learning.requestStatus.in_progress') return 'In progress';
      return key;
    });
    expect(formatCatalogRequestStatus(t, 'in_progress')).toBe('In progress');
  });
});
