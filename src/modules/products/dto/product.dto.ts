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
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { VariantType } from '../entities/product-variant.entity';
import type { InventoryItemStatus } from '../entities/inventory-item.entity';

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
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warrantyDefault?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['public', 'internal'])
  visibility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  installmentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  installmentMinDeposit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentDurationDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentScheduleType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPenaltyPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentExpiryDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  installmentRequiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowInstallmentWhenOutOfStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stockingReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentNotes?: string | null;
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
  brand?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tags?: string[] | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warrantyDefault?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['public', 'internal'])
  visibility?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  installmentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  installmentMinDeposit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentDurationDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentScheduleType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPenaltyPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentExpiryDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  installmentRequiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowInstallmentWhenOutOfStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stockingReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentNotes?: string | null;
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
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackInventoryItems?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

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
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  trackInventoryItems?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  installmentEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  installmentMinDeposit?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentDurationDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentScheduleType?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentPenaltyPolicy?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  installmentExpiryDays?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  installmentRequiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowInstallmentWhenOutOfStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stockingReminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  installmentNotes?: string | null;
}

export class CreateInventoryItemDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imei?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'available',
    'reserved',
    'sold',
    'returned',
    'repair_hold',
    'damaged',
    'lost',
    'transferred',
    'inactive',
  ])
  status?: InventoryItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  supplier?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purchaseBatch?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imei?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'available',
    'reserved',
    'sold',
    'returned',
    'repair_hold',
    'damaged',
    'lost',
    'transferred',
    'inactive',
  ])
  status?: InventoryItemStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  costPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sellingPrice?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}

export class BulkPasteInventoryDto {
  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  text: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class GenerateVariantsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  storageOptions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  colorOptions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  ramOptions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  conditionOptions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  gradeOptions?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  basePrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  skuPattern?: string;
}

// ... keep existing DTOs below (UpdateInauzwaSyncPreferencesDto through InauzwaSyncDto)

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncProducts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncCustomers?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncProformas?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncRecentSales?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncCategories?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushSalesToInauzwa?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPaymentInstructions?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBranchPickupInfo?: string | null;

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
  @IsUUID()
  inventoryItemId?: string;

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

export class ProductImportPreviewDto {
  @ApiProperty()
  @IsString()
  fileName: string;

  @ApiProperty()
  @IsIn(['csv', 'xlsx'])
  fileType: 'csv' | 'xlsx';

  @ApiProperty()
  @IsString()
  fileContentBase64: string;

  @ApiProperty()
  @IsString()
  importType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  columnMapping?: Record<string, string>;
}

export class ProductImportExecuteDto extends ProductImportPreviewDto {
  @ApiProperty()
  @IsString()
  mode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchId?: string;
}
