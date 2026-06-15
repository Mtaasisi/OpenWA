import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AiTrainingSuggestionActionType } from '../ai-training.types';

@Entity('ai_training_suggestions')
@Index(['trainingItemId'])
export class AiTrainingSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  trainingItemId: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  optionLabel: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  optionText: string | null;

  @Column({ type: 'text', nullable: true })
  responseText: string | null;

  @Column({ type: 'varchar', length: 48 })
  actionType: AiTrainingSuggestionActionType;

  @Column({ type: 'varchar', nullable: true })
  targetFile: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetSection: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetKey: string | null;

  @Column({ type: 'real', default: 0.5 })
  confidence: number;

  @Column({ type: 'text', nullable: true })
  reasoning: string | null;

  @Column({ type: 'simple-json', nullable: true })
  risks: string[] | null;

  @Column({ default: false })
  isRecommended: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
