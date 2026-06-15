import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FollowUpStatus } from '../followup.enums';

@Entity('followup_queue')
@Index(['conversationId'])
@Index(['assignedStaffId'])
@Index(['dueAt'])
@Index(['status'])
@Index(['branchId'])
export class FollowupQueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @Column({ type: 'varchar', nullable: true })
  ruleId: string | null;

  @Column({ type: 'varchar', nullable: true })
  templateId: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: dateTimeColumnType() })
  dueAt: Date;

  @Column({ type: 'varchar', default: FollowUpStatus.PENDING })
  status: FollowUpStatus;

  @Column({ type: 'varchar', nullable: true })
  recommendedAction: string | null;

  @Column({ type: 'int', default: 1 })
  attemptNumber: number;

  @Column({ type: dateTimeColumnType(), nullable: true })
  warningAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  escalatedAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  kpiPenaltyAt: Date | null;

  @Column({ default: false })
  kpiPenaltyFlag: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: false })
  isAutopilot: boolean;

  @Column({ type: 'varchar', nullable: true })
  detectedReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerMood: string | null;

  @Column({ type: 'varchar', nullable: true })
  riskLevel: string | null;

  @Column({ type: 'real', nullable: true })
  confidenceScore: number | null;

  @Column({ type: 'varchar', nullable: true })
  suggestedChannel: string | null;

  @Column({ type: 'text', nullable: true })
  suggestedMessage: string | null;

  @Column({ type: 'text', nullable: true })
  originalCustomerMessage: string | null;

  @Column({ type: 'text', nullable: true })
  lastStaffMessage: string | null;

  @Column({ type: 'varchar', nullable: true })
  stopReason: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  stoppedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  stoppedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  lastTriggerMessageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  sentBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  channelUsed: string | null;

  @Column({ type: 'varchar', nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
