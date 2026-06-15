import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class InboxSendTextDto {
  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  text: string;

  @ApiPropertyOptional({ description: 'WhatsApp message id to quote in reply' })
  @IsOptional()
  @IsString()
  quotedMessageId?: string;
}
