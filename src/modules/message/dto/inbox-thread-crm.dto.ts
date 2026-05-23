import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsDateString } from 'class-validator';

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
}

export interface InboxThreadCrmDto {
  sessionId: string;
  chatId: string;
  resolved: boolean;
  resolvedAt: string | null;
  internalNote: string | null;
  followUpAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  linkedExternalId: string | null;
  updatedAt: string;
}
