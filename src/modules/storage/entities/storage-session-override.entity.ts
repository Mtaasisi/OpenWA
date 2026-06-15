import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('storage_session_override')
export class StorageSessionOverride {
  @PrimaryColumn({ type: 'varchar' })
  sessionId: string;

  @Column({ default: false })
  allowGroupAutoDownload: boolean;

  @Column({ default: true })
  manualDownloadOnlyForGroups: boolean;

  @Column({ type: 'boolean', nullable: true })
  autoDownloadImages: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  autoDownloadVideos: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  autoDownloadDocuments: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  autoDownloadAudio: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  autoDownloadVoice: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  autoDownloadStickers: boolean | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
