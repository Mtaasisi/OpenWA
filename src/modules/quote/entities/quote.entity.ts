import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { dateColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { QuoteStatus } from '../quote.enums';
import { QuoteItem } from './quote-item.entity';

@Entity('crm_quotes')
@Index(['sessionId', 'chatId'])
@Index(['branchId', 'status'])
@Index(['quoteNumber'], { unique: true })
export class Quote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  quoteNumber: string;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  /** INAUZWA lats_customers.id when linked */
  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  @Column()
  sessionId: string;

  @Column()
  chatId: string;

  /** followup_conversations.id */
  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  /** Lead attribution — copied from conversation when available */
  @Column({ type: 'varchar', nullable: true })
  leadSource: string | null;

  @Column({ type: 'varchar', default: QuoteStatus.DRAFT })
  status: QuoteStatus;

  @Column({ type: 'real', default: 0 })
  subtotal: number;

  @Column({ type: 'real', default: 0 })
  discountAmount: number;

  @Column({ type: 'real', default: 0 })
  deliveryFee: number;

  @Column({ type: 'real', default: 0 })
  taxAmount: number;

  @Column({ type: 'real', default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  paymentInstructions: string | null;

  @Column({ type: 'text', nullable: true })
  branchPickupInfo: string | null;

  @Column({ type: dateColumnType(), nullable: true, transformer: DateTransformer })
  validUntil: Date | null;

  /** OpenWA manual id or INAUZWA lats_sales.id */
  @Column({ type: 'varchar', nullable: true })
  linkedSaleId: string | null;

  /** INAUZWA lats_proforma_invoices.id when mirrored */
  @Column({ type: 'varchar', nullable: true })
  externalProformaId: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @OneToMany(() => QuoteItem, (item) => item.quote, { cascade: true })
  items: QuoteItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
