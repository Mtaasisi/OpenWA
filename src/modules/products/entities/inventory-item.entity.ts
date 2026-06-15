import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { jsonColumnType, dateTimeColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

/** Individual physical unit tracked by IMEI/serial (Level 3 inventory). */
export type InventoryItemStatus =
  | 'available'
  | 'reserved'
  | 'sold'
  | 'returned'
  | 'repair_hold'
  | 'damaged'
  | 'lost'
  | 'transferred'
  | 'inactive';

@Entity('crm_inventory_items')
@Index(['productId', 'variantId', 'status'])
@Index(['branchId', 'status'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  productId: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  @Index()
  variantId: string;

  @ManyToOne(() => ProductVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant;

  @Column({ type: 'varchar' })
  branchId: string;

  @Column({ type: 'varchar', nullable: true })
  imei: string | null;

  @Column({ type: 'varchar', nullable: true })
  serialNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  deviceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  @Column({ type: 'varchar', length: 32, default: 'available' })
  status: InventoryItemStatus;

  @Column({ type: 'real', nullable: true })
  costPrice: number | null;

  @Column({ type: 'real', nullable: true })
  sellingPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  supplier: string | null;

  @Column({ type: 'varchar', nullable: true })
  purchaseBatch: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true, transformer: DateTransformer })
  reservedAt: Date | null;

  @Column({ type: dateTimeColumnType(), nullable: true, transformer: DateTransformer })
  soldAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  saleId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Link to migrated imei_child variant row (read-only legacy). */
  @Column({ type: 'varchar', nullable: true })
  legacyVariantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  externalId: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true, transformer: DateTransformer })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
