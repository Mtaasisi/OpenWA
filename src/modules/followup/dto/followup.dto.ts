import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import {
  ConversationSource,
  ConversationStage,
  ConversationPriority,
  LostReason,
  TemplateCategory,
  WhatsAppTemplateStatus,
  FollowUpTriggerEvent,
  FollowUpMode,
  FollowUpOutcome,
  FollowUpAutopilotMode,
} from '../followup.enums';

export class UpdateConversationDto {
  @IsOptional() @IsString() customerId?: string | null;
  @IsOptional() @IsString() customerName?: string | null;
  @IsOptional() @IsString() customerPhone?: string | null;
  @IsOptional() @IsString() customerHandle?: string | null;
  @IsOptional() @IsEnum(ConversationSource) source?: ConversationSource;
  @IsOptional() @IsString() channel?: string | null;
  @IsOptional() @IsString() assignedStaffId?: string | null;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsEnum(ConversationStage) stage?: ConversationStage;
  @IsOptional() @IsString() productInterest?: string | null;
  @IsOptional() @IsString() productId?: string | null;
  @IsOptional() @IsNumber() budget?: number | null;
  @IsOptional() @IsEnum(ConversationPriority) priority?: ConversationPriority;
  @IsOptional() @IsString() linkedSaleId?: string | null;
  @IsOptional() @IsString() outcome?: string | null;
  @IsOptional() @IsEnum(LostReason) lostReason?: LostReason | null;
  @IsOptional() @IsString() internalNote?: string | null;
  @IsOptional() @IsBoolean() alternativeOffered?: boolean;
  @IsOptional() @IsBoolean() followupRequired?: boolean;
  @IsOptional() @IsBoolean() followupCompleted?: boolean;
  @IsOptional() @IsBoolean() customerRefusedFollowup?: boolean;
  @IsOptional() @IsString() nextAction?: string | null;
  @IsOptional() @IsString() nextFollowupAt?: string | null;
}

export class CloseLostDto {
  @IsEnum(LostReason) lostReason: LostReason;
  @IsString() lostNotes: string;
  @IsBoolean() alternativeOffered: boolean;
  @IsOptional() @IsBoolean() customerRefusedFollowup?: boolean;
}

export class SetStageDto {
  @IsEnum(ConversationStage) stage: ConversationStage;
  @IsString() sessionId: string;
  @IsString() chatId: string;
}

export class CreateTemplateDto {
  @IsString() name: string;
  @IsEnum(TemplateCategory) category: TemplateCategory;
  @IsString() body: string;
  @IsOptional() @IsString() smsBody?: string | null;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsBoolean() requiresWhatsappApproval?: boolean;
  @IsOptional() @IsString() whatsappTemplateName?: string | null;
  @IsOptional() @IsEnum(WhatsAppTemplateStatus) whatsappTemplateStatus?: WhatsAppTemplateStatus;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(TemplateCategory) category?: TemplateCategory;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() smsBody?: string | null;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsBoolean() requiresWhatsappApproval?: boolean;
  @IsOptional() @IsString() whatsappTemplateName?: string | null;
  @IsOptional() @IsEnum(WhatsAppTemplateStatus) whatsappTemplateStatus?: WhatsAppTemplateStatus;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateRuleDto {
  @IsString() name: string;
  @IsEnum(FollowUpTriggerEvent) triggerEvent: FollowUpTriggerEvent;
  @IsOptional() @IsEnum(ConversationStage) stage?: ConversationStage | null;
  @IsOptional() @IsString() condition?: string | null;
  @IsOptional() @IsNumber() delayMinutes?: number;
  @IsOptional() @IsString() templateId?: string | null;
  @IsOptional() @IsEnum(FollowUpMode) mode?: FollowUpMode;
  @IsOptional() @IsNumber() maxAttempts?: number;
  @IsOptional() @IsBoolean() stopIfCustomerReplied?: boolean;
  @IsOptional() @IsBoolean() stopIfSaleLinked?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() branchId?: string | null;
}

export class UpdateRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(FollowUpTriggerEvent) triggerEvent?: FollowUpTriggerEvent;
  @IsOptional() @IsEnum(ConversationStage) stage?: ConversationStage | null;
  @IsOptional() @IsString() condition?: string | null;
  @IsOptional() @IsNumber() delayMinutes?: number;
  @IsOptional() @IsString() templateId?: string | null;
  @IsOptional() @IsEnum(FollowUpMode) mode?: FollowUpMode;
  @IsOptional() @IsNumber() maxAttempts?: number;
  @IsOptional() @IsBoolean() stopIfCustomerReplied?: boolean;
  @IsOptional() @IsBoolean() stopIfSaleLinked?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() branchId?: string | null;
}

export class CompleteFollowupDto {
  @IsEnum(FollowUpOutcome) outcome: FollowUpOutcome;
  @IsOptional() @IsString() messageBody?: string;
  @IsOptional() @IsBoolean() sent?: boolean;
}

export class RescheduleDto {
  @IsString() dueAt: string;
  @IsOptional() @IsString() notes?: string;
}

export class SendFollowupDto {
  @IsOptional() variables?: Record<string, string>;
  @IsOptional() @IsString() channel?: 'whatsapp' | 'sms' | 'both';
}

export class MarkWonDto {
  @IsOptional() @IsString() linkedSaleId?: string;
}

export class AssignFollowupDto {
  @IsString() staffId: string;
}

export class PreviewTemplateDto {
  [key: string]: string | undefined;
}

export class CreateManualLeadDto {
  @IsString() customerName: string;
  @IsEnum(ConversationSource) source: ConversationSource;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsString() customerHandle?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() assignedStaffId?: string;
  @IsOptional() @IsEnum(ConversationPriority) priority?: ConversationPriority;
  @IsOptional() @IsString() productInterest?: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() firstMessageAt?: string;
}

export class LinkSaleDto {
  @IsString() saleId: string;
  @IsOptional() @IsEnum(ConversationSource) leadSource?: ConversationSource;
  @IsOptional() @IsString() assignedStaffId?: string;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() quoteId?: string;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsNumber() grossProfit?: number;
}

export class SetLeadSourceDto {
  @IsEnum(ConversationSource) source: ConversationSource;
}

export class AssignConversationDto {
  @IsOptional()
  @IsString()
  staffId?: string | null;
}

export class UpdateAutopilotSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsEnum(FollowUpAutopilotMode) autopilotMode?: FollowUpAutopilotMode;
  @IsOptional() @IsBoolean() businessHoursOnly?: boolean;
  @IsOptional() @IsString() quietHoursStart?: string;
  @IsOptional() @IsString() quietHoursEnd?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsNumber() maxFollowupsPerCustomerPerDay?: number;
  @IsOptional() @IsNumber() maxFollowupsPerLead?: number;
  @IsOptional() @IsBoolean() requireApprovalForMediumRisk?: boolean;
  @IsOptional() @IsBoolean() requireApprovalForHighRisk?: boolean;
  @IsOptional() @IsBoolean() allowSmsFallback?: boolean;
  @IsOptional() @IsBoolean() allowWhatsAppSmsBoth?: boolean;
  @IsOptional() @IsBoolean() allowGroupAutopilot?: boolean;
  @IsOptional() @IsBoolean() pauseOnHighFailureRate?: boolean;
  @IsOptional() @IsBoolean() pauseOnCustomerComplaint?: boolean;
  @IsOptional() @IsNumber() staffTakeoverPauseMinutes?: number;
}

export class ApproveAutopilotDto {
  @IsOptional() @IsString() message?: string;
}

export class RejectAutopilotDto {
  @IsOptional() @IsString() reason?: string;
}
