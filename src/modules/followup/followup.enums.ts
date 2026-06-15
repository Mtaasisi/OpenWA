export enum ConversationStage {
  NEW_LEAD = 'new_lead',
  /** @deprecated use CONTACTED — kept for backward compatibility */
  REPLIED = 'replied',
  CONTACTED = 'contacted',
  NEEDS_IDENTIFIED = 'needs_identified',
  PRODUCT_SUGGESTED = 'product_suggested',
  PRICE_SENT = 'price_sent',
  NEGOTIATING = 'negotiating',
  WAITING_CUSTOMER_REPLY = 'waiting_customer_reply',
  FOLLOWUP_NEEDED = 'followup_needed',
  PAYMENT_PENDING = 'payment_pending',
  WON = 'won',
  LOST = 'lost',
  DEAD_NO_RESPONSE = 'dead_no_response',
}

export enum ConversationSource {
  WHATSAPP = 'whatsapp',
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  TIKTOK = 'tiktok',
  WEBSITE = 'website',
  PHONE_CALL = 'phone_call',
  WALK_IN = 'walk_in',
  REFERRAL = 'referral',
  REPEAT_CUSTOMER = 'repeat_customer',
  GOOGLE = 'google',
  OTHER = 'other',
}

export enum ConversationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  HOT = 'hot',
}

export enum PipelineBucket {
  NEW_LEADS = 'new_leads',
  WAITING_REPLY = 'waiting_reply',
  FOLLOWUP_NEEDED = 'followup_needed',
  PAYMENT_PENDING = 'payment_pending',
  HOT_LEADS = 'hot_leads',
  LOST_LEADS = 'lost_leads',
  WON_LEADS = 'won_leads',
}

export enum TemplateCategory {
  PRICE_FOLLOWUP = 'price_followup',
  BUDGET_FOLLOWUP = 'budget_followup',
  PAYMENT_PENDING = 'payment_pending',
  OUT_OF_STOCK = 'out_of_stock',
  VISIT_BRANCH = 'visit_branch',
  DEAD_LEAD_RECOVERY = 'dead_lead_recovery',
  STOCK_BACK = 'stock_back',
  REPAIR_READY = 'repair_ready',
}

export enum WhatsAppTemplateStatus {
  NOT_REQUIRED = 'not_required',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum FollowUpTriggerEvent {
  STAGE_ENTERED = 'stage_entered',
  NO_CUSTOMER_REPLY = 'no_customer_reply',
  NO_PAYMENT = 'no_payment',
  OUT_OF_STOCK = 'out_of_stock',
  VISIT_SCHEDULED = 'visit_scheduled',
  STALE_CONVERSATION = 'stale_conversation',
  MANUAL = 'manual',
}

export enum FollowUpMode {
  CREATE_TASK = 'create_task',
  AUTO_SEND = 'auto_send',
}

export enum FollowUpStatus {
  PENDING = 'pending',
  DUE = 'due',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
  ESCALATED = 'escalated',
  /** Autopilot queue statuses */
  AI_SUGGESTED = 'ai_suggested',
  NEEDS_APPROVAL = 'needs_approval',
  SCHEDULED = 'scheduled',
  AUTO_SENT = 'auto_sent',
  SENT = 'sent',
  FAILED = 'failed',
  STOPPED = 'stopped',
  CONVERTED = 'converted',
  REJECTED = 'rejected',
}

export enum FollowUpAutopilotMode {
  OFF = 'off',
  SUGGEST_ONLY = 'suggest_only',
  AUTO_SEND_SAFE = 'auto_send_safe',
  FULL_AUTOPILOT = 'full_autopilot',
}

export enum FollowUpRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  BLOCKED = 'blocked',
}

export enum FollowUpDetectedReason {
  ASKED_PRICE = 'asked_price',
  ASKED_DISCOUNT = 'asked_discount',
  ASKED_INSTALLMENT = 'asked_installment',
  WAITING_PAYMENT = 'waiting_payment',
  QUOTE_SENT = 'quote_sent',
  NO_RESPONSE = 'no_response',
  WAITING_STOCK = 'waiting_stock',
  REPAIR_PICKUP = 'repair_pickup',
  DELIVERY_UPDATE = 'delivery_update',
  WARRANTY_QUESTION = 'warranty_question',
  LOCATION_REQUEST = 'location_request',
  PRODUCT_AVAILABLE = 'product_available',
  CUSTOMER_NOT_INTERESTED = 'customer_not_interested',
  COMPLAINT = 'complaint',
  UNKNOWN = 'unknown',
}

export enum FollowUpCustomerMood {
  INTERESTED = 'interested',
  READY_TO_PAY = 'ready_to_pay',
  PRICE_SENSITIVE = 'price_sensitive',
  CONFUSED = 'confused',
  ANGRY = 'angry',
  NOT_INTERESTED = 'not_interested',
  NEUTRAL = 'neutral',
  UNKNOWN = 'unknown',
}

