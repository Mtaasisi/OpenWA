export type WhatsAppReplyPacingPreset = 'standard' | 'balanced' | 'fast' | 'instant' | 'custom';

export type WhatsAppReplyPacingValues = {
  minAiReplyDelayMs: number;
  maxAiReplyDelayMs: number;
  minDelayBetweenMessagesMs: number;
};

export const WHATSAPP_REPLY_PACING_PRESETS: Record<
  Exclude<WhatsAppReplyPacingPreset, 'custom'>,
  WhatsAppReplyPacingValues
> = {
  standard: {
    minAiReplyDelayMs: 15_000,
    maxAiReplyDelayMs: 90_000,
    minDelayBetweenMessagesMs: 8_000,
  },
  balanced: {
    minAiReplyDelayMs: 8_000,
    maxAiReplyDelayMs: 30_000,
    minDelayBetweenMessagesMs: 4_000,
  },
  fast: {
    minAiReplyDelayMs: 3_000,
    maxAiReplyDelayMs: 10_000,
    minDelayBetweenMessagesMs: 2_000,
  },
  instant: {
    minAiReplyDelayMs: 0,
    maxAiReplyDelayMs: 0,
    minDelayBetweenMessagesMs: 500,
  },
};

export function detectWhatsAppReplyPacingPreset(
  values: Partial<WhatsAppReplyPacingValues>,
): WhatsAppReplyPacingPreset {
  for (const [key, preset] of Object.entries(WHATSAPP_REPLY_PACING_PRESETS) as Array<
    [Exclude<WhatsAppReplyPacingPreset, 'custom'>, WhatsAppReplyPacingValues]
  >) {
    if (
      values.minAiReplyDelayMs === preset.minAiReplyDelayMs &&
      values.maxAiReplyDelayMs === preset.maxAiReplyDelayMs &&
      values.minDelayBetweenMessagesMs === preset.minDelayBetweenMessagesMs
    ) {
      return key;
    }
  }
  return 'custom';
}
