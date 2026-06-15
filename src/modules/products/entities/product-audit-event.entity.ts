import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

@Entity('product_audit_events')
@Index(['productId', 'createdAt'])
export class ProductAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  @Index()
  productId: string;

  @Column({ type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', nullable: true })
  inventoryItemId: string | null;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ type: 'varchar', nullable: true })
  actorId: string | null;

  @Column({ type: jsonColumnType(), nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
