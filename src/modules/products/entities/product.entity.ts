import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';

@Entity('crm_products')
@Index(['isActive', 'name'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  sku: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'varchar', nullable: true })
  barcode: string | null;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  warrantyDefault: string | null;

  @Column({ type: 'varchar', nullable: true })
  supplier: string | null;

  @Column({ type: 'varchar', length: 16, default: 'public' })
  visibility: string;

  @Column({ type: 'real', nullable: true })
  costPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  /** Gallery URLs (primary first) when synced from INAUZWA product_images */
  @Column({ type: 'simple-json', nullable: true })
  imageUrls: string[] | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  currency: string | null;

  /** Base price when product has no variants */
  @Column({ type: 'real', nullable: true })
  sellingPrice: number | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  /** Source row id when imported from INAUZWA (lats_products.id) */
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

  @OneToMany(() => ProductVariant, (v) => v.product, { cascade: true })
  variants: ProductVariant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
