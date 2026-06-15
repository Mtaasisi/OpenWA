import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType, dateTimeColumnType } from '../../../common/utils/column-types';
import { DateTransformer } from '../../../common/transformers/date.transformer';

export type ProductImportStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';

@Entity('product_import_batches')
export class ProductImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar' })
  fileName: string;

  @Column({ type: 'varchar', length: 16 })
  fileType: string;

  @Column({ type: 'varchar', length: 64 })
  importType: string;

  @Column({ type: 'varchar', length: 32 })
  mode: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: ProductImportStatus;

  @Column({ type: 'int', default: 0 })
  totalRows: number;

  @Column({ type: 'int', default: 0 })
  validRows: number;

  @Column({ type: 'int', default: 0 })
  warningRows: number;

  @Column({ type: 'int', default: 0 })
  errorRows: number;

  @Column({ type: 'int', default: 0 })
  createdCount: number;

  @Column({ type: 'int', default: 0 })
  updatedCount: number;

  @Column({ type: 'int', default: 0 })
  skippedCount: number;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true, transformer: DateTransformer })
  completedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorSummary: string | null;

  @Column({ type: jsonColumnType(), nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
