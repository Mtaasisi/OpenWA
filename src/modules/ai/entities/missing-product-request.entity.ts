import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MissingProductStatus } from '../product-demand.enums';

@Entity('missing_product_requests')
@Index(['status', 'timesAsked'])
@Index(['rawProductName'])
export class MissingProductRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  rawProductName: string;

  @Column({ type: 'varchar', nullable: true })
  possibleCategory: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'int', default: 1 })
  timesAsked: number;

  @Column({ type: 'int', default: 1 })
  uniqueCustomers: number;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  suggestedProductId: string | null;

  @Column({ type: 'real', nullable: true })
  confidenceScore: number | null;

  @Column({ type: 'varchar', length: 32, default: MissingProductStatus.UNMATCHED })
  status: MissingProductStatus;

  @Column({ type: 'simple-json', nullable: true })
  exampleMessages: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  customerIds: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
