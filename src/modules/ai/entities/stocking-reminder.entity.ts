import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { StockingReminderReason, StockingReminderStatus } from '../ai-signal.enums';

@Entity('stocking_reminders')
@Index(['status', 'createdAt'])
export class StockingReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  productName: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  reason: StockingReminderReason | null;

  @Column({ type: 'varchar', length: 32, default: StockingReminderStatus.OPEN })
  status: StockingReminderStatus;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
