import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('followup_autopilot_audit')
@Index(['followupId'])
@Index(['conversationId'])
@Index(['sessionId'])
@Index(['createdAt'])
export class FollowupAutopilotAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  followupId: string | null;

  @Column({ type: 'varchar', nullable: true })
  conversationId: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerId: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', nullable: true })
  ruleId: string | null;

  @Column({ type: 'varchar', nullable: true })
  templateId: string | null;

  @Column({ type: 'real', nullable: true })
  aiConfidence: number | null;

  @Column({ type: 'varchar', nullable: true })
  riskLevel: string | null;

  @Column({ type: 'varchar', nullable: true })
  channelUsed: string | null;

  @Column({ type: 'text', nullable: true })
  messageSent: string | null;

  @Column({ type: 'text', nullable: true })
  decisionReason: string | null;

  @Column({ type: 'varchar', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  sentBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  resultStatus: string | null;

  @Column({ type: 'text', nullable: true })
  metadataJson: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
