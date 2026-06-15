import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FollowUpAutopilotMode } from '../followup.enums';

export const FOLLOWUP_AUTOPILOT_SETTINGS_ID = 'default';

@Entity('followup_autopilot_settings')
export class FollowupAutopilotSettings {
  @PrimaryColumn({ default: FOLLOWUP_AUTOPILOT_SETTINGS_ID })
  id: string;

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'varchar', default: FollowUpAutopilotMode.AUTO_SEND_SAFE })
  autopilotMode: FollowUpAutopilotMode;

  @Column({ default: true })
  businessHoursOnly: boolean;

  @Column({ type: 'varchar', default: '09:00' })
  quietHoursStart: string;

  @Column({ type: 'varchar', default: '17:00' })
  quietHoursEnd: string;

  @Column({ type: 'varchar', default: 'Africa/Dar_es_Salaam' })
  timezone: string;

  @Column({ type: 'int', default: 1 })
  maxFollowupsPerCustomerPerDay: number;

  @Column({ type: 'int', default: 3 })
  maxFollowupsPerLead: number;

  @Column({ default: true })
  requireApprovalForMediumRisk: boolean;

  @Column({ default: true })
  requireApprovalForHighRisk: boolean;

  @Column({ default: false })
  allowSmsFallback: boolean;

  @Column({ default: false })
  allowWhatsAppSmsBoth: boolean;

  @Column({ default: false })
  allowGroupAutopilot: boolean;

  @Column({ default: true })
  pauseOnHighFailureRate: boolean;

  @Column({ default: true })
  pauseOnCustomerComplaint: boolean;

  @Column({ type: 'int', default: 120 })
  staffTakeoverPauseMinutes: number;

  /** JSON map sessionId -> { pausedUntil, failureCount, blockedCount, ... } */
  @Column({ type: 'text', nullable: true })
  sessionHealthJson: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
