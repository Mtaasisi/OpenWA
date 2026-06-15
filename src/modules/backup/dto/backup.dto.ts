import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import type { BackupType } from '../entities/backup-record.entity';
import type {
  BackupDestination,
  BackupMediaScope,
  BackupSchedule,
} from '../entities/backup-settings.entity';

const BACKUP_TYPES: BackupType[] = [
  'messagesOnly',
  'crmOnly',
  'messagesAndCrm',
  'mediaOnly',
  'full',
];

const MEDIA_SCOPES: BackupMediaScope[] = ['exclude', 'imagesOnly', 'documentsOnly', 'all'];

const BACKUP_SCHEDULES: BackupSchedule[] = ['manual', 'daily', 'weekly', 'monthly'];

const BACKUP_DESTINATIONS: BackupDestination[] = ['local', 's3', 'r2'];

export class CreateBackupDto {
  @IsIn(BACKUP_TYPES)
  backupType!: BackupType;

  @IsOptional()
  @IsIn(MEDIA_SCOPES)
  mediaScope?: BackupMediaScope;

  @IsOptional()
  @IsBoolean()
  includeMedia?: boolean;
}

export class SaveBackupSettingsDto {
  @IsOptional()
  @IsIn(BACKUP_SCHEDULES)
  schedule?: BackupSchedule;

  @IsOptional()
  @IsString()
  backupTime?: string;

  @IsOptional()
  @IsBoolean()
  includeMedia?: boolean;

  @IsOptional()
  @IsIn(MEDIA_SCOPES)
  mediaScope?: BackupMediaScope;

  @IsOptional()
  @IsIn(BACKUP_DESTINATIONS)
  destination?: BackupDestination;

  @IsOptional()
  @IsString()
  s3Bucket?: string | null;

  @IsOptional()
  @IsString()
  s3Region?: string | null;
}

export class RestoreBackupDto {
  @IsBoolean()
  confirm!: boolean;

  @IsOptional()
  @IsIn(['merge', 'upsert'])
  mode?: 'merge' | 'upsert';
}
