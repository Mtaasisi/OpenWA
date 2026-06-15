import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';
import { Quote } from './quote.entity';

@Entity('crm_quote_items')
@Index(['quoteId', 'sortOrder'])
export class QuoteItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  quoteId: string;

  @ManyToOne(() => Quote, (q) => q.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quoteId' })
  quote: Quote;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  @Column()
  itemName: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'real', default: 1 })
  quantity: number;

  @Column({ type: 'real', default: 0 })
  unitPrice: number;

  @Column({ type: 'real', default: 0 })
  discountAmount: number;

  @Column({ type: 'real', default: 0 })
  totalPrice: number;

  @Column({ type: 'varchar', nullable: true })
  warranty: string | null;

  /** Snapshot at quote time, e.g. in_stock / low_stock / out_of_stock */
  @Column({ type: 'varchar', nullable: true })
  stockStatus: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** IMEI inventory item ids, external ids, etc. */
  @Column({ type: jsonColumnType(), nullable: true })
  metadata: Record<string, unknown> | null;
}
