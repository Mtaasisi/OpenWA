import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { ProfileLearningEventStatus } from '../customer-profile.enums';

@Entity('customer_profile_learning_events')
@Index(['sessionId', 'chatId', 'createdAt'])
export class CustomerProfileLearningEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar' })
  fieldName: string;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @Column({ type: 'real', nullable: true })
  confidenceScore: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 32, default: ProfileLearningEventStatus.AUTO_SAVED })
  status: ProfileLearningEventStatus | string;

  @Column({ default: true })
  createdByAi: boolean;

  @Column({ type: 'varchar', nullable: true })
  reviewedBy: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
