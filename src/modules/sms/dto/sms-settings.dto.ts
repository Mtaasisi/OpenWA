import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SmsSettingsDto {
  @IsOptional()
  @IsString()
  profileId?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  senderId?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}

export class TestSmsDto {
  @IsString()
  toPhone: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class SendSmsDto {
  @IsString()
  toPhone: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  relatedType?: string;

  @IsOptional()
  @IsString()
  relatedId?: string;
}

export class BulkSmsRecipientDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;
}

export class BulkSmsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSmsRecipientDto)
  recipients: BulkSmsRecipientDto[];

  @IsString()
  message: string;
}

export class SmsLogsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  sentBy?: string;
}
