import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  AiTrainingApprovalStatus,
  AiTrainingUpdateMode,
} from '../ai-training.types';

@Entity('ai_training_approvals')
@Index(['trainingItemId'])
@Index(['status'])
export class AiTrainingApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  trainingItemId: string;

  @Column({ type: 'varchar', nullable: true })
  selectedSuggestionId: string | null;

  @Column({ type: 'text', nullable: true })
  customAnswer: string | null;

  @Column({ type: 'text', nullable: true })
  customInstruction: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetFile: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetSection: string | null;

  @Column({ type: 'varchar', length: 32, default: AiTrainingUpdateMode.APPEND })
  updateMode: AiTrainingUpdateMode;

  @Column({ type: 'varchar', length: 16, default: AiTrainingApprovalStatus.PENDING })
  status: AiTrainingApprovalStatus;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  appliedBy: string | null;

  @Column({ type: 'text', nullable: true })
  oldContentSnapshot: string | null;

  @Column({ type: 'text', nullable: true })
  newContentSnapshot: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileBackupPath: string | null;

  @Column({ default: false })
  reindexRequested: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  reindexStatus: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  appliedAt: Date | null;
}
