import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { jsonColumnType, dateColumnType } from '../../../common/utils/column-types';

export enum SessionStatus {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  QR_READY = 'qr_ready',
  AUTHENTICATING = 'authenticating',
  LOADING_CHATS = 'loading_chats',
  READY = 'ready',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: SessionStatus.CREATED,
  })
  status: SessionStatus;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pushName: string | null;

  @Column({ type: jsonColumnType(), default: '{}' })
  config: Record<string, unknown>;

  // Phase 3: Proxy per session
  @Column({ type: 'varchar', length: 255, nullable: true })
  proxyUrl: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  proxyType: 'http' | 'https' | 'socks4' | 'socks5' | null;

  /** When set, this session uses the given engine instead of global ENGINE_TYPE. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  engineType: string | null;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  connectedAt: Date | null;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  lastActiveAt: Date | null;

  /** Desktop app device that claimed control of this session (optional). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  controlledByDeviceId: string | null;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  controlledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
