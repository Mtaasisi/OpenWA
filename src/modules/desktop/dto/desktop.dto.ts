import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class TestDatabaseDto {
  @IsOptional()
  @IsString()
  databaseUrl?: string;
}

export class CreateAdminDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @ValidateIf((dto: CreateAdminDto) => !!dto.password?.trim())
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class SetupBranchDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  locationDescription?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class RegisterDeviceDto {
  @IsString()
  deviceId!: string;

  @IsString()
  deviceName!: string;

  @IsOptional()
  @IsString()
  businessId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsString()
  os?: string;
}
