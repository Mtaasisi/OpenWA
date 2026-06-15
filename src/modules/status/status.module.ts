import { Module } from '@nestjs/common';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { SessionModule } from '../session/session.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';

@Module({
  imports: [SessionModule, WhatsAppSafetyModule],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
