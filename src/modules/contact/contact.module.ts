import { Module, forwardRef } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ProfilePictureCacheService } from './profile-picture-cache.service';
import { SessionModule } from '../session/session.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [forwardRef(() => SessionModule), forwardRef(() => MessageModule)],
  controllers: [ContactController],
  providers: [ProfilePictureCacheService],
  exports: [ProfilePictureCacheService],
})
export class ContactModule {}
