import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';

export enum AiLearnedIntentStatus {
  ACTIVE = 'active',
  PENDING_REVIEW = 'pending_review',
  DISABLED = 'disabled',
  REJECTED = 'rejected',
}

export enum AiLearnedIntentMatchType {
  EXACT = 'exact',
  SIMILAR = 'similar',
}

@Entity('ai_learned_intents')
@Index(['normalizedPhrase'])
@Index(['intent'])
@Index(['status'])
@Index(['branchId'])
@Index(['usageCount'])
@Index(['lastUsedAt'])
export class AiLearnedIntent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'text' })
  phrase: string;

  @Column({ type: 'text' })
  normalizedPhrase: string;

  @Column({ type: 'varchar', default: 'sw' })
  language: string;

  @Column({ type: 'varchar' })
  intent: string;

  @Column({ type: 'text', nullable: true })
  meaning: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number;

  @Column({ type: 'varchar', nullable: true })
  replyTemplateId: string | null;

  @Column({ type: 'text', nullable: true })
  suggestedReply: string | null;

  @Column({ type: 'simple-json', nullable: true })
  replyVariations: string[] | null;

  @Column({ type: 'varchar', default: AiLearnedIntentMatchType.EXACT })
  matchType: AiLearnedIntentMatchType | string;

  @Column({ type: 'varchar', default: AiLearnedIntentStatus.ACTIVE })
  status: AiLearnedIntentStatus | string;

  @Column({ default: false })
  autoApproved: boolean;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  lastUsedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  createdFromMessageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdFromConversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
