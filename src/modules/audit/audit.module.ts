import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { Session } from '../session/entities/session.entity';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog], 'main'),
    TypeOrmModule.forFeature([Session], 'data'),
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
