import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from './entities/session.entity';
import { SessionService } from './session.service';
import { BackgroundSyncService } from './background-sync.service';
import { SessionHealthMonitorService } from './session-health-monitor.service';
import { SessionController } from './session.controller';
import { WebhookModule } from '../webhook/webhook.module';
import { MessageModule } from '../message/message.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Session], 'data'),
    StorageModule,
    forwardRef(() => WebhookModule),
    forwardRef(() => MessageModule),
    forwardRef(() => WhatsAppSafetyModule),
  ],
  controllers: [SessionController],
  providers: [SessionService, BackgroundSyncService, SessionHealthMonitorService],
  exports: [SessionService, BackgroundSyncService],
})
export class SessionModule {}
