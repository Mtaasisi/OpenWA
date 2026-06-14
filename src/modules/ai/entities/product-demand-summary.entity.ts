import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ProductDemandTrend } from '../product-demand.enums';

@Entity('product_demand_summary')
@Index(['branchId', 'period'])
@Index(['productId', 'variantId'])
export class ProductDemandSummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  detectedProductName: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 16, default: 'week' })
  period: string;

  @Column({ type: 'int', default: 0 })
  requestCount: number;

  @Column({ type: 'int', default: 0 })
  uniqueCustomers: number;

  @Column({ type: 'int', default: 0 })
  priceRequests: number;

  @Column({ type: 'int', default: 0 })
  availabilityRequests: number;

  @Column({ type: 'int', default: 0 })
  installmentRequests: number;

  @Column({ type: 'int', default: 0 })
  discountRequests: number;

  @Column({ type: 'int', default: 0 })
  paymentReadyCount: number;

  @Column({ type: 'int', default: 0 })
  outOfStockCount: number;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  lastAskedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  recommendedAction: string | null;

  @Column({ type: 'varchar', length: 16, default: ProductDemandTrend.STABLE })
  trend: ProductDemandTrend;

  @Column({ type: 'boolean', default: false })
  markedImportant: boolean;

  @Column({ type: 'simple-json', nullable: true })
  customerIds: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
