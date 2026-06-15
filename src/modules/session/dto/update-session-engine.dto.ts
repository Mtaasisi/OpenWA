import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, ValidateIf } from 'class-validator';
import { WHATSAPP_ENGINE_IDS } from '../../../common/utils/session-engine.util';

export class UpdateSessionEngineDto {
  @ApiPropertyOptional({
    description: 'Per-session engine override (null = use global ENGINE_TYPE)',
    enum: [...WHATSAPP_ENGINE_IDS],
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsIn([...WHATSAPP_ENGINE_IDS])
  engineType?: string | null;
}
