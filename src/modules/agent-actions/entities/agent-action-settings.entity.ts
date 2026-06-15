import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export const AGENT_ACTION_SETTINGS_ID = 'default';

@Entity('agent_action_settings')
export class AgentActionSettings {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ default: true })
  agentActionsEnabled: boolean;

  @Column({ default: true })
  allowSafeDirectExecution: boolean;

  @Column({ default: true })
  requireConfirmationForMediumRisk: boolean;

  @Column({ default: true })
  requireConfirmationForHighRisk: boolean;

  @Column({ default: true })
  adminOnlyHighRisk: boolean;

  @Column({ type: 'int', default: 5 })
  actionConfirmExpiryMinutes: number;

  @Column({ default: true })
  actionAuditEnabled: boolean;

  @Column({ default: true })
  showActionCardsInAiAssistant: boolean;

  @Column({ default: true })
  allowQuickLinks: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
