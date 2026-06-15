import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  AiTrainingAuditAction,
  AiTrainingAuditActorType,
} from '../ai-training.types';

@Entity('ai_training_audit_logs')
@Index(['trainingItemId', 'createdAt'])
@Index(['action'])
export class AiTrainingAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  trainingItemId: string;

  @Column({ type: 'varchar', length: 32 })
  action: AiTrainingAuditAction;

  @Column({ type: 'varchar', length: 16 })
  actorType: AiTrainingAuditActorType;

  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'simple-json', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
