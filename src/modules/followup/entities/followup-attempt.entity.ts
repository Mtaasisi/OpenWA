import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { FollowUpAttemptMode, FollowUpOutcome } from '../followup.enums';

@Entity('followup_attempts')
@Index(['followupId'])
@Index(['conversationId'])
@Index(['staffId'])
export class FollowupAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  followupId: string;

  @Column()
  conversationId: string;

  @Column({ type: 'varchar', nullable: true })
  staffId: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar' })
  mode: FollowUpAttemptMode;

  @Column({ type: 'varchar', nullable: true })
  templateId: string | null;

  @Column({ type: 'text', nullable: true })
  messageBody: string | null;

  @Column({ type: 'varchar', nullable: true })
  deliveryStatus: string | null;

  @Column({ default: false })
  customerReplied: boolean;

  @Column({ type: 'varchar', nullable: true })
  outcome: FollowUpOutcome | null;

  @CreateDateColumn()
  createdAt: Date;
}
