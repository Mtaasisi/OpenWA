import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  ProductDemandCampaignChannel,
  ProductDemandCampaignStatus,
} from '../product-demand.enums';

export type ProductDemandCampaignRecipient = {
  phone?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  sessionId?: string | null;
  chatId?: string | null;
};

@Entity('product_demand_campaigns')
@Index(['status', 'createdAt'])
export class ProductDemandCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 16, default: ProductDemandCampaignChannel.SMS })
  channel: ProductDemandCampaignChannel | string;

  @Column({ type: 'varchar', length: 32, default: ProductDemandCampaignStatus.DRAFT })
  status: ProductDemandCampaignStatus | string;

  @Column({ type: 'simple-json', nullable: true })
  productNames: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  productIds: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  recommendationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  summaryId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @Column({ type: 'simple-json', nullable: true })
  recipients: ProductDemandCampaignRecipient[] | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
