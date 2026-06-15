import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

export const BACKUP_SETTINGS_ID = 'default';

export type BackupSchedule = 'manual' | 'daily' | 'weekly' | 'monthly';
export type BackupDestination = 'local' | 's3' | 'r2';
export type BackupMediaScope = 'exclude' | 'imagesOnly' | 'documentsOnly' | 'all';

@Entity('backup_settings')
export class BackupSettings {
  @PrimaryColumn({ default: BACKUP_SETTINGS_ID })
  id: string;

  @Column({ type: 'varchar', default: 'manual' })
  schedule: BackupSchedule;

  @Column({ type: 'varchar', default: '02:00' })
  backupTime: string;

  @Column({ default: false })
  includeMedia: boolean;

  @Column({ type: 'varchar', default: 'exclude' })
  mediaScope: BackupMediaScope;

  @Column({ type: 'varchar', default: 'local' })
  destination: BackupDestination;

  @Column({ type: 'varchar', nullable: true })
  s3Bucket: string | null;

  @Column({ type: 'varchar', nullable: true })
  s3Region: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
