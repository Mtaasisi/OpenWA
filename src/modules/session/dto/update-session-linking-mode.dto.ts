import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSessionLinkingModeDto {
  @ApiProperty({
    description:
      'Enable linking mode to protect QR scan from auto-restart/reconnect storms. Cleared automatically when session reaches ready.',
    example: true,
  })
  @IsBoolean()
  linkingMode!: boolean;
}
