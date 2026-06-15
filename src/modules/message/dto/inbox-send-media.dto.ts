import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { SendMediaMessageDto } from './send-message.dto';

export class InboxSendMediaDto extends SendMediaMessageDto {
  @ApiProperty()
  @IsString()
  sessionId: string;
}
