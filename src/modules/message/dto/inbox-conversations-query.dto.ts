import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { InboxWorkQueue } from '../inbox-thread-state.types';
import type { InboxQueueCounts } from '../inbox-thread-state.types';
import type { LargeAccountDefaults } from '../large-account.util';

export enum InboxConversationStatusFilter {
  OPEN = 'open',
  RESOLVED = 'resolved',
}

export enum InboxConversationSort {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  PRIORITY = 'priority',
  OVERDUE = 'overdue',
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class InboxConversationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedStaffId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  assignedToMe?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({ enum: InboxConversationStatusFilter })
  @IsOptional()
  @IsEnum(InboxConversationStatusFilter)
  status?: InboxConversationStatusFilter;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  unread?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  overdueFollowup?: boolean;

  @ApiPropertyOptional({ description: 'AI handling state filter, e.g. waiting_human' })
  @IsOptional()
  @IsString()
  aiStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Lead source / conversation source filter' })
  @IsOptional()
  @IsString()
  leadSource?: string;

  @ApiPropertyOptional({
    description: 'Conversation type: direct_customer, group, broadcast, internal, system, spam',
  })
  @IsOptional()
  @IsString()
  conversationType?: string;

  @ApiPropertyOptional({ enum: InboxConversationSort, default: InboxConversationSort.NEWEST })
  @IsOptional()
  @IsEnum(InboxConversationSort)
  sort?: InboxConversationSort = InboxConversationSort.NEWEST;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({ description: 'Cursor pagination token (preferred over offset)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Work queue filter (server-calculated thread state)',
    enum: [
      'my_work',
      'needs_reply',
      'ai_needs_human',
      'hot_leads',
      'waiting_payment',
      'waiting_stock',
      'followup_due',
      'unassigned',
      'assigned_to_me',
      'all',
      'groups',
      'resolved',
      'failed_sends',
    ],
  })
  @IsOptional()
  @IsString()
  queue?: InboxWorkQueue;

  @ApiPropertyOptional({ description: 'Include per-queue counts in response' })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  includeCounts?: boolean;

  @ApiPropertyOptional({
    description: 'Only threads with activity in the last N days (large-account default filter)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  activeSinceDays?: number;

  @ApiPropertyOptional({
    description: 'Hide long-resolved threads from list (large-account cold tier)',
  })
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  excludeColdResolved?: boolean;

  @ApiPropertyOptional({ description: 'Resolved threads inactive longer than N days are cold tier' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  coldResolvedDays?: number;
}

export interface InboxQueryContext {
  allowedSessionIds?: string[];
  apiKeyId: string;
  role: string;
}

export interface UnifiedConversationsResult {
  conversations: import('../message.service').ConversationSummary[];
  total: number;
  limit: number;
  offset: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  counts?: InboxQueueCounts;
  largeAccountMode?: boolean;
  totalApproximate?: boolean;
  threadTotal?: number;
  /** True when merging multiple sessions would be expensive at this scale. */
  recommendSingleSession?: boolean;
  largeAccountDefaults?: LargeAccountDefaults;
}

export interface InboxQueueCountsResult {
  counts: InboxQueueCounts;
  cached?: boolean;
  largeAccountMode?: boolean;
}

export interface InboxThreadSearchResult {
  threads: Array<{
    sessionId: string;
    chatId: string;
    displayName: string | null;
    lastPreview: string | null;
    lastMessageAt: string;
    unreadCount: number;
    matchReason?: string;
  }>;
  total: number;
  limit: number;
}
