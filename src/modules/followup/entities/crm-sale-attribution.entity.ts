import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ConversationSource } from '../followup.enums';

/** Records sale ↔ lead attribution when a sale is linked (local id or INAUZWA). */
@Entity('crm_sale_attributions')
@Index(['saleId'])
@Index(['leadSource', 'branchId'])
@Index(['conversationId'])
export class CrmSaleAttribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  saleId: string;

  @Column({ type: 'varchar' })
  leadSource: ConversationSource;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  quoteId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  assignedStaffId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'real', nullable: true })
  amount: number | null;

  @Column({ type: 'real', nullable: true })
  grossProfit: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
