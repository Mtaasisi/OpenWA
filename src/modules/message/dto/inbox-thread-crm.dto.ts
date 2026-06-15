import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsDateString, IsEnum } from 'class-validator';
import { InboxAiHandlingState } from '../../ai/inbox-ai-handling.enum';
import { InboxResolveOutcome } from './inbox-resolve-outcome.enum';
import { LostReason } from '../../followup/followup.enums';

export class UpdateInboxThreadCrmDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  resolved?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  internalNote?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsDateString()
  followUpAt?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Scheduled follow-up reason key' })
  @IsOptional()
  @IsString()
  followUpReason?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Staff note for the scheduled follow-up' })
  @IsOptional()
  @IsString()
  followUpNote?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  customerName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  linkedExternalId?: string | null;

  @ApiPropertyOptional({ description: 'Pause AI auto-reply for this chat' })
  @IsOptional()
  @IsBoolean()
  aiAutoReplyPaused?: boolean;

  @ApiPropertyOptional({ enum: InboxAiHandlingState })
  @IsOptional()
  @IsEnum(InboxAiHandlingState)
  aiHandlingState?: InboxAiHandlingState;

  @ApiPropertyOptional({ description: 'Customer opted out of AI auto-reply' })
  @IsOptional()
  @IsBoolean()
  aiOptOut?: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Reason selected when resolving the chat' })
  @IsOptional()
  @IsString()
  resolvedReason?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Optional note when resolving the chat' })
  @IsOptional()
  @IsString()
  resolvedNote?: string | null;

  @ApiPropertyOptional({ enum: InboxResolveOutcome })
  @IsOptional()
  @IsEnum(InboxResolveOutcome)
  outcome?: InboxResolveOutcome | null;

  @ApiPropertyOptional({ enum: LostReason })
  @IsOptional()
  @IsEnum(LostReason)
  lostReason?: LostReason | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  preferredBranchId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  confirmedCity?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  lastProductInterest?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  lastIntent?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  paymentReadiness?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  aiNotes?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  autopilotPauseReason?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'ISO 8601 — temporary staff-reply takeover expiry' })
  @IsOptional()
  @IsDateString()
  manualTakeoverUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  installmentInterest?: boolean;

  @ApiPropertyOptional({ description: 'Clear AI learning memory fields' })
  @IsOptional()
  @IsBoolean()
  clearAiMemory?: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Customer buying preferences (staff notes)' })
  @IsOptional()
  @IsString()
  buyingPreferences?: string | null;

  @ApiPropertyOptional({ description: 'Staff marked customer as discount negotiator' })
  @IsOptional()
  @IsBoolean()
  discountNegotiationMarked?: boolean;
}

export interface InboxThreadCrmDto {
  sessionId: string;
  chatId: string;
  resolved: boolean;
  resolvedAt: string | null;
  internalNote: string | null;
  followUpAt: string | null;
  followUpReason: string | null;
  followUpNote: string | null;
  customerName: string | null;
  customerPhone: string | null;
  linkedExternalId: string | null;
  aiAutoReplyPaused: boolean;
  aiHandlingState: InboxAiHandlingState;
  aiEscalatedAt: string | null;
  aiOptOut: boolean;
  followupAutopilotPaused: boolean;
  followupAutopilotPausedUntil: string | null;
  resolvedReason: string | null;
  resolvedNote: string | null;
  outcome: string | null;
  resolvedByStaffId: string | null;
  updatedAt: string;
  preferredBranchId: string | null;
  confirmedCity: string | null;
  lastProductInterest: string | null;
  lastIntent: string | null;
  discountRequestCount: number;
  installmentInterest: boolean;
  paymentReadiness: string | null;
  aiNotes: string | null;
  autopilotPauseReason: string | null;
  manualTakeoverUntil: string | null;
  buyingPreferences: string | null;
  discountNegotiationMarked: boolean;
}
