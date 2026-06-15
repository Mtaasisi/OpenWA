import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { QuickReplyCategory } from '../quick-reply.enums';

export class CreateQuickReplyDto {
  @IsString() name: string;
  @IsEnum(QuickReplyCategory) category: QuickReplyCategory;
  @IsString() body: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateQuickReplyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(QuickReplyCategory) category?: QuickReplyCategory;
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() branchId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class PreviewQuickReplyDto {
  @IsOptional() @IsString() customer_name?: string;
  @IsOptional() @IsString() product_name?: string;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() staff_name?: string;
  @IsOptional() @IsString() branch_name?: string;
  @IsOptional() @IsString() payment_number?: string;
  @IsOptional() @IsString() pickup_location?: string;
  @IsOptional() @IsString() warranty?: string;
  @IsOptional() @IsString() delivery_fee?: string;
}
