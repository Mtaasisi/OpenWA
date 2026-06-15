export enum AiTrainingSourceType {
  INBOX_MESSAGE = 'inbox_message',
  GROUP_CONVERSATION = 'group_conversation',
  CONVERSATION = 'conversation',
  CUSTOMER_PROFILE = 'customer_profile',
  PRODUCT_QUESTION = 'product_question',
  PAYMENT_QUESTION = 'payment_question',
  WARRANTY_QUESTION = 'warranty_question',
  DISCOUNT_QUESTION = 'discount_question',
  INSTALLMENT_QUESTION = 'installment_question',
  CAMPAIGN_QUESTION = 'campaign_question',
  AGENT_ACTION = 'agent_action',
  SYSTEM_DIAGNOSIS = 'system_diagnosis',
  MANUAL_ADMIN_NOTE = 'manual_admin_note',
}

export enum AiTrainingIssueType {
  NO_ANSWER = 'no_answer',
  WRONG_ANSWER = 'wrong_answer',
  INCOMPLETE_ANSWER = 'incomplete_answer',
  SLOW_REPLY = 'slow_reply',
  LOW_CONFIDENCE = 'low_confidence',
  HUMAN_TAKEOVER = 'human_takeover',
  REPEATED_QUESTION = 'repeated_question',
  MISSING_PRODUCT_KNOWLEDGE = 'missing_product_knowledge',
  MISSING_POLICY = 'missing_policy',
  MISSING_ACTION_RULE = 'missing_action_rule',
  CUSTOMER_SERVICE_REQUEST = 'customer_service_request',
  NEW_BUSINESS_RULE = 'new_business_rule',
  ADMIN_MANUAL_TRAINING = 'admin_manual_training',
}

export enum AiTrainingSuggestionActionType {
  REPLY_TEXT = 'reply_text',
  UPDATE_MEMORY = 'update_memory',
  UPDATE_FAQ = 'update_faq',
  UPDATE_RULE = 'update_rule',
  UPDATE_PRODUCT_QA = 'update_product_qa',
  UPDATE_WARRANTY_RULE = 'update_warranty_rule',
  UPDATE_DISCOUNT_RULE = 'update_discount_rule',
  UPDATE_INSTALLMENT_RULE = 'update_installment_rule',
  UPDATE_AGENT_ACTION_RULE = 'update_agent_action_rule',
  CREATE_TOOL_RULE = 'create_tool_rule',
  MARK_UNANSWERABLE = 'mark_unanswerable',
  ESCALATE_TO_HUMAN = 'escalate_to_human',
}

export enum AiTrainingUpdateMode {
  APPEND = 'append',
  REPLACE_SECTION = 'replace_section',
  CREATE_SECTION = 'create_section',
  MEMORY_ONLY = 'memory_only',
  DB_RULE_ONLY = 'db_rule_only',
  FILE_AND_MEMORY = 'file_and_memory',
}

export enum AiTrainingApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  APPLIED = 'applied',
  FAILED = 'failed',
  REJECTED = 'rejected',
}

export enum AiTrainingAuditAction {
  CREATED = 'created',
  SUGGESTION_GENERATED = 'suggestion_generated',
  ANSWERED = 'answered',
  APPROVED = 'approved',
  APPLIED = 'applied',
  REJECTED = 'rejected',
  REINDEXED = 'reindexed',
  FAILED = 'failed',
}

export enum AiTrainingAuditActorType {
  AI = 'ai',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export const TRAINING_KNOWLEDGE_TARGETS = [
  'FAQ.md',
  'FAQ_KNOWLEDGE.md',
  'PRODUCT_QA.md',
  'AI_REPLY_RULES.md',
  'WARRANTY_RULES.md',
  'DISCOUNT_ESCALATION_RULES.md',
  'INSTALLMENT_PRODUCT_RULES.md',
  'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
  'AGENT_ACTION_RULES.md',
  'DELIVERY_RULES.md',
  'PAYMENT_RULES.md',
  'AI_REPLY_EXAMPLES.md',
  'SHOP.md',
] as const;

export type TrainingKnowledgeTarget = (typeof TRAINING_KNOWLEDGE_TARGETS)[number];

export const HIGH_RISK_ACTION_TYPES: AiTrainingSuggestionActionType[] = [
  AiTrainingSuggestionActionType.UPDATE_DISCOUNT_RULE,
  AiTrainingSuggestionActionType.UPDATE_WARRANTY_RULE,
  AiTrainingSuggestionActionType.UPDATE_AGENT_ACTION_RULE,
  AiTrainingSuggestionActionType.CREATE_TOOL_RULE,
];

export interface TrainingOverview {
  pendingQuestions: number;
  highPriority: number;
  approvedToday: number;
  appliedKnowledge: number;
  needsReindex: boolean;
  aiSuggestions: number;
  urgentCount: number;
}

export interface CreateTrainingItemInput {
  sourceType: AiTrainingSourceType;
  sourceId?: string | null;
  issueType: AiTrainingIssueType;
  question: string;
  title?: string | null;
  conversationExcerpt?: string | null;
  sessionId?: string | null;
  chatId?: string | null;
  customerId?: string | null;
  messageId?: string | null;
  productId?: string | null;
  branchId?: string | null;
  aiDraftAnswer?: string | null;
  confidenceScore?: number;
  whyUnsure?: string | null;
  detectedIntent?: string | null;
  detectedProduct?: string | null;
  contextMessages?: Array<{ role: string; body: string; at?: string }> | null;
  suggestedTargetFile?: string | null;
  suggestedMemoryType?: string | null;
  suggestedRuleCategory?: string | null;
  metadata?: Record<string, unknown> | null;
  createdByAi?: boolean;
}

export interface ApprovalPreviewInput {
  trainingItemId: string;
  selectedSuggestionId?: string | null;
  customAnswer?: string | null;
  customInstruction?: string | null;
  targetFile?: string | null;
  targetSection?: string | null;
  updateMode?: AiTrainingUpdateMode;
}

export interface ApprovalApplyInput extends ApprovalPreviewInput {
  approvedBy: string;
  approvedByRole?: string;
  applyNow?: boolean;
}
