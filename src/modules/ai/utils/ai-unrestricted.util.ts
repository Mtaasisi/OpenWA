import type { AiConfig } from '../entities/ai-config.entity';

/** WhatsApp safety settings applied when unrestricted mode is enabled. */
export const AI_UNRESTRICTED_SAFETY_PATCH = {
  minAiReplyDelayMs: 0,
  maxAiReplyDelayMs: 0,
  minDelayBetweenMessagesMs: 500,
  perContactCooldownMinutes: 0,
  maxAutoRepliesPerCustomerPerDay: 999,
  riskyIntentRequiresApproval: false,
  unknownQuestionRequiresApproval: false,
} as const;

export function isAiUnrestricted(config: AiConfig | null | undefined): boolean {
  return config?.aiUnrestrictedMode === true;
}

export const AI_UNRESTRICTED_AGENT_PROMPT =
  'Unrestricted mode is ON: handle discounts, complaints, warranty, refunds, and payment disputes yourself. ' +
  'Do NOT call escalate_to_human — keep helping the customer in this chat.';
