import { Injectable } from '@nestjs/common';
import { InboxCrmService } from './inbox-crm.service';
import { SessionService } from '../session/session.service';
import { SessionStatus } from '../session/entities/session.entity';
import { AiAutoReplyMasterService } from '../ai/ai-auto-reply-master.service';
import { InboxThreadStateService } from './inbox-thread-state.service';
import type { ConversationSummary } from './message.service';

export interface InboxAiDiagnosisResult {
  sessionId: string;
  chatId: string;
  canAiReply: boolean;
  summary: string;
  reasons: string[];
  suggestedFixes: string[];
  threadState: string;
  threadStateReason: string;
  aiStatus: string | null;
  checks: Array<{ id: string; ok: boolean; detail?: string; fixTarget?: string }>;
  lastError: string | null;
  groupChat: boolean;
  optedOut: boolean;
  aiPaused: boolean;
  sessionConnected: boolean;
}

@Injectable()
export class InboxAiDiagnosisService {
  constructor(
    private readonly inboxCrm: InboxCrmService,
    private readonly sessionService: SessionService,
    private readonly autoReplyHealth: AiAutoReplyMasterService,
    private readonly threadState: InboxThreadStateService,
  ) {}

  async diagnose(sessionId: string, chatId: string): Promise<InboxAiDiagnosisResult> {
    const [crm, session, health] = await Promise.all([
      this.inboxCrm.getThreadCrm(sessionId, chatId).catch(() => null),
      this.sessionService.findOne(sessionId).catch(() => null),
      this.autoReplyHealth.getHealth(),
    ]);

    const groupChat = chatId.endsWith('@g.us');
    const optedOut = crm?.aiOptOut === true;
    const aiPaused = crm?.aiAutoReplyPaused === true || crm?.aiHandlingState === 'human_handling';
    const sessionConnected = session?.status === SessionStatus.READY;

    const summaryStub = {
      sessionId,
      chatId,
      lastDirection: 'incoming' as const,
      resolved: crm?.resolved ?? false,
      aiHandlingState: crm?.aiHandlingState ?? 'idle',
      aiOptOut: optedOut,
      aiAutoReplyPaused: aiPaused,
      followupOverdue: false,
    } as ConversationSummary;

    const state = this.threadState.compute({
      summary: summaryStub,
      sessionDisconnected: !sessionConnected,
    });

    const reasons: string[] = [];
    const suggestedFixes: string[] = [];

    if (!health.masterEnabled) {
      reasons.push('AI auto-reply is disabled globally');
      suggestedFixes.push('ai-settings');
    }
    for (const check of health.checks) {
      if (!check.ok && check.detail) {
        reasons.push(check.detail);
        if (check.fixTarget) suggestedFixes.push(check.fixTarget);
      }
    }
    if (!sessionConnected) {
      reasons.push(`WhatsApp session not connected (${session?.status ?? 'unknown'})`);
      suggestedFixes.push('channels');
    }
    if (optedOut) {
      reasons.push('Customer opted out of AI messages');
    }
    if (aiPaused) {
      reasons.push('AI paused or staff took over this chat');
      suggestedFixes.push('resume-ai');
    }
    if (groupChat) {
      reasons.push('Group chats: AI auto-reply disabled (lead detection only)');
    }
    if (crm?.aiHandlingState === 'waiting_human') {
      reasons.push('AI escalated — waiting for human review');
      suggestedFixes.push('inbox');
    }

    const disconnected = health.sessions.filter(s => !s.connected);
    if (disconnected.some(s => s.sessionId === sessionId)) {
      reasons.push('This WhatsApp account is disconnected');
      suggestedFixes.push('channels');
    }

    const canAiReply =
      health.masterEnabled &&
      sessionConnected &&
      !optedOut &&
      !aiPaused &&
      !groupChat &&
      !crm?.resolved &&
      crm?.aiHandlingState !== 'waiting_human';

    const summary =
      reasons.length === 0
        ? 'AI auto-reply inaonekana sawa kwa chat hii.'
        : `Kwa nini AI haijibu: ${reasons.join('; ')}`;

    return {
      sessionId,
      chatId,
      canAiReply,
      summary,
      reasons,
      suggestedFixes: [...new Set(suggestedFixes)],
      threadState: state.threadState,
      threadStateReason: state.threadStateReason,
      aiStatus: crm?.aiHandlingState ?? null,
      checks: health.checks.map(c => ({
        id: c.id,
        ok: c.ok,
        detail: c.detail ?? undefined,
        fixTarget: c.fixTarget ?? undefined,
      })),
      lastError: health.checks.find(c => !c.ok)?.detail ?? null,
      groupChat,
      optedOut,
      aiPaused,
      sessionConnected,
    };
  }
}
