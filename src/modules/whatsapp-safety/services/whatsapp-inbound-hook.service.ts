import { Injectable, OnModuleInit } from '@nestjs/common';
import { HookManager } from '../../../core/hooks';
import { WhatsAppConsentService } from './whatsapp-consent.service';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';
import { InboxCrmService } from '../../message/inbox-crm.service';
import { EventsGateway } from '../../events/events.gateway';
import type { IncomingMessage } from '../../../engine/interfaces/whatsapp-engine.interface';
import { isInboxChat } from '../../../common/utils/inbox-chat.util';
import { detectOptOutKeyword } from '../utils/opt-out-keywords.util';

@Injectable()
export class WhatsAppInboundHookService implements OnModuleInit {
  constructor(
    private readonly hookManager: HookManager,
    private readonly consentService: WhatsAppConsentService,
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly inboxCrmService: InboxCrmService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit(): void {
    this.hookManager.register(
      'whatsapp-safety-inbound',
      'message:received',
      async (ctx: { sessionId?: string; data: unknown }) => {
        const msg = ctx.data as IncomingMessage;
        const sessionId = ctx.sessionId;
        if (!sessionId || !msg?.chatId || msg.fromMe || !isInboxChat(msg.chatId)) {
          return { continue: true };
        }
        if (msg.broadcast) return { continue: true };

        const phone = msg.from || msg.chatId.replace(/@.*$/, '');
        const text = msg.body?.trim() ?? '';

        await this.consentService.upsertFromInbound({
          sessionId,
          phone,
          chatId: msg.chatId,
          messageAt: new Date(msg.timestamp ? msg.timestamp * 1000 : Date.now()),
        });

        if (text) {
          const settings = await this.settingsService.getForSession(sessionId);
          const extraKeywords = settings.optOutKeywords ?? [];
          if (detectOptOutKeyword(text, extraKeywords)) {
            await this.consentService.handleOptOut({
              sessionId,
              phone,
              reason: text.slice(0, 200),
            });
            await this.inboxCrmService.customerOptOutOfAi(sessionId, msg.chatId);
            this.eventsGateway.emitAiOptOut(sessionId, { chatId: msg.chatId, source: 'customer_message' });
          }
        }

        return { continue: true };
      },
      50,
    );
  }
}
