import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiKeyRole } from '../entities/api-key.entity';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @MinLength(1)
  refreshToken: string;
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(ApiKeyRole)
  role: ApiKeyRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ApiKeyRole)
  role?: ApiKeyRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: ApiKeyRole;
  staffId: string | null;
  isActive: boolean;
  createdAt: Date;
}

export class LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserResponseDto;
}
