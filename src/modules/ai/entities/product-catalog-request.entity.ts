import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('product_catalog_requests')
@Index(['status', 'createdAt'])
export class ProductCatalogRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  productName: string;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'text', nullable: true })
  suggestedSpecs: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'int', default: 1 })
  customerCount: number;

  @Column({ type: 'simple-json', nullable: true })
  exampleMessages: string[] | null;

  @Column({ type: 'varchar', length: 16, default: 'medium' })
  priority: string;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  dueDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  missingProductRequestId: string | null;

  @Column({ type: 'varchar', length: 32, default: 'open' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  productId: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  fulfilledAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
