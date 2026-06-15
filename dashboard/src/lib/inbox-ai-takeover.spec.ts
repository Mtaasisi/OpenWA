import { describe, expect, it } from 'vitest';
import {
  countDirectAiBlocked,
  countDirectAiEligible,
  isAiAutoReplyEligible,
  isManualTakeoverActive,
  manualTakeoverMinutesRemaining,
  shouldConfirmAiTakeoverBeforeStaffSend,
} from './inbox-ai-takeover';
import type { Conversation } from '../services/api';

function conv(overrides: Partial<Conversation>): Conversation {
  return {
    sessionId: 's1',
    sessionName: 'Main',
    sessionStatus: 'ready',
    chatId: '255700000000@c.us',
    displayName: 'Test',
    lastMessageAt: new Date().toISOString(),
    lastPreview: 'Hi',
    lastDirection: 'incoming',
    messageCount: 1,
    unreadCount: 1,
    hasUnread: true,
    resolved: false,
    hasFollowUp: false,
    ...overrides,
  };
}

describe('inbox-ai-takeover', () => {
  it('treats active direct chats as takeover-confirm candidates', () => {
    expect(shouldConfirmAiTakeoverBeforeStaffSend(conv({}))).toBe(true);
    expect(shouldConfirmAiTakeoverBeforeStaffSend(conv({ aiHandlingState: 'ai_handling' }))).toBe(true);
  });

  it('skips groups and blocked chats', () => {
    expect(shouldConfirmAiTakeoverBeforeStaffSend(conv({ chatId: '120363@g.us' }))).toBe(false);
    expect(shouldConfirmAiTakeoverBeforeStaffSend(conv({ aiAutoReplyPaused: true }))).toBe(false);
    expect(shouldConfirmAiTakeoverBeforeStaffSend(conv({ aiHandlingState: 'human_handling' }))).toBe(false);
    expect(shouldConfirmAiTakeoverBeforeStaffSend(conv({ aiOptOut: true }))).toBe(false);
  });

  it('counts eligible vs blocked direct chats', () => {
    const list = [
      conv({ chatId: '1@c.us' }),
      conv({ chatId: '2@c.us', aiAutoReplyPaused: true }),
      conv({ chatId: '3@g.us' }),
      conv({ chatId: '4@c.us', resolved: true }),
    ];
    expect(countDirectAiEligible(list)).toBe(1);
    expect(countDirectAiBlocked(list)).toBe(1);
    expect(isAiAutoReplyEligible(list[1])).toBe(false);
  });

  it('detects active manual takeover countdown', () => {
    const until = new Date(Date.now() + 12 * 60_000).toISOString();
    const crm = { autopilotPauseReason: 'manual_takeover', manualTakeoverUntil: until };
    expect(isManualTakeoverActive(crm)).toBe(true);
    expect(manualTakeoverMinutesRemaining(crm)).toBeGreaterThan(0);
    expect(manualTakeoverMinutesRemaining(crm)).toBeLessThanOrEqual(12);
  });

  it('treats expired manual takeover as inactive', () => {
    const until = new Date(Date.now() - 60_000).toISOString();
    const crm = { autopilotPauseReason: 'manual_takeover', manualTakeoverUntil: until };
    expect(isManualTakeoverActive(crm)).toBe(false);
    expect(manualTakeoverMinutesRemaining(crm)).toBe(0);
  });
});
