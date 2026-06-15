import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WhatsAppWarmupStatus } from '../enums/whatsapp-safety.enums';

@Entity('whatsapp_account_warmup')
@Index(['sessionId'], { unique: true })
export class WhatsAppAccountWarmup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sessionId: string;

  @Column({ type: 'varchar', default: WhatsAppWarmupStatus.ACTIVE })
  status: WhatsAppWarmupStatus;

  @Column({ type: dataDateTimeColumn() })
  startedAt: Date;

  @Column({ type: 'int', default: 1 })
  dayNumber: number;

  @Column({ type: 'int', default: 30 })
  maxOutboundToday: number;

  @Column({ type: 'int', default: 0 })
  maxCampaignToday: number;

  @Column({ default: true })
  repliesOnly: boolean;

  @Column({ default: false })
  allowCampaigns: boolean;

  @Column({ default: false })
  allowFollowupAutoSend: boolean;

  @Column({ default: true })
  allowAiAutoReply: boolean;

  @Column({ type: 'int', default: 0 })
  outboundSentToday: number;

  @Column({ type: 'int', default: 0 })
  autoReplySentToday: number;

  @Column({ type: 'int', default: 0 })
  followupSentToday: number;

  @Column({ type: 'int', default: 0 })
  campaignSentToday: number;

  @Column({ type: 'int', default: 10 })
  maxAutoRepliesToday: number;

  @Column({ type: 'int', default: 0 })
  maxFollowupsToday: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
