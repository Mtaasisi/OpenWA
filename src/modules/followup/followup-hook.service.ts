import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { HookManager } from '../../core/hooks/hook-manager.service';
import { FollowupConversationService } from './followup-conversation.service';
import { FollowupEngineService } from './followup-engine.service';
import { FollowupQueueService } from './followup-queue.service';
import { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';
import { ConversationStage } from './followup.enums';
import { isOptOutMessage } from './utils/followup-risk.util';
import { InboxCrmService } from '../message/inbox-crm.service';
import { FollowupAutopilotSettingsService } from './followup-autopilot-settings.service';
import { EventsGateway } from '../events/events.gateway';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';

@Injectable()
export class FollowupHookService implements OnModuleInit {
  constructor(
    private readonly hookManager: HookManager,
    private readonly conversationService: FollowupConversationService,
    @Inject(forwardRef(() => FollowupEngineService))
    private readonly engineService: FollowupEngineService,
    private readonly queueService: FollowupQueueService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrmService: InboxCrmService,
    private readonly autopilotSettings: FollowupAutopilotSettingsService,
    private readonly eventsGateway: EventsGateway,
    private readonly safetySettings: WhatsAppSafetySettingsService,
  ) {}

  onModuleInit(): void {
    this.hookManager.register(
      'followup',
      'message:received',
      async ctx => {
        const data = ctx.data as IncomingMessage & { chatId?: string };
        const sessionId = ctx.sessionId;
        const chatId = data.chatId ?? data.from;
        if (!sessionId || !chatId) return { continue: true };
        if (data.broadcast) return { continue: true };

        const ext = data as IncomingMessage & { chatName?: string; notifyName?: string };
        const conv = await this.conversationService.recordCustomerMessage(sessionId, chatId, {
          notifyName: ext.notifyName ?? null,
          chatName: ext.chatName ?? null,
        });
        // @c.us threads: ensure phone is stored even when name is missing
        if (!conv.customerPhone?.trim()) {
          await this.conversationService.syncIdentityIfEmpty(sessionId, chatId, {});
        }
        await this.queueService.cancelPendingForConversation(conv.id, 'customer_replied');

        const body = (data as IncomingMessage & { body?: string }).body ?? '';
        if (body) {
          const settings = await this.safetySettings.getForSession(sessionId);
          if (isOptOutMessage(body, settings.optOutKeywords ?? [])) {
            await this.inboxCrmService.upsertThreadCrm(sessionId, chatId, { aiOptOut: true });
            await this.conversationService.update(conv.id, { customerRefusedFollowup: true });
          }
        }

        if (conv.stage === ConversationStage.WON || conv.stage === ConversationStage.LOST) {
          await this.queueService.cancelPendingForConversation(conv.id, 'lead_closed');
        }
        if (conv.stage === ConversationStage.WAITING_CUSTOMER_REPLY) {
          await this.conversationService.update(conv.id, { stage: ConversationStage.CONTACTED });
        }
        return { continue: true };
      },
      100,
    );

    this.hookManager.register(
      'followup',
      'message:sent',
      async ctx => {
        const data = ctx.data as { chatId?: string; to?: string; staffId?: string; input?: { chatId?: string }; source?: string };
        const sessionId = ctx.sessionId;
        const chatId = data.chatId ?? data.to ?? data.input?.chatId;
        if (!sessionId || !chatId) return { continue: true };

        await this.conversationService.recordStaffMessage(sessionId, chatId, data.staffId);
        await this.conversationService.syncIdentityIfEmpty(sessionId, chatId, {});

        if (data.staffId && data.source !== 'ai-auto-reply') {
          const settings = await this.autopilotSettings.getSettings();
          await this.inboxCrmService.pauseFollowupAutopilot(
            sessionId,
            chatId,
            data.staffId,
            settings.staffTakeoverPauseMinutes,
          );
          this.eventsGateway.emitFollowupAlert('followup.autopilot_paused', sessionId, {
            chatId,
            paused: true,
            reason: 'staff_takeover',
          });
        }

        return { continue: true };
      },
      100,
    );
  }

  async handleStageChange(
    sessionId: string,
    chatId: string,
    stage: ConversationStage,
  ): Promise<void> {
    const conv = await this.conversationService.getOrCreate(sessionId, chatId);
    const prev = conv.stage;
    if (prev === stage) return;
    const updated = await this.conversationService.updateStage(conv.id, stage);
    await this.engineService.onStageChange(updated, stage);
  }
}
