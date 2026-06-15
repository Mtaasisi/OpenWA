import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type BackupType =
  | 'messagesOnly'
  | 'crmOnly'
  | 'messagesAndCrm'
  | 'mediaOnly'
  | 'full';

export type BackupStatus = 'pending' | 'completed' | 'failed';

@Entity('backup_records')
export class BackupRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column({ type: 'varchar' })
  backupType: BackupType;

  @Column({ type: 'simple-json', nullable: true })
  includedModules: string[] | null;

  @Column({ default: false })
  mediaIncluded: boolean;

  @Column({ type: 'bigint', default: 0 })
  fileSizeBytes: number;

  @Column({ type: 'varchar', nullable: true })
  appVersion: string | null;

  @Column({ type: 'varchar', nullable: true })
  dbVersion: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Index()
  @Column({ type: 'varchar', default: 'completed' })
  status: BackupStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
