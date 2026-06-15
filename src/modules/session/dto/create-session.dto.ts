import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength, Matches, IsIn, ValidateIf } from 'class-validator';
import { WHATSAPP_ENGINE_IDS } from '../../../common/utils/session-engine.util';

export class CreateSessionDto {
  @ApiProperty({
    description: 'Unique name for the session (alphanumeric and hyphens only)',
    example: 'my-bot',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message: 'Session name can only contain letters, numbers, and hyphens',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Session configuration options',
    example: { autoReconnect: true },
  })
  @IsOptional()
  config?: Record<string, unknown>;

  // Phase 3: Proxy per session
  @ApiPropertyOptional({
    description: 'Proxy URL for this session (e.g., http://user:pass@proxy.example.com:8080)',
    example: 'http://proxy.example.com:8080',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyUrl?: string;

  @ApiPropertyOptional({
    description: 'Proxy type',
    enum: ['http', 'https', 'socks4', 'socks5'],
    example: 'http',
  })
  @IsOptional()
  @IsIn(['http', 'https', 'socks4', 'socks5'])
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5';

  @ApiPropertyOptional({
    description: 'Pin this session to a specific engine (omit to use global ENGINE_TYPE)',
    enum: [...WHATSAPP_ENGINE_IDS],
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn([...WHATSAPP_ENGINE_IDS])
  engineType?: string;
}
