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
import { jsonColumnType } from '../../../common/utils/column-types';
import { Product } from './product.entity';

export type VariantType = 'standard' | 'parent' | 'imei_child';

@Entity('crm_product_variants')
@Index(['productId', 'parentVariantId'])
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  productId: string;

  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  @Column({ type: 'real', nullable: true })
  costPrice: number | null;

  @Column({ type: 'real', nullable: true })
  sellingPrice: number | null;

  /** When true, stock is derived from crm_inventory_items; manual quantity edits are blocked. */
  @Column({ default: false })
  trackInventoryItems: boolean;

  @Column({ type: 'int', default: 10 })
  lowStockThreshold: number;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'varchar', length: 32, default: 'standard' })
  variantType: VariantType;

  @Column({ default: false })
  isParent: boolean;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  parentVariantId: string | null;

  @Column({ type: jsonColumnType(), nullable: true })
  attributes: Record<string, string | number | boolean | null> | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Source row id when imported from INAUZWA (lats_product_variants.id) */
  @Column({ type: 'varchar', nullable: true })
  @Index()
  externalId: string | null;

  @Column({ default: false })
  installmentEnabled: boolean;

  @Column({ type: 'real', nullable: true })
  installmentMinDeposit: number | null;

  @Column({ type: 'int', nullable: true })
  installmentDurationDays: number | null;

  @Column({ type: 'varchar', nullable: true })
  installmentScheduleType: string | null;

  @Column({ type: 'text', nullable: true })
  installmentPolicy: string | null;

  @Column({ type: 'text', nullable: true })
  installmentPenaltyPolicy: string | null;

  @Column({ type: 'int', nullable: true })
  installmentExpiryDays: number | null;

  @Column({ default: false })
  installmentRequiresApproval: boolean;

  @Column({ default: false })
  allowInstallmentWhenOutOfStock: boolean;

  @Column({ default: false })
  stockingReminderEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  installmentNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
