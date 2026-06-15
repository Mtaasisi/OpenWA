import { IsBoolean, IsInt, IsOptional, IsString, IsArray, Min, ArrayMaxSize } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateWhatsAppSafetySettingsDto {
  @IsOptional() @IsBoolean() globalEnabled?: boolean;
  @IsOptional() @IsBoolean() warmupEnabled?: boolean;
  @IsOptional() @IsInt() @Min(1) maxOutboundPerHour?: number;
  @IsOptional() @IsInt() @Min(1) maxOutboundPerDay?: number;
  @IsOptional() @IsInt() @Min(0) maxAutoRepliesPerCustomerPerDay?: number;
  @IsOptional() @IsInt() @Min(0) maxCampaignMessagesPerHour?: number;
  @IsOptional() @IsInt() @Min(0) maxCampaignMessagesPerDay?: number;
  @IsOptional() @IsInt() @Min(0) minDelayBetweenMessagesMs?: number;
  @IsOptional() @IsInt() @Min(0) maxDelayBetweenMessagesMs?: number;
  @IsOptional() @IsInt() @Min(0) perContactCooldownMinutes?: number;
  @IsOptional() @IsBoolean() outside24hRequiresTemplate?: boolean;
  @IsOptional() @IsBoolean() groupsAutoReplyEnabled?: boolean;
  @IsOptional() @IsBoolean() groupManagementEnabled?: boolean;
  @IsOptional() @IsBoolean() statusPostsEnabled?: boolean;
  @IsOptional() @IsBoolean() whatsappCloudSyncEnabled?: boolean;
  @IsOptional() @IsString() whatsappCloudWabaId?: string | null;
  @IsOptional() @IsBoolean() campaignsEnabled?: boolean;
  @IsOptional() @IsBoolean() followupAutoSendEnabled?: boolean;
  @IsOptional() @IsBoolean() aiAutoReplyEnabled?: boolean;
  @IsOptional() @IsBoolean() startupSafeModeEnabled?: boolean;
  @IsOptional() @IsInt() startupInitialDelayMinutes?: number;
  @IsOptional() @IsInt() maxChatsToSyncInitially?: number;
  @IsOptional() @IsInt() syncBatchSize?: number;
  @IsOptional() @IsInt() syncBatchDelayMs?: number;
  @IsOptional() @IsArray() optOutKeywords?: string[];
  @IsOptional() @IsBoolean() aiSafetyEnabled?: boolean;
  @IsOptional() @IsBoolean() productBulkSendEnabled?: boolean;
  @IsOptional() @IsInt() @Min(0) maxAutoRepliesPerHour?: number;
  @IsOptional() @IsInt() @Min(0) minAiReplyDelayMs?: number;
  @IsOptional() @IsInt() @Min(0) maxAiReplyDelayMs?: number;
  @IsOptional() @IsBoolean() riskyIntentRequiresApproval?: boolean;
  @IsOptional() @IsBoolean() unknownQuestionRequiresApproval?: boolean;
  @IsOptional() @IsBoolean() autoDownloadMediaOnStartup?: boolean;
  @IsOptional() @IsBoolean() fetchGroupInfoOnStartup?: boolean;
  @IsOptional() @IsBoolean() sendSeenOnStartup?: boolean;
}

export class CheckSendDto {
  @IsString() sessionId!: string;
  @IsString() chatId!: string;
  @IsString() body!: string;
  @IsOptional() @IsString() messageType?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsBoolean() isManualStaffSend?: boolean;
  @IsOptional() @IsString() templateId?: string;
}

export class CampaignPreflightDto {
  @IsString() sessionId!: string;
  @IsString() messageBody!: string;
  recipients!: Array<{ phone: string; chatId: string }>;
  @IsOptional() @IsString() templateId?: string;
}

export class PatchWarmupDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() dayNumber?: number;
  @IsOptional() @IsBoolean() repliesOnly?: boolean;
  @IsOptional() @IsBoolean() allowCampaigns?: boolean;
  @IsOptional() @IsBoolean() allowFollowupAutoSend?: boolean;
  @IsOptional() @IsBoolean() allowAiAutoReply?: boolean;
}

export class RestoreOptOutDto {
  @IsOptional() @IsBoolean() canMarketing?: boolean;
  @IsOptional() @IsBoolean() canFollowup?: boolean;
}

export class PatchConsentDto {
  @IsOptional() @IsString() optInStatus?: string;
  @IsOptional() @IsBoolean() canMarketing?: boolean;
  @IsOptional() @IsBoolean() canUtility?: boolean;
  @IsOptional() @IsBoolean() canFollowup?: boolean;
}

export class ApproveQueueDto {
  @IsOptional() @IsString() approvedBy?: string;
}

export class CloudSendTemplateDto {
  @IsString() sessionId!: string;
  @IsString() chatId!: string;
  @IsString() templateId!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) bodyParameters?: string[];
}
