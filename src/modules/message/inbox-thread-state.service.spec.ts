import { InboxThreadStateService } from './inbox-thread-state.service';
import type { ConversationSummary } from './message.service';

describe('InboxThreadStateService', () => {
  const service = new InboxThreadStateService();

  function base(overrides: Partial<ConversationSummary> = {}): ConversationSummary {
    return {
      sessionId: 's1',
      sessionName: 'Main',
      sessionStatus: 'ready',
      chatId: '255@c.us',
      displayName: 'Customer',
      lastMessageAt: new Date().toISOString(),
      lastPreview: 'Hello',
      lastDirection: 'incoming',
      messageCount: 1,
      unreadCount: 1,
      hasUnread: true,
      resolved: false,
      hasFollowUp: false,
      aiHandlingState: 'idle',
      ...overrides,
    };
  }

  it('marks incoming unanswered as needs_reply', () => {
    const fields = service.compute({ summary: base() });
    expect(fields.threadState).toBe('needs_reply');
    expect(fields.needsReply).toBe(true);
  });

  it('does not mark needs_reply after staff/AI answered', () => {
    const fields = service.compute({
      summary: base({ lastDirection: 'outgoing', lastPreview: 'Tupo tayari boss' }),
    });
    expect(fields.threadState).toBe('waiting_customer');
    expect(fields.needsReply).toBe(false);
  });

  it('treats Asante as acknowledgment not urgent needs_reply', () => {
    const fields = service.compute({
      summary: base({ lastPreview: 'Asante', lastDirection: 'incoming' }),
    });
    expect(fields.threadState).not.toBe('needs_reply');
  });

  it('marks opted out threads', () => {
    const fields = service.compute({
      summary: base({ aiOptOut: true }),
    });
    expect(fields.threadState).toBe('opted_out');
  });

  it('marks groups as group_lead_only', () => {
    const fields = service.compute({
      summary: base({ chatId: '123@g.us' }),
    });
    expect(fields.threadState).toBe('group_lead_only');
  });

  it('marks follow-up overdue', () => {
    const fields = service.compute({
      summary: base({
        lastDirection: 'outgoing',
        followupOverdue: true,
        nextFollowupAt: new Date(Date.now() - 86400000).toISOString(),
      }),
    });
    expect(fields.threadState).toBe('followup_overdue');
  });

  it('marks ai waiting human', () => {
    const fields = service.compute({
      summary: base({ aiHandlingState: 'waiting_human' }),
    });
    expect(fields.threadState).toBe('ai_needs_human');
    expect(fields.needsHuman).toBe(true);
  });

  it('marks send_failed', () => {
    const fields = service.compute({
      summary: base(),
      hasFailedSend: true,
    });
    expect(fields.threadState).toBe('send_failed');
  });
});
