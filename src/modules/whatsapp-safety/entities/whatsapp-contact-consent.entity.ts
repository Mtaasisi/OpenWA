import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsAppOptInSource, WhatsAppOptInStatus } from '../enums/whatsapp-safety.enums';

@Entity('whatsapp_contact_consent')
@Index(['normalizedPhone'])
@Index(['sessionId', 'normalizedPhone'])
export class WhatsAppContactConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar' })
  phone: string;

  @Column({ type: 'varchar' })
  normalizedPhone: string;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', default: WhatsAppOptInStatus.UNKNOWN })
  optInStatus: WhatsAppOptInStatus;

  @Column({ type: 'varchar', default: WhatsAppOptInSource.UNKNOWN })
  optInSource: WhatsAppOptInSource;

  @Column({ type: 'simple-json', default: '{}' })
  optInCategories: Record<string, boolean>;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  optInAt: Date | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  optOutAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  optOutReason: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  lastUserMessageAt: Date | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  lastOutboundMessageAt: Date | null;

  @Column({ default: false })
  canMarketing: boolean;

  @Column({ default: true })
  canUtility: boolean;

  @Column({ default: true })
  canFollowup: boolean;

  @Column({ default: false })
  optOutAckSent: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
