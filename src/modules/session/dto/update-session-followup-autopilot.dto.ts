import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateSessionFollowupAutopilotDto {
  @ApiProperty()
  @IsBoolean()
  followupAutopilotEnabled: boolean;
}
