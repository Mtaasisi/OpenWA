import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { MessageService } from '../message/message.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { FollowupConversationService } from '../followup/followup-conversation.service';
import { InboxAiHandlingState } from './inbox-ai-handling.enum';
import { resolveThreadIdentity } from '../../common/utils/inbox-display.util';
import { parseAiNotes } from './utils/ai-behavior.util';

@Injectable()
export class AiInboxContextService {
  constructor(
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    @Inject(forwardRef(() => FollowupConversationService))
    private readonly followupConversationService: FollowupConversationService,
  ) {}

  async buildCrmContextBlock(sessionId: string, chatId: string): Promise<string> {
    const [crm, lead] = await Promise.all([
      this.inboxCrmService.getThreadCrm(sessionId, chatId),
      this.followupConversationService.findByThread(sessionId, chatId),
    ]);

    const lines: string[] = ['=== CRM context (use for accurate replies) ==='];

    const identity = resolveThreadIdentity({
      chatId,
      customerName: lead?.customerName,
      customerPhone: lead?.customerPhone,
      crmName: crm.customerName,
      crmPhone: crm.customerPhone,
    });

    if (identity.customerName) lines.push(`Customer name: ${identity.customerName}`);
    if (identity.customerPhone) lines.push(`Phone: ${identity.customerPhone}`);
    if (crm.linkedExternalId) lines.push(`External ID: ${crm.linkedExternalId}`);
    if (crm.internalNote?.trim()) {
      lines.push(`Internal notes:\n${crm.internalNote.trim()}`);
    }
    lines.push(`AI state: ${crm.aiHandlingState ?? InboxAiHandlingState.IDLE}`);
    if (crm.resolved) lines.push('Thread marked resolved.');

    if (lead) {
      lines.push(`Lead stage: ${lead.stage}`);
      if (lead.productInterest) lines.push(`Product interest: ${lead.productInterest}`);
      if (lead.priority) lines.push(`Priority: ${lead.priority}`);
      if (lead.budget != null) lines.push(`Budget: ${lead.budget}`);
      if (lead.internalNote?.trim()) {
        lines.push(`Lead notes:\n${lead.internalNote.trim()}`);
      }
    } else {
      lines.push('No pipeline lead linked yet — use update_lead to create/update.');
    }

    return lines.join('\n');
  }

  async buildThread(
    sessionId: string,
    chatId: string,
    incomingText: string,
    contextLimit: number,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const history = await this.messageService.getChatMessagesForAi(sessionId, chatId, contextLimit);
    const thread: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of history.messages) {
      const text = m.body?.trim();
      if (!text) continue;
      thread.push({
        role: m.direction === 'incoming' ? 'user' : 'assistant',
        content: text,
      });
    }
    const last = thread[thread.length - 1];
    if (!last || last.role !== 'user' || last.content !== incomingText) {
      thread.push({ role: 'user', content: incomingText });
    }
    return thread;
  }

  /** CRM learning fields + optional recent thread for short-message context (ipo?, bei, etc.). */
  async buildContextSummary(
    sessionId: string,
    chatId: string,
    contextLimit: number,
    options?: { includeRecentMessages?: boolean },
  ): Promise<string> {
    const includeRecentMessages = options?.includeRecentMessages ?? true;
    const crm = await this.inboxCrmService.getThreadCrm(sessionId, chatId);

    const lines: string[] = [];
    if (crm.confirmedCity) lines.push(`Confirmed city: ${crm.confirmedCity}`);
    if (crm.lastProductInterest) lines.push(`Last product interest: ${crm.lastProductInterest}`);
    if (crm.lastIntent) lines.push(`Last detected intent: ${crm.lastIntent}`);
    if (crm.discountRequestCount) lines.push(`Discount requests so far: ${crm.discountRequestCount}`);
    if (crm.buyingPreferences?.trim()) {
      lines.push(`Buying preferences: ${crm.buyingPreferences.trim()}`);
    }
    if (crm.discountNegotiationMarked) {
      lines.push('Staff marked: discount negotiator — defend price, escalate if they push hard.');
    }

    const notes = crm.aiNotes ? parseAiNotes(crm.aiNotes) : null;
    if (notes?.compatibilityMode && notes.compatibilityAnswer) {
      lines.push(
        `Compatibility context: customer phone/model is "${String(notes.compatibilityAnswer)}" — accessory/charger fit, NOT a new phone purchase.`,
      );
    }

    if (includeRecentMessages) {
      const history = await this.messageService.getChatMessagesForAi(
        sessionId,
        chatId,
        contextLimit,
      );
      const recent = history.messages
        .filter(m => m.body?.trim())
        .slice(-8)
        .map(m => `${m.direction === 'incoming' ? 'Customer' : 'Staff/AI'}: ${m.body!.trim()}`);
      if (recent.length) {
        lines.push('Recent messages:');
        lines.push(...recent);
      }
    }

    if (!lines.length) return '';

    return ['=== Conversation context (read before replying) ===', ...lines].join('\n');
  }
}
