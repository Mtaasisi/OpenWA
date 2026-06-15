import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesktopController } from './desktop.controller';
import { DesktopService } from './desktop.service';
import { DesktopDevice } from './entities/desktop-device.entity';
import { Session } from '../session/entities/session.entity';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DesktopDevice, Session], 'data'),
    AuthModule,
    AiModule,
    WhatsAppSafetyModule,
  ],
  controllers: [DesktopController],
  providers: [DesktopService],
  exports: [DesktopService],
})
export class DesktopModule {}
