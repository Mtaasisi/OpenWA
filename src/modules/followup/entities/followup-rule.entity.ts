import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationStage, FollowUpMode, FollowUpTriggerEvent } from '../followup.enums';

@Entity('followup_rules')
@Index(['branchId'])
@Index(['active'])
export class FollowupRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar' })
  triggerEvent: FollowUpTriggerEvent;

  @Column({ type: 'varchar', nullable: true })
  stage: ConversationStage | null;

  @Column({ type: 'text', nullable: true })
  condition: string | null;

  @Column({ type: 'int', default: 0 })
  delayMinutes: number;

  @Column({ type: 'varchar', nullable: true })
  templateId: string | null;

  @Column({ type: 'varchar', default: FollowUpMode.CREATE_TASK })
  mode: FollowUpMode;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ default: true })
  stopIfCustomerReplied: boolean;

  @Column({ default: true })
  stopIfSaleLinked: boolean;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
