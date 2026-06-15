import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import type { AgentActionRisk } from '../agent-action.types';

export type AgentActionConfirmationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

@Entity('agent_action_confirmations')
export class AgentActionConfirmation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  actionId: string;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  requestedByUserId: string;

  @Column({ type: 'text', nullable: true })
  paramsJson: string | null;

  @Column({ type: 'varchar', length: 16 })
  risk: AgentActionRisk;

  @Column({ type: 'text', nullable: true })
  warningMessage: string | null;

  @Index()
  @Column({ type: 'datetime' })
  expiresAt: Date;

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: AgentActionConfirmationStatus;

  @CreateDateColumn()
  createdAt: Date;
}
