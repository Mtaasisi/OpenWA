import { In, type EntityManager } from 'typeorm';
import { Message } from '../message/entities/message.entity';
import { MessageBatch } from '../message/entities/message-batch.entity';
import { InboxThreadRead } from '../message/entities/inbox-thread-read.entity';
import { InboxThreadSummary } from '../message/entities/inbox-thread-summary.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { FollowupConversation } from '../followup/entities/followup-conversation.entity';
import { FollowupAttempt } from '../followup/entities/followup-attempt.entity';
import { FollowupQueueItem } from '../followup/entities/followup-queue-item.entity';
import { Quote } from '../quote/entities/quote.entity';
import { QuoteItem } from '../quote/entities/quote-item.entity';
import { WhatsAppAccountWarmup } from '../whatsapp-safety/entities/whatsapp-account-warmup.entity';
import { WhatsAppSendQueue } from '../whatsapp-safety/entities/whatsapp-send-queue.entity';
import { WhatsAppSendAudit } from '../whatsapp-safety/entities/whatsapp-send-audit.entity';
import {
  WhatsAppSessionHealthEvent,
  WhatsAppSessionAutomationState,
} from '../whatsapp-safety/entities/whatsapp-session-health-event.entity';
import { WhatsAppContactConsent } from '../whatsapp-safety/entities/whatsapp-contact-consent.entity';
import { WhatsAppSafetySettings } from '../whatsapp-safety/entities/whatsapp-safety-settings.entity';
import { StorageSessionOverride } from '../storage/entities/storage-session-override.entity';
import { AiEscalation } from '../ai/entities/ai-escalation.entity';
import { AiReplyEvent } from '../ai/entities/ai-reply-event.entity';
import { CustomerProfileEnrichment } from '../ai/entities/customer-profile-enrichment.entity';
import { CustomerProfileLearningEvent } from '../ai/entities/customer-profile-learning-event.entity';
import { LostDemandFollowup } from '../ai/entities/lost-demand-followup.entity';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { ProductDemandCampaign } from '../ai/entities/product-demand-campaign.entity';
import { ProductDemandEvent } from '../ai/entities/product-demand-event.entity';
import { FollowupAutopilotAudit } from '../followup/entities/followup-autopilot-audit.entity';
import {
  FollowupAutopilotSettings,
  FOLLOWUP_AUTOPILOT_SETTINGS_ID,
} from '../followup/entities/followup-autopilot-settings.entity';
import { StockingReminder } from '../ai/entities/stocking-reminder.entity';
import { AiLearningKnowledge } from '../ai/entities/ai-learning-knowledge.entity';
import { Webhook } from '../webhook/entities/webhook.entity';
import { InboxThreadPin } from '../message/entities/inbox-thread-pin.entity';
import { InboxThreadEvent } from '../message/entities/inbox-thread-event.entity';

/** Remove rows scoped to a WhatsApp session before the session row is deleted. */
export async function purgeSessionRelatedData(
  manager: EntityManager,
  sessionId: string,
): Promise<void> {
  const conversations = await manager.find(FollowupConversation, {
    where: { sessionId },
    select: ['id'],
  });
  const conversationIds = conversations.map(c => c.id);
  if (conversationIds.length > 0) {
    await manager.delete(FollowupAttempt, { conversationId: In(conversationIds) });
    await manager.delete(FollowupQueueItem, { conversationId: In(conversationIds) });
  }
  await manager.delete(FollowupConversation, { sessionId });

  const quotes = await manager.find(Quote, { where: { sessionId }, select: ['id'] });
  const quoteIds = quotes.map(q => q.id);
  if (quoteIds.length > 0) {
    await manager.delete(QuoteItem, { quoteId: In(quoteIds) });
  }
  await manager.delete(Quote, { sessionId });

  await manager.delete(Message, { sessionId });
  await manager.delete(MessageBatch, { sessionId });
  await manager.delete(InboxThreadRead, { sessionId });
  await manager.delete(InboxThreadSummary, { sessionId });
  await manager.delete(InboxThreadCrm, { sessionId });
  await manager.delete(InboxThreadPin, { sessionId });
  await manager.delete(InboxThreadEvent, { sessionId });
  await manager.delete(Webhook, { sessionId });
  await manager.delete(WhatsAppAccountWarmup, { sessionId });
  await manager.delete(WhatsAppSendQueue, { sessionId });
  await manager.delete(WhatsAppSendAudit, { sessionId });
  await manager.delete(WhatsAppSessionHealthEvent, { sessionId });
  await manager.delete(WhatsAppSessionAutomationState, { sessionId });
  await manager.delete(WhatsAppContactConsent, { sessionId });
  await manager.delete(WhatsAppSafetySettings, { sessionId });
  await manager.delete(StorageSessionOverride, { sessionId });
  await manager.delete(AiEscalation, { sessionId });
  await manager.delete(AiReplyEvent, { sessionId });
  await manager.delete(CustomerProfileEnrichment, { sessionId });
  await manager.delete(CustomerProfileLearningEvent, { sessionId });
  await manager.delete(LostDemandFollowup, { sessionId });
  await manager.delete(AiLearningItem, { sessionId });
  await manager.delete(ProductDemandCampaign, { sessionId });
  await manager.delete(ProductDemandEvent, { sessionId });
  await manager.delete(FollowupAutopilotAudit, { sessionId });
  await manager.delete(StockingReminder, { sessionId });
  await manager.delete(AiLearningKnowledge, { sessionId });

  const autopilotSettings = await manager.findOne(FollowupAutopilotSettings, {
    where: { id: FOLLOWUP_AUTOPILOT_SETTINGS_ID },
  });
  if (autopilotSettings?.sessionHealthJson) {
    try {
      const health = JSON.parse(autopilotSettings.sessionHealthJson) as Record<string, unknown>;
      if (sessionId in health) {
        delete health[sessionId];
        autopilotSettings.sessionHealthJson = JSON.stringify(health);
        await manager.save(autopilotSettings);
      }
    } catch {
      // Ignore corrupt JSON — session row is still being removed.
    }
  }
}
