import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSessionStaffAiDto {
  @ApiProperty({
    description: 'Phone numbers (E.164 or local) allowed to use CRM AI via WhatsApp',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  staffAiAllowedNumbers: string[];
}
