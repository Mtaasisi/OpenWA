import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupRecord } from './entities/backup-record.entity';
import { BackupSettings } from './entities/backup-settings.entity';
import { BackupService } from './backup.service';
import { BackupRestoreService } from './backup-restore.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupController } from './backup.controller';
import { StorageManagementModule } from '../storage/storage.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BackupRecord, BackupSettings], 'data'),
    StorageManagementModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupRestoreService, BackupSchedulerService],
  exports: [BackupService],
})
export class BackupModule {}
