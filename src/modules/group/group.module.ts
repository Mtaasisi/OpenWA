import { Module } from '@nestjs/common';
import { GroupController } from './group.controller';
import { SessionModule } from '../session/session.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';

@Module({
  imports: [SessionModule, AuditModule, AuthModule, WhatsAppSafetyModule],
  controllers: [GroupController],
})
export class GroupModule {}