export enum FollowUpStopReason {
  CUSTOMER_REPLIED = 'customer_replied',
  CUSTOMER_OPTED_OUT = 'customer_opted_out',
  CUSTOMER_ALREADY_BOUGHT = 'customer_already_bought',
  LEAD_MARKED_LOST = 'lead_marked_lost',
  CONVERSATION_CLOSED = 'conversation_closed',
  GROUP_CHAT = 'group_chat',
  ACCOUNT_DISCONNECTED = 'account_disconnected',
  MAX_FOLLOWUP_LIMIT = 'max_followup_limit',
  OUTSIDE_HOURS = 'outside_hours',
  DUPLICATE_TODAY = 'duplicate_today',
  STAFF_TAKEOVER = 'staff_takeover',
  COMPLAINT_DETECTED = 'complaint_detected',
  AUTOPILOT_PAUSED = 'autopilot_paused',
  MAX_ATTEMPTS = 'max_attempts',
  STAFF_REJECTED = 'staff_rejected',
}

export enum FollowUpSendChannel {
  WHATSAPP = 'whatsapp',
  SMS = 'sms',
  BOTH = 'both',
}

export enum FollowUpSentBy {
  SYSTEM = 'system',
  AUTOPILOT = 'autopilot',
  STAFF = 'staff',
}

export enum FollowUpAttemptMode {
  TASK = 'task',
  MANUAL = 'manual',
  AUTO_SEND = 'auto_send',
}

export enum FollowUpOutcome {
  CUSTOMER_REPLIED = 'customer_replied',
  CUSTOMER_BOUGHT = 'customer_bought',
  STILL_THINKING = 'still_thinking',
  PRICE_TOO_HIGH = 'price_too_high',
  REQUESTED_LOWER_PRICE = 'requested_lower_price',
  NO_RESPONSE = 'no_response',
  WRONG_NUMBER = 'wrong_number',
  NOT_INTERESTED = 'not_interested',
  CALL_NEEDED = 'call_needed',
  RESCHEDULED = 'rescheduled',
}

export enum LostReason {
  PRICE_TOO_HIGH = 'price_too_high',
  CUSTOMER_COMPARING = 'customer_comparing',
  OUT_OF_STOCK = 'out_of_stock',
  NEEDS_INSTALLMENT = 'needs_installment',
  CUSTOMER_WILL_RETURN = 'customer_will_return',
  STOPPED_REPLYING = 'stopped_replying',
  BOUGHT_ELSEWHERE = 'bought_elsewhere',
  WRONG_PRODUCT_MATCH = 'wrong_product_match',
  NO_BUDGET = 'no_budget',
  DELIVERY_ISSUE = 'delivery_issue',
  FOLLOWUP_FAILED = 'followup_failed',
  STAFF_FAILED_FOLLOWUP = 'staff_failed_followup',
  OTHER = 'other',
}

export enum FollowUpPermission {
  VIEW_FOLLOWUP_QUEUE = 'view_followup_queue',
  MANAGE_FOLLOWUP_RULES = 'manage_followup_rules',
  MANAGE_MESSAGE_TEMPLATES = 'manage_message_templates',
  ASSIGN_FOLLOWUPS = 'assign_followups',
  COMPLETE_FOLLOWUPS = 'complete_followups',
  VIEW_FOLLOWUP_REPORTS = 'view_followup_reports',
  OVERRIDE_FOLLOWUP_STATUS = 'override_followup_status',
  VIEW_CONVERSATION_PIPELINE = 'view_conversation_pipeline',
  MANAGE_CONVERSATION_PIPELINE = 'manage_conversation_pipeline',
  ASSIGN_CONVERSATIONS = 'assign_conversations',
  UPDATE_CONVERSATION_STAGE = 'update_conversation_stage',
  CLOSE_CONVERSATION = 'close_conversation',
  VIEW_LOST_LEADS = 'view_lost_leads',
  VIEW_CONVERSION_REPORTS = 'view_conversion_reports',
  LINK_SALE_TO_CONVERSATION = 'link_sale_to_conversation',
  VIEW_LEAD_SOURCE_REPORTS = 'view_lead_source_reports',
  EDIT_LEAD_SOURCE = 'edit_lead_source',
  APPROVE_AUTOPILOT_FOLLOWUPS = 'approve_autopilot_followups',
  MANAGE_FOLLOWUP_AUTOPILOT = 'manage_followup_autopilot',
}

export enum FollowUpQueueFilter {
  DUE_NOW = 'due_now',
  DUE_TODAY = 'due_today',
  OVERDUE = 'overdue',
  HOT_LEADS = 'hot_leads',
  PAYMENT_PENDING = 'payment_pending',
  STOCK_REMINDERS = 'stock_reminders',
  WAITING_CUSTOMER_REPLY = 'waiting_customer_reply',
  AI_SUGGESTED = 'ai_suggested',
  NEEDS_APPROVAL = 'needs_approval',
  SCHEDULED = 'scheduled',
  AUTO_SENT = 'auto_sent',
  FAILED = 'failed',
  STOPPED = 'stopped',
  CONVERTED = 'converted',
}
