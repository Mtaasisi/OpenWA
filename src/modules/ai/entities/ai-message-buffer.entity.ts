import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';

export enum AiMessageBufferStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface BufferedRawMessage {
  messageId: string;
  text: string;
  receivedAt: string;
}

@Entity('ai_message_buffers')
@Index(['conversationId'])
@Index(['batchId'])
@Index(['status'])
@Index(['scheduledProcessAt'])
export class AiMessageBuffer {
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

  @Column({ type: 'varchar', default: AiMessageBufferStatus.PENDING })
  status: AiMessageBufferStatus | string;

  @Column({ type: 'varchar' })
  batchId: string;

  @Column({ type: 'simple-json', nullable: true })
  messageIds: string[] | null;

  @Column({ type: 'simple-json', nullable: true })
  rawMessages: BufferedRawMessage[] | null;

  @Column({ type: 'text', nullable: true })
  combinedText: string | null;

  @Column({ type: 'text', nullable: true })
  normalizedCombinedText: string | null;

  @Column({ type: dataDateTimeColumn() })
  firstMessageAt: Date;

  @Column({ type: dataDateTimeColumn() })
  lastMessageAt: Date;

  @Column({ type: dataDateTimeColumn() })
  scheduledProcessAt: Date;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  processedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  replyMessageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  aiUsageLogId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
