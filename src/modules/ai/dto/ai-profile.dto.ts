import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsIn,
  MinLength,
} from 'class-validator';
import { PaymentMethodType } from '../ai-signal.enums';

export class UpsertBranchAiProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiDisplayName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  googleMapsUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nearbyLandmarks?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  openingHours?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warrantyPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPolicyDefault?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aiTone?: string;
}

export class CreatePaymentAccountDto {
  @ApiProperty({ enum: PaymentMethodType })
  @IsIn(Object.values(PaymentMethodType))
  methodType: PaymentMethodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerName?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  accountName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  accountNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePaymentAccountDto {
  @ApiPropertyOptional({ enum: PaymentMethodType })
  @IsOptional()
  @IsIn(Object.values(PaymentMethodType))
  methodType?: PaymentMethodType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
