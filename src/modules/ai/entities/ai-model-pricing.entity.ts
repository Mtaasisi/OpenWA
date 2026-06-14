import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ai_model_pricing')
@Index(['provider', 'model'])
export class AiModelPricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  inputCostPer1MTokens: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  outputCostPer1MTokens: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  effectiveDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
