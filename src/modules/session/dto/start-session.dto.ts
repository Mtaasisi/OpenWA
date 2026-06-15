import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class StartSessionDto {
  @ApiPropertyOptional({
    description:
      'When true, pauses health-monitor auto-restart and connect-phase auto-retry until ready or stop. Defaults to true for sessions that have never been linked (no phone).',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  linkingMode?: boolean;
}
