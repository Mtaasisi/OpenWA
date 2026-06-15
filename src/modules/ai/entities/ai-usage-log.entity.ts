import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('ai_usage_logs')
@Index(['createdAt'])
@Index(['feature'])
@Index(['provider'])
@Index(['model'])
@Index(['branchId'])
@Index(['conversationId'])
@Index(['messageId'])
@Index(['requestId'])
export class AiUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  workspaceId: string | null;

  @Column({ type: 'varchar', nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  apiKeyLabel: string | null;

  @Column({ type: 'varchar' })
  provider: string;

  @Column({ type: 'varchar' })
  model: string;

  @Column({ type: 'varchar' })
  feature: string;

  @Column({ type: 'varchar' })
  source: string;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  messageId: string | null;

  @Column({ type: 'varchar', nullable: true })
  requestId: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  modelTier: string | null;

  @Column({ type: 'varchar', nullable: true })
  contactId: string | null;

  @Column({ type: 'varchar', nullable: true })
  batchId: string | null;

  @Column({ type: 'int', default: 0 })
  inputTokens: number;

  @Column({ type: 'int', default: 0 })
  outputTokens: number;

  @Column({ type: 'int', default: 0 })
  totalTokens: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  estimatedCostUsd: number;

  @Column({ type: 'decimal', precision: 18, scale: 6, default: 0 })
  actualCostUsd: number;

  @Column({ type: 'varchar', default: 'USD' })
  currency: string;

  @Column({ type: 'int', default: 0 })
  toolCallsCount: number;

  @Column({ type: 'int', default: 1 })
  aiCallsCount: number;

  @Column({ type: 'varchar', default: 'success' })
  status: string;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
