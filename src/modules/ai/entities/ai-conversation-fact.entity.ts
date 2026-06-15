import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';

@Entity('ai_conversation_facts')
@Index(['conversationId'])
@Index(['factType'])
@Index(['factKey'])
export class AiConversationFact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar' })
  conversationId: string;

  @Column({ type: 'varchar', nullable: true })
  contactId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar' })
  factType: string;

  @Column({ type: 'varchar' })
  factKey: string;

  @Column({ type: 'text' })
  factValue: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidence: number;

  @Column({ type: 'varchar', nullable: true })
  sourceMessageId: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
