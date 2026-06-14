import { Injectable, Inject, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { HookManager } from '../../core/hooks';
import type { IncomingMessage } from '../../engine/interfaces/whatsapp-engine.interface';
import { SessionService } from '../session/session.service';
import { MessageService } from '../message/message.service';
import { InboxSendPipelineService } from '../message/inbox-send-pipeline.service';
import { AiChatService } from './ai-chat.service';
import { AiSettingsService } from './ai-settings.service';
import { AiUsageFeature, AiUsageSource } from './cost/ai-cost.types';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { AiAuditService } from './ai-audit.service';
import { isInboxChat } from '../../common/utils/inbox-chat.util';
import { isAllowedStaffPhone } from './utils/phone-match.util';

@Injectable()
export class AiStaffWaBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AiStaffWaBridgeService.name);

  constructor(
    private readonly hookManager: HookManager,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => InboxSendPipelineService))
    private readonly sendPipeline: InboxSendPipelineService,
    private readonly aiChat: AiChatService,
    private readonly aiSettings: AiSettingsService,
    private readonly aiAudit: AiAuditService,
  ) {}

  onModuleInit(): void {
    this.hookManager.register(
      'ai-staff-wa-bridge',
      'message:received',
      async ctx => {
        const msg = ctx.data as IncomingMessage;
        const sessionId = ctx.sessionId;
        if (!sessionId || !msg?.chatId) return { continue: true };
        if (msg.fromMe || !isInboxChat(msg.chatId) || msg.isGroup) return { continue: true };

        const text = msg.body?.trim();
        if (!text) return { continue: true };

        const session = await this.sessionService.findOne(sessionId);
        const allowed = this.sessionService.getStaffAiAllowedNumbers(session);
        if (!isAllowedStaffPhone(msg.from || msg.chatId, allowed)) {
          return { continue: true };
        }

        const config = await this.aiSettings.getActiveConfig();
        if (!config?.enabled) return { continue: true };

        void this.handleStaffMessage(sessionId, msg.chatId, text);
        return { continue: true };
      },
      118,
    );
  }

  private async handleStaffMessage(sessionId: string, chatId: string, text: string): Promise<void> {
    try {
      await this.messageService.sendTyping(sessionId, chatId);
      const result = await this.aiChat.chat(
        [{ role: 'user', content: text }],
        ApiKeyRole.ADMIN,
        undefined,
        {
          feature: AiUsageFeature.ADMIN_ASSISTANT,
          source: AiUsageSource.ADMIN_MANUAL,
          conversationId: chatId,
        },
      );
      const reply = result.content?.trim();
      if (!reply) return;

      for (const action of result.actions ?? []) {
        this.aiAudit.logToolCall(sessionId, chatId, action.tool, action.args);
      }

      await this.sendPipeline.sendAutomated({
        sessionId,
        chatId,
        text: reply,
        source: 'ai-staff-wa',
        sendContext: {
          ai: {
            provider: result.provider,
            model: result.model,
            latencyMs: result.latencyMs,
          },
        },
      });

      this.aiAudit.logAiReply(sessionId, chatId, {
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        source: 'staff_wa',
      });
    } catch (error) {
      this.logger.warn(
        `Staff WA AI failed for ${sessionId}/${chatId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      void this.messageService.clearTyping(sessionId, chatId);
    }
  }
}
