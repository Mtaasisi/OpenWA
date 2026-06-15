import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSessionProxyDto {
  @ApiPropertyOptional({
    description: 'Proxy URL (empty to clear). e.g. socks5://user:pass@host:port',
    example: 'socks5://user:pass@proxy.example.com:1080',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  proxyUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Proxy type (required when proxyUrl is set)',
    enum: ['http', 'https', 'socks4', 'socks5'],
    example: 'socks5',
  })
  @IsOptional()
  @IsIn(['http', 'https', 'socks4', 'socks5'])
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5';
}
