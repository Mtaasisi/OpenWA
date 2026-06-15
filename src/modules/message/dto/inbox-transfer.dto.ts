import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class InboxTransferDto {
  @ApiProperty()
  @IsString()
  fromSessionId: string;

  @ApiProperty()
  @IsString()
  toSessionId: string;

  @ApiProperty()
  @IsString()
  chatId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;
}
