import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmsProviderSettings } from './entities/sms-provider-settings.entity';
import { SmsMessageLog } from './entities/sms-message-log.entity';
import { SmsService } from './sms.service';
import { SmsController } from './sms.controller';
import { MobishastraProvider } from './providers/mobishastra.provider';
import { AuditModule } from '../audit/audit.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SmsProviderSettings, SmsMessageLog], 'data'),
    AuditModule,
    EventsModule,
  ],
  controllers: [SmsController],
  providers: [SmsService, MobishastraProvider],
  exports: [SmsService],
})
export class SmsModule {}
