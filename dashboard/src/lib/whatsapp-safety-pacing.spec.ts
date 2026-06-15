import { describe, expect, it } from 'vitest';
import {
  WHATSAPP_REPLY_PACING_PRESETS,
  detectWhatsAppReplyPacingPreset,
} from './whatsapp-safety-pacing';

describe('whatsapp-safety-pacing', () => {
  it('detects standard preset values', () => {
    expect(detectWhatsAppReplyPacingPreset(WHATSAPP_REPLY_PACING_PRESETS.standard)).toBe('standard');
  });

  it('detects balanced preset values', () => {
    expect(detectWhatsAppReplyPacingPreset(WHATSAPP_REPLY_PACING_PRESETS.balanced)).toBe('balanced');
  });

  it('detects instant preset values', () => {
    expect(detectWhatsAppReplyPacingPreset(WHATSAPP_REPLY_PACING_PRESETS.instant)).toBe('instant');
  });

  it('returns custom for unknown combinations', () => {
    expect(
      detectWhatsAppReplyPacingPreset({
        minAiReplyDelayMs: 5000,
        maxAiReplyDelayMs: 12000,
        minDelayBetweenMessagesMs: 3000,
      }),
    ).toBe('custom');
  });
});
