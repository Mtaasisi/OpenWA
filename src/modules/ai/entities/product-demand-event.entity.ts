import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProductDemandIntent } from '../product-demand.enums';

@Entity('product_demand_events')
@Index(['createdAt'])
@Index(['detectedProductName'])
@Index(['matchedProductId'])
export class ProductDemandEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  chatId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId: string | null;

  @Column({ type: 'text', nullable: true })
  rawMessage: string | null;

  @Column({ type: 'varchar' })
  detectedProductName: string;

  @Column({ type: 'varchar', nullable: true })
  matchedProductId: string | null;

  @Column({ type: 'varchar', nullable: true })
  matchedVariantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 64, default: ProductDemandIntent.GENERAL })
  intent: ProductDemandIntent;

  @Column({ type: 'real', default: 0 })
  confidenceScore: number;

  @Column({ type: 'varchar', nullable: true })
  stockStatusInternal: string | null;

  @Column({ type: 'real', nullable: true })
  priceMentioned: number | null;

  @Column({ type: 'real', nullable: true })
  customerBudget: number | null;

  @Column({ type: 'real', nullable: true })
  customerOffer: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
