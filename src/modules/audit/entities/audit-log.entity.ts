import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

export enum AuditAction {
  // API Key events
  API_KEY_CREATED = 'api_key_created',
  API_KEY_USED = 'api_key_used',
  API_KEY_REVOKED = 'api_key_revoked',
  API_KEY_DELETED = 'api_key_deleted',
  API_KEY_AUTH_FAILED = 'api_key_auth_failed',

  // Session events
  SESSION_CREATED = 'session_created',
  SESSION_STARTED = 'session_started',
  SESSION_STOPPED = 'session_stopped',
  SESSION_DELETED = 'session_deleted',
  SESSION_QR_GENERATED = 'session_qr_generated',
  SESSION_CONNECTED = 'session_connected',
  SESSION_DISCONNECTED = 'session_disconnected',
  SESSION_RESTARTED = 'session_restarted',
  SESSION_PROXY_UPDATED = 'session_proxy_updated',
  SESSION_ENGINE_UPDATED = 'session_engine_updated',

  // Message events
  MESSAGE_SENT = 'message_sent',
  MESSAGE_FAILED = 'message_failed',

  // Group management
  GROUP_CREATED = 'group_created',
  GROUP_UPDATED = 'group_updated',

  // AI events
  AI_TOOL_CALL = 'ai_tool_call',
  AI_REPLY = 'ai_reply',

  // Webhook events
  WEBHOOK_CREATED = 'webhook_created',
  WEBHOOK_DELETED = 'webhook_deleted',
  WEBHOOK_TRIGGERED = 'webhook_triggered',
  WEBHOOK_FAILED = 'webhook_failed',

  // Infrastructure events
  INFRA_CONFIG_SAVED = 'infra_config_saved',
  INFRA_RESTART_REQUESTED = 'infra_restart_requested',
  INFRA_DATA_EXPORTED = 'infra_data_exported',
  INFRA_DATA_IMPORTED = 'infra_data_imported',
  INFRA_STORAGE_EXPORTED = 'infra_storage_exported',
  INFRA_STORAGE_IMPORTED = 'infra_storage_imported',

  // Plugin events
  PLUGIN_ENABLED = 'plugin_enabled',
  PLUGIN_DISABLED = 'plugin_disabled',
  PLUGIN_CONFIG_UPDATED = 'plugin_config_updated',

  // Follow-up automation
  FOLLOWUP_AUTO_SENT = 'followup_auto_sent',
  FOLLOWUP_CANCELLED = 'followup_cancelled',
  FOLLOWUP_AUTOPILOT_SUGGESTED = 'followup_autopilot_suggested',
  FOLLOWUP_AUTOPILOT_APPROVED = 'followup_autopilot_approved',
  FOLLOWUP_AUTOPILOT_REJECTED = 'followup_autopilot_rejected',
  FOLLOWUP_AUTOPILOT_AUTO_SENT = 'followup_autopilot_auto_sent',
  FOLLOWUP_AUTOPILOT_STOPPED = 'followup_autopilot_stopped',
  FOLLOWUP_AUTOPILOT_FAILED = 'followup_autopilot_failed',
  FOLLOWUP_AUTOPILOT_PAUSED = 'followup_autopilot_paused',

  // Inbox CRM
  INBOX_CHAT_TRANSFERRED = 'inbox_chat_transferred',
  INBOX_CHAT_RESOLVED = 'inbox_chat_resolved',
  INBOX_AI_TAKEOVER = 'inbox_ai_takeover',
  INBOX_AI_RESUMED = 'inbox_ai_resumed',

  // Storage & backup
  STORAGE_SETTINGS_UPDATED = 'storage_settings_updated',
  STORAGE_CLEANUP_RUN = 'storage_cleanup_run',
  STORAGE_MEDIA_DOWNLOADED = 'storage_media_downloaded',
  BACKUP_CREATED = 'backup_created',
  BACKUP_RESTORED = 'backup_restored',
  BACKUP_FAILED = 'backup_failed',

  // SMS channel (outgoing only)
  SMS_CREDENTIALS_SAVED = 'sms_credentials_saved',
  SMS_TEST_SENT = 'sms_test_sent',
  SMS_SENT = 'sms_sent',
  SMS_BULK_SENT = 'sms_bulk_sent',
  SMS_DISABLED = 'sms_disabled',
  SMS_FAILED = 'sms_failed',

  // Agent actions
  AGENT_ACTION_EXECUTED = 'agent_action_executed',
  AGENT_ACTION_DENIED = 'agent_action_denied',
  AGENT_ACTION_CONFIRMED = 'agent_action_confirmed',
}

export enum AuditSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 10, default: AuditSeverity.INFO })
  severity: AuditSeverity;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  apiKeyId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  apiKeyName: string | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  sessionId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sessionName: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  path: string | null;

  @Column({ type: 'int', nullable: true })
  statusCode: number | null;

  // The "main" database connection is always SQLite (boot config),
  // so we use simple-json regardless of the user's data DB choice.
  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Index()
  @CreateDateColumn()
  createdAt: Date;
}
