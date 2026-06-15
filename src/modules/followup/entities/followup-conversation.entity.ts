import { dateTimeColumnType } from '../../../common/utils/column-types';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ConversationSource,
  ConversationStage,
  ConversationPriority,
  LostReason,
} from '../followup.enums';

/** Pipeline / lead conversation — extends follow-up automation (table: followup_conversations) */
@Entity('followup_conversations')
@Index(['sessionId', 'chatId'], { unique: true })
@Index(['stage'])
@Index(['branchId'])
@Index(['nextFollowupAt'])
@Index(['priority'])
@Index(['source'])
@Index(['assignedStaffId'])
export class FollowupConversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerHandle: string | null;

  @Column({ type: 'varchar', default: ConversationSource.WHATSAPP })
  source: ConversationSource;

  @Column({ type: 'varchar', nullable: true })
  channel: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', default: ConversationStage.NEW_LEAD })
  stage: ConversationStage;

  @Column({ type: 'varchar', nullable: true })
  productInterest: string | null;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  budget: number | null;

  @Column({ type: 'varchar', default: ConversationPriority.NORMAL })
  priority: ConversationPriority;

  @Column({ type: dateTimeColumnType(), nullable: true })
  firstMessageAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  firstResponseAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastCustomerMessageAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastStaffMessageAt: Date | null;

  @Column({ type: 'int', nullable: true })
  responseTimeSeconds: number | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastFollowupAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  nextFollowupAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  linkedSaleId: string | null;

  @Column({ type: 'varchar', nullable: true })
  outcome: string | null;

  @Column({ type: 'varchar', nullable: true })
  lostReason: LostReason | null;

  @Column({ type: 'text', nullable: true })
  lostNotes: string | null;

  @Column({ default: false })
  alternativeOffered: boolean;

  @Column({ default: false })
  followupRequired: boolean;

  @Column({ default: false })
  followupCompleted: boolean;

  /** @deprecated sync with followupCompleted */
  @Column({ default: false })
  followupCompletedBeforeClose: boolean;

  @Column({ default: false })
  customerRefusedFollowup: boolean;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: 'varchar', nullable: true })
  nextAction: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  closedAt: Date | null;

  @Column({ default: false })
  isManual: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
