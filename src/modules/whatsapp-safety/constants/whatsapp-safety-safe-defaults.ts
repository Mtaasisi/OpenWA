import type { WhatsAppSafetySettings } from '../entities/whatsapp-safety-settings.entity';
import { AI_UNRESTRICTED_SAFETY_PATCH } from '../../ai/utils/ai-unrestricted.util';

/**
 * Safe-by-default WhatsApp safety configuration.
 * AI reply pacing defaults to instant (0ms delay) for fast auto-reply out of the box.
 * Risky features (campaigns, bulk send, etc.) stay off until explicitly enabled.
 */
export const WHATSAPP_SAFETY_SAFE_DEFAULTS: Partial<WhatsAppSafetySettings> = {
  globalEnabled: true,
  warmupEnabled: true,
  aiSafetyEnabled: true,
  aiAutoReplyEnabled: true,
  riskyIntentRequiresApproval: false,
  unknownQuestionRequiresApproval: false,
  startupSafeModeEnabled: true,
  outside24hRequiresTemplate: true,
  campaignsEnabled: false,
  followupAutoSendEnabled: false,
  groupsAutoReplyEnabled: false,
  groupManagementEnabled: false,
  productBulkSendEnabled: false,
  statusPostsEnabled: false,
  whatsappCloudSyncEnabled: false,
  autoDownloadMediaOnStartup: false,
  fetchGroupInfoOnStartup: false,
  sendSeenOnStartup: false,
  maxOutboundPerHour: 30,
  maxOutboundPerDay: 200,
  maxAutoRepliesPerCustomerPerDay: AI_UNRESTRICTED_SAFETY_PATCH.maxAutoRepliesPerCustomerPerDay,
  maxCampaignMessagesPerHour: 20,
  maxCampaignMessagesPerDay: 0,
  minAiReplyDelayMs: AI_UNRESTRICTED_SAFETY_PATCH.minAiReplyDelayMs,
  maxAiReplyDelayMs: AI_UNRESTRICTED_SAFETY_PATCH.maxAiReplyDelayMs,
  minDelayBetweenMessagesMs: AI_UNRESTRICTED_SAFETY_PATCH.minDelayBetweenMessagesMs,
  maxDelayBetweenMessagesMs: 25000,
  perContactCooldownMinutes: AI_UNRESTRICTED_SAFETY_PATCH.perContactCooldownMinutes,
  startupInitialDelayMinutes: 5,
  maxChatsToSyncInitially: 50,
  syncBatchSize: 10,
  syncBatchDelayMs: 60000,
};
