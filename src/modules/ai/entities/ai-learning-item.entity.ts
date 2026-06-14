import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  AiLearningItemSource,
  AiLearningItemStatus,
  AiLearningOutcome,
  AiLearningTone,
} from '../ai-learning.enums';

@Entity('ai_learning_items')
@Index(['status', 'createdAt'])
@Index(['normalizedQuestion'])
@Index(['sessionId', 'chatId'])
export class AiLearningItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'text' })
  question: string;

  @Column({ type: 'varchar', length: 512 })
  normalizedQuestion: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  detectedIntent: string | null;

  @Column({ type: 'varchar', nullable: true })
  detectedProduct: string | null;

  @Column({ type: 'simple-json', nullable: true })
  contextMessages: Array<{ role: string; body: string; at?: string }> | null;

  @Column({ type: 'text', nullable: true })
  aiDraftAnswer: string | null;

  @Column({ type: 'text', nullable: true })
  adminFinalAnswer: string | null;

  @Column({ type: 'varchar', length: 32, default: AiLearningItemStatus.PENDING_REVIEW })
  status: AiLearningItemStatus;

  @Column({ type: 'real', default: 0 })
  confidenceScore: number;

  @Column({ type: 'text', nullable: true })
  whyUnsure: string | null;

  @Column({ type: 'varchar', length: 32, default: AiLearningItemSource.AUTO_UNKNOWN })
  source: AiLearningItemSource;

  @Column({ type: 'int', default: 1 })
  timesAsked: number;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority: string;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  targetFile: string | null;

  @Column({ type: 'varchar', nullable: true })
  knowledgeCategory: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  tone: AiLearningTone | null;

  @Column({ type: 'int', nullable: true })
  reviewPeriodDays: number | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  reviewDate: Date | null;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: 'varchar', nullable: true })
  similarGroupId: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  outcome: AiLearningOutcome | null;

  @Column({ type: 'varchar', nullable: true })
  mergedIntoId: string | null;

  @Column({ type: 'varchar', nullable: true })
  reviewerId: string | null;

  @Column({ type: 'varchar', length: '48', nullable: true })
  issueType: string | null;

  @Column({ type: 'varchar', length: '48', nullable: true })
  sourceType: string | null;

  @Column({ type: 'varchar', nullable: true })
  sourceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedEntityType: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedEntityId: string | null;

  @Column({ type: 'varchar', length: '300', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  conversationExcerpt: string | null;

  @Column({ type: 'varchar', nullable: true })
  suggestedMemoryType: string | null;

  @Column({ type: 'varchar', nullable: true })
  suggestedRuleCategory: string | null;

  @Column({ type: 'varchar', nullable: true })
  suggestedQuestionType: string | null;

  @Column({ type: 'boolean', nullable: true, default: true })
  createdByAi: boolean | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  reviewedAt: Date | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  appliedAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
