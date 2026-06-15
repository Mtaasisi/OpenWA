import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import {
  WhatsAppSessionHealthEventType,
  WhatsAppSessionHealthSeverity,
} from '../enums/whatsapp-safety.enums';

@Entity('whatsapp_session_health_events')
@Index(['sessionId', 'createdAt'])
export class WhatsAppSessionHealthEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar' })
  eventType: WhatsAppSessionHealthEventType;

  @Column({ type: 'varchar', default: WhatsAppSessionHealthSeverity.INFO })
  severity: WhatsAppSessionHealthSeverity;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('whatsapp_session_automation_state')
export class WhatsAppSessionAutomationState {
  @PrimaryColumn({ type: 'varchar' })
  sessionId: string;

  @Column({ default: false })
  automationPaused: boolean;

  @Column({ default: false })
  startupSafeMode: boolean;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  startupSafeModeUntil: Date | null;

  @Column({ type: 'int', default: 0 })
  sendFailuresRecent: number;

  @Column({ type: 'int', default: 0 })
  sendBlockedRecent: number;

  @Column({ type: 'int', default: 0 })
  sendsRecentHour: number;

  @Column({ type: 'int', default: 0 })
  sendsRecentDay: number;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  countersResetAt: Date | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  updatedAt: Date;
}
