import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';

export enum AiUnknownMessageStatus {
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  MERGED = 'merged',
  IGNORED = 'ignored',
}

@Entity('ai_unknown_messages')
@Index(['normalizedText'])
@Index(['frequencyCount'])
@Index(['status'])
@Index(['branchId'])
export class AiUnknownMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId: string | null;

  @Column({ type: 'text' })
  rawText: string;

  @Column({ type: 'text', nullable: true })
  normalizedText: string | null;

  @Column({ type: 'varchar', nullable: true })
  detectedIntent: string | null;

  @Column({ type: 'text', nullable: true })
  aiSuggestedMeaning: string | null;

  @Column({ type: 'text', nullable: true })
  aiSuggestedReply: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number;

  @Column({ type: 'int', default: 1 })
  frequencyCount: number;

  @Column({ type: 'varchar', default: AiUnknownMessageStatus.PENDING_REVIEW })
  status: AiUnknownMessageStatus | string;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
