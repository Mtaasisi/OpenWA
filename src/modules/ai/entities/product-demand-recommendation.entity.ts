import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  ProductDemandRecommendationPriority,
  ProductDemandRecommendationStatus,
} from '../product-demand.enums';

@Entity('product_demand_recommendations')
@Index(['status', 'priority'])
export class ProductDemandRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text', nullable: true })
  dataProof: string | null;

  @Column({ type: 'text', nullable: true })
  expectedImpact: string | null;

  @Column({ type: 'varchar', length: 16, default: ProductDemandRecommendationPriority.MEDIUM })
  priority: ProductDemandRecommendationPriority;

  @Column({ type: 'varchar', nullable: true })
  suggestedAction: string | null;

  @Column({ type: 'simple-json', nullable: true })
  productIds: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  productNames: string[] | null;

  @Column({ type: 'int', default: 0 })
  customersAffected: number;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 32, default: ProductDemandRecommendationStatus.OPEN })
  status: ProductDemandRecommendationStatus;

  @Column({ type: 'varchar', nullable: true })
  summaryId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
