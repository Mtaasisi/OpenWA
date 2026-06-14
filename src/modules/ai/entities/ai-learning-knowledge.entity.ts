import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AiLearningKnowledgeStatus } from '../ai-learning.enums';

@Entity('ai_learning_knowledge')
@Index(['status', 'updatedAt'])
@Index(['questionPattern'])
export class AiLearningKnowledge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  questionPattern: string;

  @Column({ type: 'simple-json', nullable: true })
  alternativeQuestions: string[] | null;

  @Column({ type: 'text' })
  approvedAnswer: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetFile: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  timesUsed: number;

  @Column({ type: 'real', nullable: true })
  successRate: number | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  reviewDate: Date | null;

  @Column({ type: 'varchar', length: 32, default: AiLearningKnowledgeStatus.ACTIVE })
  status: AiLearningKnowledgeStatus;

  @Column({ type: 'varchar', nullable: true })
  sourceItemId: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @Column({ type: 'text', nullable: true })
  internalNotes: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastEditedBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
