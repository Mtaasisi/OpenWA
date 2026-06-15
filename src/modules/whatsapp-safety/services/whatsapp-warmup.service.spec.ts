import { WhatsAppWarmupService } from './whatsapp-warmup.service';
import {
  WhatsAppMessageType,
  WhatsAppWarmupStatus,
} from '../enums/whatsapp-safety.enums';
import type { WhatsAppAccountWarmup } from '../entities/whatsapp-account-warmup.entity';

describe('WhatsAppWarmupService', () => {
  const service = new WhatsAppWarmupService(null as never);

  const dayOneWarmup = {
    sessionId: 'sess-1',
    status: WhatsAppWarmupStatus.ACTIVE,
    dayNumber: 1,
    maxOutboundToday: 30,
    outboundSentToday: 0,
    repliesOnly: true,
    allowCampaigns: false,
    allowFollowupAutoSend: false,
    allowAiAutoReply: true,
  } as WhatsAppAccountWarmup;

  it('allows manual replies on day 1 warm-up', () => {
    const result = service.checkWarmupAllows({
      warmup: dayOneWarmup,
      messageType: WhatsAppMessageType.MANUAL,
      isManualStaffSend: true,
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks campaign sends on day 1 warm-up', () => {
    const result = service.checkWarmupAllows({
      warmup: dayOneWarmup,
      messageType: WhatsAppMessageType.CAMPAIGN,
      isManualStaffSend: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('replies only');
  });

  it('blocks when daily warm-up limit is reached', () => {
    const result = service.checkWarmupAllows({
      warmup: { ...dayOneWarmup, outboundSentToday: 30 },
      messageType: WhatsAppMessageType.MANUAL,
      isManualStaffSend: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('daily limit');
  });

  it('allows sends when warm-up is completed', () => {
    const result = service.checkWarmupAllows({
      warmup: { ...dayOneWarmup, status: WhatsAppWarmupStatus.COMPLETED },
      messageType: WhatsAppMessageType.CAMPAIGN,
      isManualStaffSend: false,
    });
    expect(result.allowed).toBe(true);
  });
});
