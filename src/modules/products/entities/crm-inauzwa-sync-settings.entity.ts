import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import { dateColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';

export const INAUZWA_SYNC_SETTINGS_ID = 'default';

@Entity('crm_inauzwa_sync_settings')
export class CrmInauzwaSyncSettings {
  @PrimaryColumn({ default: INAUZWA_SYNC_SETTINGS_ID })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  vendorId: string | null;

  /** Postgres connection string for direct INAUZWA inventory sync (includes IMEI children). */
  @Column({ type: 'text', nullable: true })
  databaseUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  apiUrl: string | null;

  @Column({ type: 'text', nullable: true })
  apiToken: string | null;

  /** INAUZWA account email when connected via API login (display only). */
  @Column({ type: 'varchar', nullable: true })
  loginEmail: string | null;

  @Column({ default: false })
  useSupabaseAuth: boolean;

  @Column({ type: 'varchar', nullable: true })
  supabaseUrl: string | null;

  @Column({ type: 'text', nullable: true })
  supabaseAnonKey: string | null;

  @Column({ type: 'varchar', nullable: true })
  currency: string | null;

  @Column({ default: false })
  autoSyncEnabled: boolean;

  @Column({ type: 'int', default: 60 })
  autoSyncIntervalMinutes: number;

  @Column({ default: true })
  refreshBeforeSend: boolean;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  lastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  lastSyncResultJson: string | null;

  @Column({ type: 'text', nullable: true })
  lastSyncError: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
