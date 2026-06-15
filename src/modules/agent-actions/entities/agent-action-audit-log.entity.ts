import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { AgentActionRisk, AgentActionStatus } from '../agent-action.types';

@Entity('agent_action_audit_logs')
export class AgentActionAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  actionId: string;

  @Column({ type: 'varchar', length: 200 })
  actionTitle: string;

  @Column({ type: 'varchar', length: 32 })
  category: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  requestedByUserId: string;

  @Column({ type: 'varchar', length: 32 })
  requestedByRole: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  businessId: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  branchId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  currentPage: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  targetEntityType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  targetEntityId: string | null;

  @Column({ type: 'text', nullable: true })
  oldValue: string | null;

  @Column({ type: 'text', nullable: true })
  newValue: string | null;

  @Column({ type: 'text', nullable: true })
  paramsSummary: string | null;

  @Index()
  @Column({ type: 'varchar', length: 16 })
  risk: AgentActionRisk;

  @Column({ type: 'boolean', default: false })
  requiredConfirmation: boolean;

  @Column({ type: 'varchar', length: 36, nullable: true })
  confirmationId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 32 })
  status: AgentActionStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'varchar', length: 32, default: 'ai_assistant_agent' })
  source: string;

  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'datetime', nullable: true })
  executedAt: Date | null;
}
