import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import {
  WhatsAppMessageType,
  WhatsAppRiskLevel,
  WhatsAppSendAuditDecision,
  WhatsAppSendSource,
} from '../enums/whatsapp-safety.enums';

@Entity('whatsapp_send_audit')
@Index(['sessionId', 'createdAt'])
@Index(['phone', 'createdAt'])
@Index(['sessionId', 'bodyHash', 'createdAt'])
export class WhatsAppSendAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @Column({ type: 'varchar' })
  source: WhatsAppSendSource;

  @Column({ type: 'varchar' })
  messageType: WhatsAppMessageType;

  @Column({ type: 'varchar' })
  decision: WhatsAppSendAuditDecision;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar', default: WhatsAppRiskLevel.LOW })
  riskLevel: WhatsAppRiskLevel;

  @Column({ type: 'simple-json', nullable: true })
  guardChecks: Record<string, unknown> | null;

  @Column({ type: 'varchar', nullable: true })
  queueItemId: string | null;

  /** SHA-256 prefix of normalized message body for duplicate detection. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  bodyHash: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
