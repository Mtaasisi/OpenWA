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
  LostDemandPriority,
  LostDemandReason,
  LostDemandStatus,
} from '../customer-profile.enums';

@Entity('lost_demand_followups')
@Index(['status', 'createdAt'])
@Index(['sessionId', 'chatId'])
export class LostDemandFollowup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar' })
  wantedProduct: string;

  @Column({ type: 'varchar', nullable: true })
  wantedVariant: string | null;

  @Column({ type: 'varchar', nullable: true })
  matchedProductId: string | null;

  @Column({ type: 'varchar', nullable: true })
  matchedVariantId: string | null;

  @Column({ type: 'varchar', length: 64, default: LostDemandReason.PRODUCT_UNAVAILABLE })
  reason: LostDemandReason | string;

  @Column({ default: false })
  alternativeOffered: boolean;

  @Column({ type: 'boolean', nullable: true })
  alternativeAccepted: boolean | null;

  @Column({ default: false })
  notifyWhenAvailable: boolean;

  @Column({ type: 'varchar', nullable: true })
  customerNameAtTime: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  @Column({ type: 'varchar', length: 16, default: LostDemandPriority.NORMAL })
  priority: LostDemandPriority | string;

  @Column({ type: 'varchar', length: 32, default: LostDemandStatus.OPEN })
  status: LostDemandStatus | string;

  @Column({ type: dateTimeColumnType(), nullable: true })
  followUpDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
