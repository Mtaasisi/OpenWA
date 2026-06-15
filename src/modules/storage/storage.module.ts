import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BackupRecord } from '../backup/entities/backup-record.entity';
import { BackupSettings } from '../backup/entities/backup-settings.entity';
import { StorageConfig } from './entities/storage-config.entity';
import { StorageSessionOverride } from './entities/storage-session-override.entity';
import { StorageSettingsService } from './storage-settings.service';
import { StoragePolicyService } from './storage-policy.service';
import { StorageUsageService } from './storage-usage.service';
import { StorageCleanupService } from './storage-cleanup.service';
import { StorageController } from './storage.controller';
import { StoragePermissionGuard } from './guards/storage-permission.guard';
import { Message } from '../message/entities/message.entity';
import { Session } from '../session/entities/session.entity';
import { Quote } from '../quote/entities/quote.entity';
import { MessageModule } from '../message/message.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { StorageWarningWatcher } from './storage-warning-watcher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [StorageConfig, StorageSessionOverride, Message, Session, Quote, BackupRecord, BackupSettings],
      'data',
    ),
    forwardRef(() => MessageModule),
    AuditModule,
    AuthModule,
    EventsModule,
  ],
  controllers: [StorageController],
  providers: [
    StorageSettingsService,
    StoragePolicyService,
    StorageUsageService,
    StorageCleanupService,
    StoragePermissionGuard,
    StorageWarningWatcher,
  ],
  exports: [StorageSettingsService, StoragePolicyService],
})
export class StorageManagementModule {}
