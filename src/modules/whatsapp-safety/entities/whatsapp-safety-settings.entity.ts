import { dataDateTimeColumn } from '../../../common/utils/sql-dialect.util';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID } from '../enums/whatsapp-safety.enums';

@Entity('whatsapp_safety_settings')
export class WhatsAppSafetySettings {
  @PrimaryColumn({ default: WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  sessionId: string | null;

  @Column({ default: true })
  globalEnabled: boolean;

  @Column({ default: true })
  warmupEnabled: boolean;

  @Column({ type: 'int', nullable: true })
  accountAgeDays: number | null;

  @Column({ type: 'int', default: 30 })
  maxOutboundPerHour: number;

  @Column({ type: 'int', default: 200 })
  maxOutboundPerDay: number;

  @Column({ type: 'int', default: 999 })
  maxAutoRepliesPerCustomerPerDay: number;

  @Column({ type: 'int', default: 20 })
  maxCampaignMessagesPerHour: number;

  @Column({ type: 'int', default: 0 })
  maxCampaignMessagesPerDay: number;

  @Column({ default: true })
  aiSafetyEnabled: boolean;

  @Column({ default: false })
  productBulkSendEnabled: boolean;

  @Column({ type: 'int', default: 15 })
  maxAutoRepliesPerHour: number;

  @Column({ type: 'int', default: 0 })
  minAiReplyDelayMs: number;

  @Column({ type: 'int', default: 0 })
  maxAiReplyDelayMs: number;

  @Column({ default: false })
  riskyIntentRequiresApproval: boolean;

  @Column({ default: false })
  unknownQuestionRequiresApproval: boolean;

  @Column({ type: 'int', default: 500 })
  minDelayBetweenMessagesMs: number;

  @Column({ type: 'int', default: 25000 })
  maxDelayBetweenMessagesMs: number;

  @Column({ type: 'int', default: 0 })
  perContactCooldownMinutes: number;

  @Column({ type: 'real', default: 0.15 })
  failureRatePauseThreshold: number;

  @Column({ type: 'real', default: 0.05 })
  blockRatePauseThreshold: number;

  @Column({ default: true })
  outside24hRequiresTemplate: boolean;

  @Column({ default: false })
  groupsAutoReplyEnabled: boolean;

  @Column({ default: false })
  groupManagementEnabled: boolean;

  @Column({ default: false })
  statusPostsEnabled: boolean;

  @Column({ default: false })
  whatsappCloudSyncEnabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  whatsappCloudWabaId: string | null;

  @Column({ type: dataDateTimeColumn(), nullable: true })
  whatsappCloudLastSyncAt: Date | null;

  @Column({ type: 'text', nullable: true })
  whatsappCloudLastSyncSummary: string | null;

  @Column({ default: false })
  campaignsEnabled: boolean;

  @Column({ default: false })
  followupAutoSendEnabled: boolean;

  @Column({ default: true })
  aiAutoReplyEnabled: boolean;

  @Column({ default: true })
  startupSafeModeEnabled: boolean;

  @Column({ type: 'int', default: 5 })
  startupInitialDelayMinutes: number;

  @Column({ type: 'int', default: 50 })
  maxChatsToSyncInitially: number;

  @Column({ type: 'int', default: 10 })
  syncBatchSize: number;

  @Column({ type: 'int', default: 60000 })
  syncBatchDelayMs: number;

  @Column({ default: false })
  autoDownloadMediaOnStartup: boolean;

  @Column({ default: false })
  fetchGroupInfoOnStartup: boolean;

  @Column({ default: false })
  sendSeenOnStartup: boolean;

  @Column({ type: 'simple-json', default: '[]' })
  optOutKeywords: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
