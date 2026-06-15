import { IsBoolean } from 'class-validator';

export class UpdateSessionAiAutoReplyDto {
  @IsBoolean()
  enabled: boolean;
}
