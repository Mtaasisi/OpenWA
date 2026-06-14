import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('ai_learning_imports')
@Index(['status', 'createdAt'])
export class AiLearningImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  sourceName: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  totalRows: number;

  @Column({ type: 'int', default: 0 })
  importedRows: number;

  @Column({ type: 'int', default: 0 })
  questionCount: number;

  @Column({ type: 'simple-json', nullable: true })
  topQuestions: Array<{ text: string; count: number; intent?: string }> | null;

  @Column({ type: 'simple-json', nullable: true })
  intentBreakdown: Record<string, number> | null;

  @Column({ type: 'simple-json', nullable: true })
  replySamples: Array<{ customer: string; staff: string; intent: string }> | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  importFormat: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
