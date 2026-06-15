import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuoteStatus } from '../quote.enums';

export class QuoteItemInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @ApiProperty()
  @IsString()
  itemName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warranty?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown> | null;
}

export class CreateChatQuoteDto {
  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conversationId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @ApiPropertyOptional({ type: [QuoteItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items?: QuoteItemInputDto[];
}

export class UpdateQuoteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPhone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentInstructions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchPickupInfo?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiPropertyOptional({ type: [QuoteItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemInputDto)
  items?: QuoteItemInputDto[];
}

export class AddQuoteItemDto extends QuoteItemInputDto {}

export class SendQuoteDto {
  @ApiPropertyOptional({ description: 'Override message body; defaults to formatted quote' })
  @IsOptional()
  @IsString()
  messageBody?: string;
}

export class ConvertQuoteDto {
  @ApiPropertyOptional({ description: 'Manual sale id when INAUZWA push is disabled' })
  @IsOptional()
  @IsString()
  linkedSaleId?: string;

  @ApiPropertyOptional({ description: 'Record as payment pending in INAUZWA checkout' })
  @IsOptional()
  @IsBoolean()
  paymentPending?: boolean;
}

export class QuoteStatusDto {
  @ApiProperty({ enum: QuoteStatus })
  @IsEnum(QuoteStatus)
  status: QuoteStatus;
}

export class QuoteListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chatId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;
}
