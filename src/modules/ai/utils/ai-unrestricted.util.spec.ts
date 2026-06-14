import { isAiUnrestricted, AI_UNRESTRICTED_SAFETY_PATCH } from './ai-unrestricted.util';
import type { AiConfig } from '../entities/ai-config.entity';

describe('ai-unrestricted.util', () => {
  it('isAiUnrestricted returns true only when flag is set', () => {
    expect(isAiUnrestricted(null)).toBe(false);
    expect(isAiUnrestricted({ aiUnrestrictedMode: false } as AiConfig)).toBe(false);
    expect(isAiUnrestricted({ aiUnrestrictedMode: true } as AiConfig)).toBe(true);
  });

  it('AI_UNRESTRICTED_SAFETY_PATCH uses zero AI delays', () => {
    expect(AI_UNRESTRICTED_SAFETY_PATCH.minAiReplyDelayMs).toBe(0);
    expect(AI_UNRESTRICTED_SAFETY_PATCH.maxAiReplyDelayMs).toBe(0);
    expect(AI_UNRESTRICTED_SAFETY_PATCH.riskyIntentRequiresApproval).toBe(false);
  });
});
