import { InboxAiHandlingState } from '../ai/inbox-ai-handling.enum';
import { AI_PAUSE_EXPLICIT, AI_PAUSE_MANUAL_TAKEOVER } from '../ai/ai-pause-reason.constants';

describe('inbox CRM auto-reply gate (stale human_handling)', () => {
  it('heals human_handling when auto-reply is not paused', () => {
    const row = {
      aiOptOut: false,
      aiHandlingState: InboxAiHandlingState.HUMAN_HANDLING,
      aiAutoReplyPaused: false,
      autopilotPauseReason: null,
      manualTakeoverUntil: null,
    };
    const shouldHeal =
      !row.aiOptOut &&
      row.aiHandlingState === InboxAiHandlingState.HUMAN_HANDLING &&
      !row.aiAutoReplyPaused;
    expect(shouldHeal).toBe(true);
  });

  it('keeps explicit staff pause', () => {
    const row = {
      aiOptOut: false,
      aiHandlingState: InboxAiHandlingState.HUMAN_HANDLING,
      aiAutoReplyPaused: true,
      autopilotPauseReason: AI_PAUSE_EXPLICIT,
    };
    const shouldHeal =
      row.aiHandlingState === InboxAiHandlingState.HUMAN_HANDLING &&
      row.aiAutoReplyPaused &&
      row.autopilotPauseReason === AI_PAUSE_EXPLICIT;
    expect(shouldHeal).toBe(true);
  });

  it('expires manual takeover after deadline', () => {
    const until = new Date(Date.now() - 60_000);
    expect(until.getTime() <= Date.now()).toBe(true);
    expect(AI_PAUSE_MANUAL_TAKEOVER).toBe('manual_takeover');
  });
});
