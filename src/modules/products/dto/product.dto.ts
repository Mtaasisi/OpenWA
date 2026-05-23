import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  IsIn,
  IsObject,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { VariantType } from '../entities/product-variant.entity';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateVariantDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ enum: ['standard', 'parent', 'imei_child'] })
  @IsOptional()
  @IsIn(['standard', 'parent', 'imei_child'])
  variantType?: VariantType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isParent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentVariantId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string | number | boolean | null> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ enum: ['standard', 'parent', 'imei_child'] })
  @IsOptional()
  @IsIn(['standard', 'parent', 'imei_child'])
  variantType?: VariantType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isParent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentVariantId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string | number | boolean | null> | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateInauzwaSyncPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSyncEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(5)
  autoSyncIntervalMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  refreshBeforeSend?: boolean;

  @ApiPropertyOptional({ description: 'Postgres URL for direct INAUZWA inventory sync' })
  @IsOptional()
  @IsString()
  databaseUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiUrl?: string | null;

  @ApiPropertyOptional({ description: 'Empty string leaves the stored token unchanged' })
  @IsOptional()
  @IsString()
  apiToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clearConnection?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  loginEmail?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  useSupabaseAuth?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supabaseUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supabaseAnonKey?: string | null;
}

export class InauzwaLoginDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({ description: 'INAUZWA API base URL (defaults to INAUZWA_API_URL from .env)' })
  @IsOptional()
  @IsString()
  apiUrl?: string;

  @ApiPropertyOptional({ description: 'Supabase project URL (defaults to INAUZWA_SUPABASE_URL)' })
  @IsOptional()
  @IsString()
  supabaseUrl?: string;

  @ApiPropertyOptional({ description: 'Supabase anon key (defaults to INAUZWA_SUPABASE_ANON_KEY)' })
  @IsOptional()
  @IsString()
  supabaseAnonKey?: string | null;
}

export class InauzwaSupabaseSessionDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  accessToken: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  email: string;

  @ApiProperty()
  @IsString()
  supabaseUrl: string;

  @ApiProperty()
  @IsString()
  supabaseAnonKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string | null;
}

export class TestInauzwaConnectionDto {
  @ApiPropertyOptional({ enum: ['database', 'api'] })
  @IsOptional()
  @IsIn(['database', 'api'])
  mode?: 'database' | 'api';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  databaseUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiToken?: string;
}

export class SendProductMessageDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  chatId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeAllVariants?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeAvailableDevices?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inStockOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeImage?: boolean;

  @ApiPropertyOptional({
    description: 'Refresh stock from INAUZWA before sending (uses saved preference when omitted)',
  })
  @IsOptional()
  @IsBoolean()
  refreshStock?: boolean;
}

export class InauzwaSyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ enum: ['merge', 'replace'] })
  @IsOptional()
  @IsIn(['merge', 'replace'])
  mode?: 'merge' | 'replace';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

export class ProductListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inStockOnly?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}
