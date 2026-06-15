export enum WhatsAppMessageType {
  CUSTOMER_REPLY = 'customer_reply',
  AI_AUTO_REPLY = 'ai_auto_reply',
  FOLLOW_UP = 'follow_up',
  CAMPAIGN = 'campaign',
  PRODUCT_SEND = 'product_send',
  PAYMENT_REMINDER = 'payment_reminder',
  QUOTE_REMINDER = 'quote_reminder',
  REPAIR_UPDATE = 'repair_update',
  DELIVERY_UPDATE = 'delivery_update',
  MARKETING = 'marketing',
  UTILITY = 'utility',
  AUTHENTICATION = 'authentication',
  TEST_MESSAGE = 'test_message',
  TRANSFER_NOTIFY = 'transfer_notify',
  OPT_OUT_ACK = 'opt_out_ack',
  BULK = 'bulk',
  MANUAL = 'manual',
}

export enum WhatsAppSendSource {
  AI = 'ai',
  FOLLOWUP = 'followup',
  CAMPAIGN = 'campaign',
  PRODUCT_SEND = 'product_send',
  MANUAL = 'manual',
  API = 'api',
  TESTER = 'tester',
  BULK = 'bulk',
  TRANSFER = 'transfer',
}

export enum GuardRequiredAction {
  ALLOW = 'allow',
  QUEUE = 'queue',
  DELAY = 'delay',
  REQUIRE_TEMPLATE = 'require_template',
  REQUIRE_APPROVAL = 'require_approval',
  BLOCK = 'block',
}

export enum WhatsAppRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum WhatsAppQueueStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  BLOCKED = 'blocked',
  CANCELLED = 'cancelled',
  APPROVAL_REQUIRED = 'approval_required',
}

export enum WhatsAppQueuePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum WhatsAppOptInStatus {
  UNKNOWN = 'unknown',
  OPTED_IN = 'opted_in',
  OPTED_OUT = 'opted_out',
  SUPPRESSED = 'suppressed',
}

export enum WhatsAppOptInSource {
  CUSTOMER_INITIATED = 'customer_initiated',
  WEBSITE_FORM = 'website_form',
  MANUAL_ADMIN = 'manual_admin',
  IMPORT = 'import',
  UNKNOWN = 'unknown',
}

export enum WhatsAppWarmupStatus {
  DISABLED = 'disabled',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  PAUSED = 'paused',
}

export enum WhatsAppSessionHealthEventType {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  QR_REQUIRED = 'qr_required',
  SEND_FAILED = 'send_failed',
  SEND_BLOCKED = 'send_blocked',
  RATE_LIMITED = 'rate_limited',
  SUSPECTED_BAN = 'suspected_ban',
  WARMUP_PAUSED = 'warmup_paused',
  HIGH_FAILURE_RATE = 'high_failure_rate',
  AUTOMATION_PAUSED = 'automation_paused',
  STARTUP_SAFE_MODE = 'startup_safe_mode',
}

export enum WhatsAppSessionHealthSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum WhatsAppSendAuditDecision {
  ALLOWED = 'allowed',
  DELAYED = 'delayed',
  QUEUED = 'queued',
  BLOCKED = 'blocked',
  APPROVAL_REQUIRED = 'approval_required',
  SENT = 'sent',
  FAILED = 'failed',
}

export const WHATSAPP_SAFETY_SETTINGS_GLOBAL_ID = 'default';
