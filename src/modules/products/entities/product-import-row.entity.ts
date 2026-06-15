import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';
import { ProductImportBatch } from './product-import-batch.entity';

@Entity('product_import_rows')
@Index(['importBatchId', 'rowNumber'])
export class ProductImportRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  importBatchId: string;

  @ManyToOne(() => ProductImportBatch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'importBatchId' })
  importBatch: ProductImportBatch;

  @Column({ type: 'int' })
  rowNumber: number;

  @Column({ type: jsonColumnType() })
  rowData: Record<string, unknown>;

  @Column({ type: jsonColumnType(), nullable: true })
  mappedData: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Column({ type: jsonColumnType(), nullable: true })
  errors: string[] | null;

  @Column({ type: jsonColumnType(), nullable: true })
  warnings: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  targetProductId: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetVariantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetInventoryItemId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  action: string | null;

  @Column({ type: jsonColumnType(), nullable: true })
  previousValues: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
