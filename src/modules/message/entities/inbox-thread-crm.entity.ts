import { dateTimeColumnType } from '../../../common/utils/column-types';
import { Entity, PrimaryGeneratedColumn, Column, Index, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('inbox_thread_crm')
@Index(['sessionId', 'chatId'], { unique: true })
export class InboxThreadCrm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  sessionId: string;

  @Column()
  chatId: string;

  @Column({ default: false })
  resolved: boolean;

  @Column({ type: dateTimeColumnType(), nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  resolvedReason: string | null;

  @Column({ type: 'text', nullable: true })
  resolvedNote: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  outcome: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  resolvedByStaffId: string | null;

  @Column({ type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  followUpAt: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  followUpReason: string | null;

  @Column({ type: 'text', nullable: true })
  followUpNote: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string | null;

  /** External CRM / ERP customer id or reference */
  @Column({ type: 'varchar', nullable: true })
  linkedExternalId: string | null;

  /** When true, AI inbox auto-reply is disabled for this thread. */
  @Column({ default: false })
  aiAutoReplyPaused: boolean;

  @Column({ type: 'varchar', length: 32, default: 'idle' })
  aiHandlingState: string;

  @Column({ type: dateTimeColumnType(), nullable: true })
  aiEscalatedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  aiFailureCount: number;

  /** Customer opted out of AI messages — do not auto-reply. */
  @Column({ default: false })
  aiOptOut: boolean;

  /** Follow-up autopilot paused for this thread. */
  @Column({ default: false })
  followupAutopilotPaused: boolean;

  @Column({ type: dateTimeColumnType(), nullable: true })
  followupAutopilotPausedUntil: Date | null;

  @Column({ type: 'varchar', nullable: true })
  followupAutopilotPausedBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  preferredBranchId: string | null;

  @Column({ type: 'varchar', nullable: true })
  inferredCity: string | null;

  @Column({ type: 'varchar', nullable: true })
  confirmedCity: string | null;

  @Column({ type: 'real', nullable: true })
  locationConfidence: number | null;

  @Column({ type: dateTimeColumnType(), nullable: true })
  lastLocationConfirmedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  lastProductInterest: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  lastIntent: string | null;

  @Column({ type: 'int', default: 0 })
  discountRequestCount: number;

  @Column({ default: false })
  installmentInterest: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  paymentReadiness: string | null;

  @Column({ type: 'text', nullable: true })
  aiNotes: string | null;

  @Column({ type: 'varchar', nullable: true })
  autopilotPauseReason: string | null;

  /** Staff notes on what customer usually buys / prefers (colors, budget, use case). */
  @Column({ type: 'text', nullable: true })
  buyingPreferences: string | null;

  /** Staff flagged this customer as a discount negotiator — treat repeat asks seriously. */
  @Column({ default: false })
  discountNegotiationMarked: boolean;

  /** When set, temporary staff-reply takeover expires at this time (auto-resume). */
  @Column({ type: dateTimeColumnType(), nullable: true })
  manualTakeoverUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
