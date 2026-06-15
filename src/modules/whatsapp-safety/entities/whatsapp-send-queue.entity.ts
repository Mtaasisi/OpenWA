import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  WhatsAppMessageType,
  WhatsAppQueuePriority,
  WhatsAppQueueStatus,
  WhatsAppRiskLevel,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';

@Entity('whatsapp_send_queue')
@Index(['sessionId', 'status'])
@Index(['status', 'scheduledAt'])
export class WhatsAppSendQueue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar' })
  chatId: string;

  @Column({ type: 'varchar' })
  messageType: WhatsAppMessageType;

  @Column({ type: 'text' })
  messageBody: string;

  @Column({ type: 'simple-json', nullable: true })
  mediaUrls: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  templateId: string | null;

  @Column({ type: 'varchar' })
  source: WhatsAppSendSource;

  @Column({ type: 'varchar', default: WhatsAppQueuePriority.NORMAL })
  priority: WhatsAppQueuePriority;

  @Column({ type: 'varchar', default: WhatsAppQueueStatus.PENDING })
  status: WhatsAppQueueStatus;

  @Column({ type: 'varchar', default: WhatsAppRiskLevel.LOW })
  riskLevel: WhatsAppRiskLevel;

  @Column({ type: 'simple-json', nullable: true })
  guardDecision: Record<string, unknown> | null;

  @Column({ type: 'simple-json', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  scheduledAt: Date | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  sentAt: Date | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  failedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
