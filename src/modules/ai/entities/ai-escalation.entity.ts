import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AiEscalationReason, AiEscalationStatus } from '../ai-signal.enums';

@Entity('ai_escalations')
@Index(['sessionId', 'chatId'])
@Index(['status', 'createdAt'])
export class AiEscalation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', length: 64 })
  reason: AiEscalationReason;

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'varchar', length: 32, default: AiEscalationStatus.OPEN })
  status: AiEscalationStatus;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
