import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PaymentMethodType } from '../ai-signal.enums';

@Entity('branch_payment_accounts')
@Index(['branchId', 'isActive'])
export class BranchPaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  branchId: string;

  @Column({ type: 'varchar', length: 32, default: PaymentMethodType.MOBILE_MONEY })
  methodType: PaymentMethodType;

  @Column({ type: 'varchar', nullable: true })
  providerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountName: string | null;

  @Column({ type: 'varchar', nullable: true })
  accountNumber: string | null;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
