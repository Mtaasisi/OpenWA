// API Service Layer for OpenWA Dashboard
// Centralized API client with TypeScript types

import {
  clearAuthSession,
  getAuthHeaders,
  getRefreshToken,
  setAuthSession,
  type AuthUser,
} from '../lib/auth-storage';

const API_BASE_URL = '/api';

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as {
          accessToken: string;
          refreshToken: string;
          user: AuthUser;
        };
        setAuthSession(data.accessToken, data.refreshToken, data.user);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function assertFollowupConversation(data: unknown): FollowupConversation {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid follow-up conversation response from API');
  }
  const row = data as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.sessionId !== 'string') {
    throw new Error('Invalid follow-up conversation response from API');
  }
  return data as FollowupConversation;
}

// =============================================================================
// Types
// =============================================================================

export interface Session {
  id: string;
  name: string;
  status: 'created' | 'initializing' | 'qr_ready' | 'authenticating' | 'loading_chats' | 'ready' | 'disconnected' | 'failed';
  phone?: string;
  pushName?: string;
  lastActive?: string;
  createdAt: string;
  updatedAt: string;
  aiAutoReplyEnabled?: boolean;
  followupAutopilotEnabled?: boolean;
  staffAiAllowedNumbers?: string[];
  backgroundSyncing?: boolean;
  statusMessage?: string;
  proxyUrl?: string | null;
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5' | null;
  linkingMode?: boolean;
  engineType?: string | null;
  effectiveEngineType?: string;
  engineAuthPresent?: boolean;
  requiresRelink?: boolean;
  relinkReason?: 'alternate_engine' | 'auth_missing' | null;
}

export interface StartSessionOptions {
  /** Pause health monitor + connect auto-retry during QR scan (default true when never linked). */
  linkingMode?: boolean;
}

export interface CreateSessionPayload {
  name: string;
  proxyUrl?: string;
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5';
}

export interface GroupParticipant {
  id: string;
  number: string;
  name?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  createdAt?: number;
  participants: GroupParticipant[];
  isReadOnly?: boolean;
  isAnnounce?: boolean;
}

export interface SessionStats {
  total: number;
  active: number;
  ready: number;
  disconnected: number;
  byStatus: Record<string, number>;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
  health?: SessionHealthOverview[];
}

export interface SessionHealthOverview {
  sessionId: string;
  name: string;
  dbStatus: Session['status'];
  liveStatus: Session['status'];
  enginePresent: boolean;
  engineStatus?: Session['status'];
  pendingReconnect: boolean;
  manuallyStopped: boolean;
  linkingMode: boolean;
  backgroundSyncing: boolean;
  requiresRelink: boolean;
}

export interface OverviewStats {
  sessions: {
    active: number;
    total: number;
    byStatus: Record<string, number>;
  };
  messages: {
    sent: number;
    received: number;
    failed: number;
    failedBySession?: Record<string, number>;
    today: { sent: number; received: number; total: number };
    last24h: { sent: number; received: number; total: number };
  };
  apiActivity24h: number;
}

export interface Webhook {
  id: string;
  sessionId: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  role: 'admin' | 'user' | 'readonly';
  allowedIps?: string[];
  allowedSessions?: string[];
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: number;
  createdAt: string;
  apiKey?: string; // Only returned on creation
}

export interface AuditLog {
  id: string;
  action: string;
  severity: 'info' | 'warn' | 'error';
  apiKeyId?: string;
  apiKeyName?: string;
  sessionId?: string;
  sessionName?: string;
  ipAddress?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface MessageResponse {
  messageId: string;
  timestamp: number;
}

export interface InboxMessage {
  id: string;
  sessionId: string;
  waMessageId?: string;
  chatId: string;
  from: string;
  to: string;
  body?: string;
  type: string;
  direction: 'incoming' | 'outgoing';
  timestamp?: number;
  status: string;
  metadata?: Record<string, unknown>;
  isAiGenerated?: boolean;
  aiProvider?: string | null;
  aiModel?: string | null;
  createdAt: string;
}

export interface Conversation {
  sessionId: string;
  sessionName: string;
  sessionStatus: string;
  chatId: string;
  displayName: string;
  lastMessageAt: string;
  lastPreview: string | null;
  lastMessageType?: string | null;
  lastMessageId?: string | null;
  lastDirection: 'incoming' | 'outgoing';
  messageCount: number;
  unreadCount: number;
  hasUnread: boolean;
  resolved: boolean;
  hasFollowUp: boolean;
  customerName?: string | null;
  customerPhone?: string | null;
  linkedExternalId?: string | null;
  profilePicUrl?: string | null;
  leadSource?: string | null;
  aiHandlingState?: string | null;
  aiOptOut?: boolean;
  aiAutoReplyPaused?: boolean;
  followUpAt?: string | null;
  assignedStaffId?: string | null;
  accountPhoneNumber?: string | null;
  accountPushName?: string | null;
  accountStatus?: string;
  accountPurpose?: string | null;
  branchId?: string | null;
  assignedStaffName?: string | null;
  stage?: string | null;
  priority?: string | null;
  nextFollowupAt?: string | null;
  followupOverdue?: boolean;
  followupAutopilotPaused?: boolean;
  lastCustomerMessageAt?: string | null;
  lastStaffMessageAt?: string | null;
  responseTimeSeconds?: number | null;
  productInterest?: string | null;
  outcome?: string | null;
  lostReason?: string | null;
  resolutionReason?: string | null;
  threadState?: string;
  threadStateReason?: string;
  needsReply?: boolean;
  needsHuman?: boolean;
  waitingCustomer?: boolean;
  hotLead?: boolean;
  followupDue?: boolean;
  aiStatus?: string;
  queueStatus?: string | null;
  threadTier?: 'hot' | 'warm' | 'cold';
  slaStatus?: string | null;
  isGroup?: boolean;
  /** Latest inbound message was sent via sender's WhatsApp broadcast list. */
  lastInboundBroadcast?: boolean;
}

export type InboxWorkQueue =
  | 'my_work'
  | 'needs_reply'
  | 'ai_needs_human'
  | 'hot_leads'
  | 'waiting_payment'
  | 'waiting_stock'
  | 'followup_due'
  | 'unassigned'
  | 'assigned_to_me'
  | 'all'
  | 'groups'
  | 'resolved'
  | 'failed_sends';

export type InboxConversationsQuery = {
  sessionId?: string;
  branchId?: string;
  assignedStaffId?: string;
  assignedToMe?: boolean;
  unassigned?: boolean;
  status?: 'open' | 'resolved';
  stage?: string;
  priority?: string;
  unread?: boolean;
  overdueFollowup?: boolean;
  aiStatus?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'priority' | 'overdue';
  limit?: number;
  offset?: number;
  leadSource?: string;
  conversationType?: string;
  queue?: InboxWorkQueue;
  cursor?: string;
  includeCounts?: boolean;
  activeSinceDays?: number;
  excludeColdResolved?: boolean;
  coldResolvedDays?: number;
};

export type InboxQueueCounts = Partial<Record<InboxWorkQueue, number>> & {
  failed?: number;
  aiBlocked?: number;
  overdue?: number;
};

export interface UnifiedInboxConversationsResponse {
  conversations: Conversation[];
  total: number;
  limit: number;
  offset: number;
  nextCursor?: string | null;
  hasMore?: boolean;
  counts?: InboxQueueCounts;
  largeAccountMode?: boolean;
  totalApproximate?: boolean;
  threadTotal?: number;
  recommendSingleSession?: boolean;
  largeAccountDefaults?: {
    activeSinceDays: number;
    coldResolvedDays: number;
    hotTierDays: number;
    hotTierSize: number;
  };
}

export interface InboxQueueCountsResponse {
  counts: InboxQueueCounts;
  cached?: boolean;
  largeAccountMode?: boolean;
}

export interface InboxThreadSearchRow {
  sessionId: string;
  chatId: string;
  displayName: string | null;
  lastPreview: string | null;
  lastMessageAt: string;
  unreadCount: number;
  matchReason?: string;
}

export interface InboxThreadSearchResponse {
  threads: InboxThreadSearchRow[];
  total: number;
  limit: number;
}

export interface InboxMessageSearchHit {
  id: string;
  sessionId: string;
  sessionName: string;
  chatId: string;
  chatName: string;
  isGroup: boolean;
  direction: 'inbound' | 'outbound';
  type: string;
  body: string;
  bodyPreview: string;
  timestamp: number | null;
  createdAt: string;
  matchReason?: string;
}

export interface InboxMessageSearchResponse {
  matches: InboxMessageSearchHit[];
  total: number;
  returned: number;
  offset: number;
  truncated: boolean;
}

export type InboxResolveOutcome =
  | 'won'
  | 'lost'
  | 'follow_up_later'
  | 'waiting_payment'
  | 'waiting_stock'
  | 'no_response'
  | 'spam';

export type InboxAiHandlingState = 'idle' | 'ai_handling' | 'waiting_human' | 'human_handling';

export interface InboxThreadCrm {
  sessionId: string;
  chatId: string;
  resolved: boolean;
  resolvedAt: string | null;
  internalNote: string | null;
  followUpAt: string | null;
  followUpReason?: string | null;
  followUpNote?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  linkedExternalId: string | null;
  aiAutoReplyPaused: boolean;
  aiHandlingState: InboxAiHandlingState;
  aiEscalatedAt: string | null;
  aiOptOut: boolean;
  followupAutopilotPaused?: boolean;
  followupAutopilotPausedUntil?: string | null;
  resolvedReason: string | null;
  resolvedNote: string | null;
  outcome: string | null;
  resolvedByStaffId: string | null;
  updatedAt: string;
  preferredBranchId?: string | null;
  confirmedCity?: string | null;
  lastProductInterest?: string | null;
  lastIntent?: string | null;
  discountRequestCount?: number;
  installmentInterest?: boolean;
  paymentReadiness?: string | null;
  aiNotes?: string | null;
  autopilotPauseReason?: string | null;
  manualTakeoverUntil?: string | null;
  buyingPreferences?: string | null;
  discountNegotiationMarked?: boolean;
}

export interface UpdateInboxThreadCrmPayload {
  sessionId: string;
  chatId: string;
  resolved?: boolean;
  internalNote?: string | null;
  followUpAt?: string | null;
  followUpReason?: string | null;
  followUpNote?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  linkedExternalId?: string | null;
  resolvedReason?: string | null;
  resolvedNote?: string | null;
  outcome?: InboxResolveOutcome | null;
  lostReason?: string | null;
  aiAutoReplyPaused?: boolean;
  aiHandlingState?: InboxAiHandlingState;
  aiOptOut?: boolean;
  preferredBranchId?: string | null;
  confirmedCity?: string | null;
  lastProductInterest?: string | null;
  lastIntent?: string | null;
  paymentReadiness?: string | null;
  aiNotes?: string | null;
  autopilotPauseReason?: string | null;
  installmentInterest?: boolean;
  clearAiMemory?: boolean;
  buyingPreferences?: string | null;
  discountNegotiationMarked?: boolean;
}

export interface ChatSummary {
  chatId: string;
  name: string;
  isGroup: boolean;
  unreadCount?: number;
  lastMessageAt?: number;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp?: string;
  details?: {
    database?: { status: string };
    redis?: { status: string };
    queue?: { status: string };
  };
}

export interface InfraServerStatus {
  nodeEnv: 'production' | 'development';
  domain: string;
  port: string;
  dashboardPort: string;
  baseUrl: string;
  dashboardUrl: string;
  corsOrigins: string;
}

export interface InfraWebhookStatus {
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface InfraRateLimitStatus {
  ttl: number;
  max: number;
}

export interface InfraStatus {
  api?: { port: number; baseUrl: string };
  server: InfraServerStatus;
  webhook: InfraWebhookStatus;
  rateLimit: InfraRateLimitStatus;
  database: {
    connected: boolean;
    type: string;
    host: string;
    port?: string;
    database?: string;
    username?: string;
    poolSize?: number;
    sslEnabled?: boolean;
  };
  redis: { enabled: boolean; connected: boolean; host: string; port: number };
  queue: {
    enabled: boolean;
    messages: { pending: number; completed: number; failed: number };
    webhooks: { pending: number; completed: number; failed: number };
  };
  storage: { type: 'local' | 's3'; path?: string; bucket?: string };
  engine: {
    type: string;
    headless: boolean;
    sessionDataPath?: string;
    browserArgs?: string;
  };
}

export interface SaveConfigPayload {
  server?: InfraServerStatus;
  webhook?: InfraWebhookStatus;
  rateLimit?: InfraRateLimitStatus;
  database?: {
    type: 'sqlite' | 'postgres';
    builtIn?: boolean;
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    database?: string;
    poolSize?: number;
    sslEnabled?: boolean;
  };
  redis?: {
    enabled?: boolean;
    builtIn?: boolean;
    host?: string;
    port?: string;
    password?: string;
  };
  queue?: {
    enabled?: boolean;
  };
  storage?: {
    type: 'local' | 's3';
    builtIn?: boolean;
    localPath?: string;
    s3Bucket?: string;
    s3Region?: string;
    s3AccessKey?: string;
    s3SecretKey?: string;
    s3Endpoint?: string;
  };
  engine?: {
    type?: string;
    headless?: boolean;
    sessionDataPath?: string;
    browserArgs?: string;
  };
}

export interface Settings {
  general: { apiBaseUrl: string; sessionTimeout: number; autoReconnect: boolean; debugMode: boolean };
  api: { rateLimit: number; rateLimitWindow: number; enableDocs: boolean };
  notifications: { emailEnabled: boolean; notificationEmail: string; webhookAlerts: boolean };
}

// =============================================================================
// API Client
// =============================================================================

async function request<T>(endpoint: string, options: RequestInit = {}, retried = false): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(
      'Cannot reach OpenWA API. Start the backend with npm run dev (or npm run start:dev) from the project root.',
    );
  }

  if (response.status === 401 && !retried && !endpoint.startsWith('/auth/login')) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return request<T>(endpoint, options, true);
    }
    clearAuthSession();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    if (response.status >= 500 && !contentType.includes('application/json')) {
      throw new Error(
        'OpenWA API is not responding (port 2785). Run npm run dev from the project root, then refresh.',
      );
    }
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const msg = error.message;
    const text = Array.isArray(msg) ? msg.join(', ') : msg || `HTTP ${response.status}`;
    throw new Error(text);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// =============================================================================
// Session API
// =============================================================================

export const statsApi = {
  getOverview: () => request<OverviewStats>('/stats/overview'),
};

export const sessionApi = {
  list: () => request<Session[]>('/sessions'),
  get: (id: string) => request<Session>(`/sessions/${id}`),
  create: (payload: CreateSessionPayload | string) =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify(typeof payload === 'string' ? { name: payload } : payload),
    }),
  delete: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  start: (id: string, options?: StartSessionOptions) =>
    request<Session>(`/sessions/${id}/start`, {
      method: 'POST',
      ...(options?.linkingMode !== undefined
        ? { body: JSON.stringify({ linkingMode: options.linkingMode }) }
        : {}),
    }),
  setLinkingMode: (sessionId: string, linkingMode: boolean) =>
    request<Session>(`/sessions/${sessionId}/linking-mode`, {
      method: 'PATCH',
      body: JSON.stringify({ linkingMode }),
    }),
  stop: (id: string) => request<Session>(`/sessions/${id}/stop`, { method: 'POST' }),
  restart: (id: string) => request<Session>(`/sessions/${id}/restart`, { method: 'POST' }),
  relink: (id: string) => request<Session>(`/sessions/${id}/relink`, { method: 'POST' }),
  getQR: (id: string) =>
    request<{ qrCode: string; status: string; statusMessage?: string; failureCode?: string }>(
      `/sessions/${id}/qr`,
    ),
  getStats: () => request<SessionStats>('/sessions/stats/overview'),
  getHealthOverview: () => request<SessionHealthOverview[]>('/sessions/health/overview'),
  getGroups: (id: string) => request<{ id: string; name: string }[]>(`/sessions/${id}/groups`),
  getGroupInfo: (sessionId: string, groupId: string) =>
    request<GroupInfo>(`/sessions/${sessionId}/groups/${encodeURIComponent(groupId)}`),
  getConversations: (id: string) => request<Conversation[]>(`/sessions/${id}/conversations`),
  markConversationRead: (sessionId: string, chatId: string) =>
    request<{ ok: boolean }>(`/sessions/${sessionId}/conversations/${encodeURIComponent(chatId)}/read`, {
      method: 'PATCH',
    }),
  setAiAutoReply: (sessionId: string, enabled: boolean) =>
    request<Session>(`/sessions/${sessionId}/ai-auto-reply`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  setStaffAiNumbers: (sessionId: string, staffAiAllowedNumbers: string[]) =>
    request<Session>(`/sessions/${sessionId}/staff-ai-numbers`, {
      method: 'PATCH',
      body: JSON.stringify({ staffAiAllowedNumbers }),
    }),
  setFollowupAutopilot: (sessionId: string, enabled: boolean) =>
    request<Session>(`/sessions/${sessionId}/followup-autopilot`, {
      method: 'PATCH',
      body: JSON.stringify({ followupAutopilotEnabled: enabled }),
    }),
  setProxy: (
    sessionId: string,
    payload: { proxyUrl?: string | null; proxyType?: 'http' | 'https' | 'socks4' | 'socks5' },
  ) =>
    request<Session>(`/sessions/${sessionId}/proxy`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  setEngine: (sessionId: string, engineType: string | null) =>
    request<Session>(`/sessions/${sessionId}/engine`, {
      method: 'PATCH',
      body: JSON.stringify({ engineType }),
    }),
  getChats: (id: string) => request<ChatSummary[]>(`/sessions/${id}/chats`),
};

// =============================================================================
// CRM Products API
// =============================================================================

export type ProductVariantType = 'standard' | 'parent' | 'imei_child';

export interface CrmProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode?: string | null;
  costPrice?: number | null;
  sellingPrice: number | null;
  quantity: number;
  variantType: ProductVariantType;
  isParent: boolean;
  trackInventoryItems?: boolean;
  lowStockThreshold?: number;
  parentVariantId: string | null;
  attributes: Record<string, string | number | boolean | null> | null;
  isActive: boolean;
  sortOrder: number;
  installmentEnabled?: boolean;
  installmentMinDeposit?: number | null;
  installmentDurationDays?: number | null;
  installmentScheduleType?: string | null;
  installmentPolicy?: string | null;
  installmentPenaltyPolicy?: string | null;
  installmentExpiryDays?: number | null;
  installmentRequiresApproval?: boolean;
  allowInstallmentWhenOutOfStock?: boolean;
  stockingReminderEnabled?: boolean;
  installmentNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  brand?: string | null;
  model?: string | null;
  barcode?: string | null;
  tags?: string[] | null;
  warrantyDefault?: string | null;
  supplier?: string | null;
  visibility?: string;
  costPrice?: number | null;
  imageUrl: string | null;
  imageUrls?: string[] | null;
  currency: string | null;
  sellingPrice: number | null;
  isActive: boolean;
  sortOrder: number;
  externalId?: string | null;
  variants: CrmProductVariant[];
  totalStock: number;
  variantCount: number;
  inventorySummary?: {
    available: number;
    reserved: number;
    sold: number;
    imeiTrackedVariants: number;
  };
  health?: ProductHealthResult;
  createdAt: string;
  updatedAt: string;
  installmentEnabled?: boolean;
  installmentMinDeposit?: number | null;
  installmentDurationDays?: number | null;
  installmentScheduleType?: string | null;
  installmentPolicy?: string | null;
  installmentPenaltyPolicy?: string | null;
  installmentExpiryDays?: number | null;
  installmentRequiresApproval?: boolean;
  allowInstallmentWhenOutOfStock?: boolean;
  stockingReminderEnabled?: boolean;
  installmentNotes?: string | null;
}

/** List endpoint omits variant payloads. */
export type CrmProductListItem = Omit<CrmProduct, 'variants'> & {
  variants?: never;
  inventorySummary?: CrmProduct['inventorySummary'];
  health?: ProductHealthResult;
};

export type ProductHealthIssue =
  | 'missing_image'
  | 'missing_price'
  | 'missing_category'
  | 'missing_sku'
  | 'duplicate_sku'
  | 'invalid_image'
  | 'no_variants'
  | 'variant_missing_price'
  | 'variant_missing_stock'
  | 'imei_zero_available'
  | 'duplicate_imei'
  | 'low_stock'
  | 'out_of_stock'
  | 'installment_invalid'
  | 'inactive_with_active_variants';

export interface ProductHealthResult {
  productId: string;
  score: number;
  issues: ProductHealthIssue[];
  warnings: string[];
}

export interface ProductHealthSummary {
  totalProducts: number;
  activeProducts: number;
  lowStock: number;
  outOfStock: number;
  missingImages: number;
  importIssues: number;
  duplicateSkus: number;
  duplicateImeis: number;
  installmentMisconfigured: number;
}

export type InventoryItemStatus =
  | 'available'
  | 'reserved'
  | 'sold'
  | 'returned'
  | 'repair_hold'
  | 'damaged'
  | 'lost'
  | 'transferred'
  | 'inactive';

export interface CrmInventoryItem {
  id: string;
  productId: string;
  variantId: string;
  branchId: string;
  imei: string | null;
  serialNumber: string | null;
  deviceId?: string | null;
  barcode?: string | null;
  status: InventoryItemStatus;
  costPrice: number | null;
  sellingPrice: number | null;
  supplier?: string | null;
  purchaseBatch?: string | null;
  reservedAt?: string | null;
  soldAt?: string | null;
  saleId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductAuditEvent {
  id: string;
  productId: string;
  variantId: string | null;
  inventoryItemId: string | null;
  action: string;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface CatalogStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  inventoryValue: number;
  scaleMax: number;
  currencyHint: string | null;
}

export interface SendCrmProductPayload {
  sessionId: string;
  chatId: string;
  variantId?: string;
  inventoryItemId?: string;
  includeAllVariants?: boolean;
  includeAvailableDevices?: boolean;
  inStockOnly?: boolean;
  includeImage?: boolean;
  refreshStock?: boolean;
}

type InauzwaConnectionInfo = {
  configured: boolean;
  source: 'database' | 'api' | 'supabase' | null;
  configuredVia: 'env' | 'ui' | null;
  databaseUrlMasked: string | null;
  apiUrl: string | null;
  hasApiToken: boolean;
  loginEmail: string | null;
  connectedViaLogin: boolean;
  vendorAutoFromLogin: boolean;
};

type InauzwaPreferencesDto = {
  branchId: string | null;
  vendorId: string | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  refreshBeforeSend: boolean;
  syncProducts: boolean;
  syncCustomers: boolean;
  syncProformas: boolean;
  syncRecentSales: boolean;
  syncCategories: boolean;
  pushSalesToInauzwa: boolean;
  businessName: string | null;
  defaultPaymentInstructions: string | null;
  defaultBranchPickupInfo: string | null;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  currency: string;
  connection: InauzwaConnectionInfo;
  lastSyncResult: {
    productsCreated: number;
    productsUpdated: number;
    variantsCreated: number;
    variantsUpdated: number;
    productsDeactivated: number;
    source: string;
  } | null;
};

export const productsApi = {
  list: async (params?: {
    q?: string;
    inStockOnly?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.inStockOnly) query.set('inStockOnly', 'true');
    if (params?.activeOnly === false) query.set('activeOnly', 'false');
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    const data = await request<CrmProductListItem[] | { items: CrmProductListItem[]; total: number; hasMore: boolean }>(
      `/products${qs ? `?${qs}` : ''}`,
    );
    if (Array.isArray(data)) return data;
    return data.items;
  },
  listPaginated: (params?: {
    q?: string;
    inStockOnly?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.inStockOnly) query.set('inStockOnly', 'true');
    if (params?.activeOnly === false) query.set('activeOnly', 'false');
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<{ items: CrmProductListItem[]; total: number; hasMore: boolean }>(
      `/products${qs ? `?${qs}` : ''}`,
    ).then((data) => (Array.isArray(data) ? { items: data, total: data.length, hasMore: false } : data));
  },
  catalogStats: (params?: { activeOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.activeOnly === false) query.set('activeOnly', 'false');
    const qs = query.toString();
    return request<CatalogStats>(`/products/catalog/stats${qs ? `?${qs}` : ''}`);
  },
  healthSummary: () => request<ProductHealthSummary>('/products/health/summary'),
  productHealth: (id: string) => request<ProductHealthResult>(`/products/${id}/health`),
  productHistory: (id: string) => request<ProductAuditEvent[]>(`/products/${id}/history`),
  listInventoryItems: (
    productId: string,
    params?: { variantId?: string; branchId?: string; status?: string; q?: string },
  ) => {
    const query = new URLSearchParams();
    if (params?.variantId) query.set('variantId', params.variantId);
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.status) query.set('status', params.status);
    if (params?.q) query.set('q', params.q);
    const qs = query.toString();
    return request<CrmInventoryItem[]>(
      `/products/${productId}/inventory-items${qs ? `?${qs}` : ''}`,
    );
  },
  createInventoryItem: (productId: string, data: Partial<CrmInventoryItem> & { variantId: string }) =>
    request<CrmProduct>(`/products/${productId}/inventory-items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInventoryItem: (
    productId: string,
    itemId: string,
    data: Partial<CrmInventoryItem>,
  ) =>
    request<CrmProduct>(`/products/${productId}/inventory-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteInventoryItem: (productId: string, itemId: string) =>
    request<CrmProduct>(`/products/${productId}/inventory-items/${itemId}`, {
      method: 'DELETE',
    }),
  bulkPasteInventory: (
    productId: string,
    data: { variantId: string; text: string; branchId?: string; dryRun?: boolean },
  ) =>
    request<{ created: number; skipped: number; preview: unknown }>(
      `/products/${productId}/inventory-items/bulk-paste`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  generateVariants: (
    productId: string,
    data: {
      storageOptions?: string[];
      colorOptions?: string[];
      ramOptions?: string[];
      conditionOptions?: string[];
      gradeOptions?: string[];
      basePrice?: number;
      skuPattern?: string;
    },
  ) =>
    request<{ created: string[]; count: number }>(
      `/products/${productId}/variants/generate`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  importPreview: (payload: {
    fileName: string;
    fileType: 'csv' | 'xlsx';
    fileContentBase64: string;
    importType: string;
    columnMapping?: Record<string, string>;
  }) =>
    request<unknown>('/products/import/preview', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  importExecute: (payload: {
    fileName: string;
    fileType: 'csv' | 'xlsx';
    fileContentBase64: string;
    importType: string;
    mode: string;
    branchId?: string;
    columnMapping?: Record<string, string>;
  }) =>
    request<{ batchId: string; createdCount: number; updatedCount: number; skippedCount: number }>(
      '/products/import/execute',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  importTemplate: () => request<{ csv: string }>('/products/import/template'),
  importHistory: () => request<unknown[]>('/products/import/history'),
  importRollback: (batchId: string) =>
    request<{ rolledBack: number; warnings: string[] }>(
      `/products/import/${batchId}/rollback`,
      { method: 'POST' },
    ),
  get: (id: string) => request<CrmProduct>(`/products/${id}`),
  create: (data: {
    name: string;
    description?: string | null;
    sku?: string | null;
    category?: string | null;
    imageUrl?: string | null;
    currency?: string | null;
    sellingPrice?: number | null;
    isActive?: boolean;
  }) =>
    request<CrmProduct>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<CrmProduct>) =>
    request<CrmProduct>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  remove: (id: string) => request<void>(`/products/${id}`, { method: 'DELETE' }),
  addVariant: (
    productId: string,
    data: {
      name: string;
      sku?: string | null;
      sellingPrice?: number | null;
      quantity?: number;
      trackInventoryItems?: boolean;
      lowStockThreshold?: number;
      variantType?: ProductVariantType;
      isParent?: boolean;
      parentVariantId?: string | null;
      attributes?: Record<string, string | number | boolean | null> | null;
      isActive?: boolean;
    },
  ) =>
    request<CrmProduct>(`/products/${productId}/variants`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateVariant: (productId: string, variantId: string, data: Partial<CrmProductVariant>) =>
    request<CrmProduct>(`/products/${productId}/variants/${variantId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  removeVariant: (productId: string, variantId: string) =>
    request<CrmProduct>(`/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),
  previewMessage: (
    id: string,
    params?: {
      variantId?: string;
      inventoryItemId?: string;
      includeAllVariants?: boolean;
      includeAvailableDevices?: boolean;
      inStockOnly?: boolean;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.variantId) query.set('variantId', params.variantId);
    if (params?.inventoryItemId) query.set('inventoryItemId', params.inventoryItemId);
    if (params?.includeAllVariants === false) query.set('includeAllVariants', 'false');
    if (params?.includeAvailableDevices) query.set('includeAvailableDevices', 'true');
    if (params?.inStockOnly === false) query.set('inStockOnly', 'false');
    const qs = query.toString();
    return request<{ text: string }>(`/products/${id}/preview-message${qs ? `?${qs}` : ''}`);
  },
  send: (id: string, payload: SendCrmProductPayload) =>
    request<MessageResponse>(`/products/${id}/send`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  inauzwaSyncStatus: () =>
    request<{
      configured: boolean;
      database: boolean;
      api: boolean;
      branchId: string | null;
      vendorId: string | null;
      currency: string;
      defaultApiUrl: string | null;
      defaultSupabaseUrl: string | null;
      hasDefaultSupabaseAnonKey: boolean;
      lastSyncAt: string | null;
      lastSyncError: string | null;
      hasSupabaseConfig: boolean;
      preferences: InauzwaPreferencesDto;
    }>('/products/sync/inauzwa/status'),
  listInauzwaBranches: () =>
    request<{ id: string; name: string; vendorId?: string | null; productCount?: number }[]>(
      '/products/sync/inauzwa/branches',
    ),
  updateInauzwaSettings: (payload: {
    branchId?: string | null;
    vendorId?: string | null;
    autoSyncEnabled?: boolean;
    autoSyncIntervalMinutes?: number;
    refreshBeforeSend?: boolean;
    syncProducts?: boolean;
    syncCustomers?: boolean;
    syncProformas?: boolean;
    syncRecentSales?: boolean;
    syncCategories?: boolean;
    pushSalesToInauzwa?: boolean;
    businessName?: string | null;
    defaultPaymentInstructions?: string | null;
    defaultBranchPickupInfo?: string | null;
  }) =>
    request<InauzwaPreferencesDto>('/products/sync/inauzwa/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  loginInauzwa: (payload: { email: string; password: string; apiUrl?: string }) =>
    request<{
      email: string;
      fullName: string | null;
      branchId: string | null;
      vendorId: string | null;
      preferences: InauzwaPreferencesDto;
    }>('/products/sync/inauzwa/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  completeInauzwaSupabaseSession: (payload: {
    accessToken: string;
    email: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    apiUrl?: string;
    branchId?: string | null;
    vendorId?: string | null;
    fullName?: string | null;
  }) =>
    request<{
      email: string;
      fullName: string | null;
      branchId: string | null;
      vendorId: string | null;
      preferences: InauzwaPreferencesDto;
    }>('/products/sync/inauzwa/login/supabase-session', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateInauzwaConnection: (payload: {
    databaseUrl?: string | null;
    apiUrl?: string | null;
    apiToken?: string;
    currency?: string | null;
    clearConnection?: boolean;
    loginEmail?: string | null;
  }) =>
    request<InauzwaPreferencesDto>('/products/sync/inauzwa/connection', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  testInauzwaConnection: (payload: {
    mode?: 'database' | 'api';
    databaseUrl?: string;
    apiUrl?: string;
    apiToken?: string;
  }) =>
    request<{ ok: boolean; source: 'database' | 'api'; branchCount?: number }>(
      '/products/sync/inauzwa/test-connection',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
  quickSyncInauzwa: () =>
    request<{
      productsCreated: number;
      productsUpdated: number;
      variantsCreated: number;
      variantsUpdated: number;
      productsDeactivated: number;
      source: 'database' | 'api';
    }>('/products/sync/inauzwa/quick', { method: 'POST' }),
  syncInauzwa: (payload?: {
    branchId?: string;
    vendorId?: string;
    mode?: 'merge' | 'replace';
    activeOnly?: boolean;
  }) =>
    request<{
      productsCreated: number;
      productsUpdated: number;
      variantsCreated: number;
      variantsUpdated: number;
      productsDeactivated: number;
      source: 'database' | 'api';
    }>('/products/sync/inauzwa', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
};

export const contactApi = {
  checkNumber: (sessionId: string, number: string) =>
    request<{ number: string; exists: boolean; whatsappId: string | null }>(
      `/sessions/${sessionId}/contacts/check/${encodeURIComponent(number)}`,
    ),
  getContact: (sessionId: string, contactId: string) =>
    request<{
      id: string;
      name?: string;
      pushName?: string;
      number?: string;
      isMyContact?: boolean;
      isBlocked?: boolean;
    }>(`/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}`),
  getContactPresence: (sessionId: string, contactId: string) =>
    request<{
      chatId: string;
      state: 'online' | 'offline' | 'unknown';
      lastSeenAt?: string | null;
    }>(`/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}/presence`),
};

function sendInboxMediaFile(
  endpoint: 'send-image' | 'send-video' | 'send-document' | 'send-audio',
  sessionId: string,
  chatId: string,
  base64: string,
  mimetype: string,
  options?: { caption?: string; filename?: string; quotedMessageId?: string },
) {
  return request<MessageResponse>(`/inbox/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      chatId,
      base64,
      mimetype,
      caption: options?.caption,
      filename: options?.filename,
      quotedMessageId: options?.quotedMessageId,
    }),
  });
}

export const inboxApi = {
  getConversations: (params?: InboxConversationsQuery) => {
    const qs = new URLSearchParams();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === '') continue;
        qs.set(key, String(value));
      }
    }
    const query = qs.toString();
    return request<UnifiedInboxConversationsResponse>(
      `/inbox/conversations${query ? `?${query}` : ''}`,
    );
  },
  getQueueCounts: (params?: Pick<InboxConversationsQuery, 'sessionId'>) => {
    const qs = new URLSearchParams();
    if (params?.sessionId) qs.set('sessionId', params.sessionId);
    const query = qs.toString();
    return request<InboxQueueCountsResponse>(
      `/inbox/conversations/queue-counts${query ? `?${query}` : ''}`,
    );
  },
  searchThreads: (params: { q: string; sessionId?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    if (params.sessionId) qs.set('sessionId', params.sessionId);
    if (params.limit != null) qs.set('limit', String(params.limit));
    return request<InboxThreadSearchResponse>(`/inbox/threads/search?${qs.toString()}`);
  },
  searchMessages: (params: {
    q: string;
    sessionId?: string;
    chatId?: string;
    groupsOnly?: boolean;
    mediaOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    if (params.sessionId) qs.set('sessionId', params.sessionId);
    if (params.chatId) qs.set('chatId', params.chatId);
    if (params.groupsOnly) qs.set('groupsOnly', 'true');
    if (params.mediaOnly) qs.set('mediaOnly', 'true');
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.offset != null) qs.set('offset', String(params.offset));
    return request<InboxMessageSearchResponse>(`/inbox/messages/search?${qs.toString()}`);
  },
  sendText: (payload: {
    sessionId: string;
    chatId: string;
    text: string;
    quotedMessageId?: string;
  }) =>
    request<{ messageId: string; timestamp: number }>('/inbox/send-text', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  sendImageFile: (
    sessionId: string,
    chatId: string,
    base64: string,
    mimetype: string,
    options?: { caption?: string; filename?: string; quotedMessageId?: string },
  ) => sendInboxMediaFile('send-image', sessionId, chatId, base64, mimetype, options),
  sendVideoFile: (
    sessionId: string,
    chatId: string,
    base64: string,
    mimetype: string,
    options?: { caption?: string; filename?: string; quotedMessageId?: string },
  ) => sendInboxMediaFile('send-video', sessionId, chatId, base64, mimetype, options),
  sendDocumentFile: (
    sessionId: string,
    chatId: string,
    base64: string,
    mimetype: string,
    options?: { caption?: string; filename?: string; quotedMessageId?: string },
  ) => sendInboxMediaFile('send-document', sessionId, chatId, base64, mimetype, options),
  sendAudioFile: (
    sessionId: string,
    chatId: string,
    base64: string,
    mimetype: string,
    options?: { filename?: string; quotedMessageId?: string },
  ) => sendInboxMediaFile('send-audio', sessionId, chatId, base64, mimetype, options),
  sendMediaFile: sendInboxMediaFile,
  transferChat: (payload: {
    fromSessionId: string;
    toSessionId: string;
    chatId: string;
    reason: string;
    notifyCustomer?: boolean;
  }) =>
    request<{
      ok: boolean;
      fromSessionId: string;
      toSessionId: string;
      chatId: string;
      notifySent: boolean;
      notifyWarning?: string;
    }>('/inbox/conversations/transfer', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getContactProfilePicture: (sessionId: string, contactId: string) =>
    request<{ url: string | null }>(
      `/sessions/${sessionId}/contacts/${encodeURIComponent(contactId)}/profile-picture`,
    ).then(res => res.url ?? null),
  markConversationRead: (sessionId: string, chatId: string) =>
    request<{ ok: boolean }>('/inbox/conversations/read', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId, chatId }),
    }),
  getThreadCrm: (sessionId: string, chatId: string) =>
    request<InboxThreadCrm>(
      `/inbox/threads/crm?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  updateThreadCrm: (payload: UpdateInboxThreadCrmPayload) =>
    request<InboxThreadCrm>('/inbox/threads/crm', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  takeOverFromAi: (sessionId: string, chatId: string) =>
    request<InboxThreadCrm>('/inbox/threads/crm/ai-takeover', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId, chatId }),
    }),
  resumeAi: (sessionId: string, chatId: string) =>
    request<InboxThreadCrm>('/inbox/threads/crm/ai-resume', {
      method: 'PATCH',
      body: JSON.stringify({ sessionId, chatId }),
    }),
  retryMessage: (messageId: string) =>
    request<{ messageId: string; timestamp: number }>(`/inbox/messages/${encodeURIComponent(messageId)}/retry`, {
      method: 'POST',
    }),
  resendMessage: (messageId: string, text: string) =>
    request<{ messageId: string; timestamp: number }>(`/inbox/messages/${encodeURIComponent(messageId)}/resend`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  getAiDiagnosis: (sessionId: string, chatId: string) =>
    request<InboxAiDiagnosis>(
      `/inbox/ai-diagnosis?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  getComposeSuggestions: (sessionId: string, chatId: string) =>
    request<InboxComposeSuggestionsResult>(
      `/inbox/threads/compose-suggestions?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  getThreadEvents: (sessionId: string, chatId: string, limit = 50) =>
    request<InboxThreadEventRow[]>(
      `/inbox/threads/events?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}&limit=${limit}`,
    ),
  listPins: () =>
    request<Array<{ sessionId: string; chatId: string; label?: string | null; pinnedAt?: string }>>(
      '/inbox/pins',
    ),
  togglePin: (payload: { sessionId: string; chatId: string; label?: string | null }) =>
    request<{
      pinned: boolean;
      pins: Array<{ sessionId: string; chatId: string; label?: string | null }>;
    }>('/inbox/pins/toggle', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  replacePins: (pins: Array<{ sessionId: string; chatId: string; label?: string | null }>) =>
    request<Array<{ sessionId: string; chatId: string; label?: string | null }>>('/inbox/pins', {
      method: 'PUT',
      body: JSON.stringify({ pins }),
    }),
  listSavedViews: () => request<InboxSavedViewRow[]>('/inbox/saved-views'),
  createSavedView: (body: { name: string; config: InboxSavedViewConfig }) =>
    request<InboxSavedViewRow>('/inbox/saved-views', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSavedView: (id: string, body: { name?: string; config?: InboxSavedViewConfig }) =>
    request<InboxSavedViewRow>(`/inbox/saved-views/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteSavedView: (id: string) =>
    request<void>(`/inbox/saved-views/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

export type InboxSavedViewConfig = {
  filter: string;
  hideGroups?: boolean;
  leadSourceFilter?: string;
  conversationSort?: 'newest' | 'oldest';
  channelFilter?: string;
};

export interface InboxSavedViewRow {
  id: string;
  name: string;
  config: InboxSavedViewConfig;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface InboxAiDiagnosis {
  sessionId: string;
  chatId: string;
  canAiReply: boolean;
  summary: string;
  reasons: string[];
  suggestedFixes: string[];
  threadState: string;
  threadStateReason: string;
  aiStatus: string | null;
  checks: Array<{ id: string; ok: boolean; detail?: string; fixTarget?: string }>;
  lastError: string | null;
  groupChat: boolean;
  optedOut: boolean;
  aiPaused: boolean;
  sessionConnected: boolean;
}

export interface InboxThreadEventRow {
  id: string;
  sessionId: string;
  chatId: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  summary: string | null;
  createdAt: string;
}

export type InboxComposeSuggestionTone = 'warm' | 'descriptive';

export interface InboxComposeSuggestion {
  body: string;
  tone: InboxComposeSuggestionTone;
}

export interface InboxComposeSuggestionsResult {
  suggestions: InboxComposeSuggestion[];
  source: 'ai' | 'templates';
}

// =============================================================================
// Webhook API
// =============================================================================

export const webhookApi = {
  listBySession: (sessionId: string) => request<Webhook[]>(`/sessions/${sessionId}/webhooks`),
  listAll: () => request<Webhook[]>('/webhooks'),
  get: (sessionId: string, id: string) => request<Webhook>(`/sessions/${sessionId}/webhooks/${id}`),
  create: (sessionId: string, data: { url: string; events: string[] }) =>
    request<Webhook>(`/sessions/${sessionId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (sessionId: string, id: string, data: Partial<Webhook>) =>
    request<Webhook>(`/sessions/${sessionId}/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (sessionId: string, id: string) =>
    request<void>(`/sessions/${sessionId}/webhooks/${id}`, { method: 'DELETE' }),
  test: (sessionId: string, id: string) =>
    request<{ success: boolean; statusCode?: number; error?: string }>(`/sessions/${sessionId}/webhooks/${id}/test`, {
      method: 'POST',
    }),
};

// =============================================================================
// API Key API
// =============================================================================

export const authApi = {
  login: (email: string, password: string) =>
    request<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<AuthUser>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer';
  staffId: string | null;
  isActive: boolean;
  createdAt: string;
}

export const usersApi = {
  list: () => request<StaffUser[]>('/auth/users'),
  create: (data: { email: string; name: string; password: string; role: string }) =>
    request<StaffUser>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (
    id: string,
    data: Partial<{ name: string; role: string; isActive: boolean; password: string }>,
  ) =>
    request<StaffUser>(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deactivate: (id: string) => request<void>(`/auth/users/${id}`, { method: 'DELETE' }),
};

export const apiKeyApi = {
  list: () => request<ApiKey[]>('/auth/api-keys'),
  get: (id: string) => request<ApiKey>(`/auth/api-keys/${id}`),
  create: (data: {
    name: string;
    role: string;
    allowedIps?: string[];
    allowedSessions?: string[];
    expiresAt?: string;
  }) =>
    request<ApiKey>('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<ApiKey>) =>
    request<ApiKey>(`/auth/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/auth/api-keys/${id}`, { method: 'DELETE' }),
  revoke: (id: string) => request<ApiKey>(`/auth/api-keys/${id}/revoke`, { method: 'POST' }),
};

// =============================================================================
// Audit/Logs API
// =============================================================================

export const auditApi = {
  list: (params?: {
    action?: string;
    severity?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.severity) query.set('severity', params.severity);
    if (params?.q) query.set('q', params.q);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const queryStr = query.toString();
    return request<{ data: AuditLog[]; total: number }>(`/audit${queryStr ? `?${queryStr}` : ''}`);
  },
  cleanupQrPollNoise: () =>
    request<{ deleted: number }>('/audit/cleanup-qr-poll-noise', { method: 'POST' }),
};

// =============================================================================
// Message API
// =============================================================================

export const messageApi = {
  list: (sessionId: string, params?: { chatId?: string; limit?: number; offset?: number }) => {
    const query = new URLSearchParams();
    if (params?.chatId) query.set('chatId', params.chatId);
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<{ messages: InboxMessage[]; total: number }>(
      `/sessions/${sessionId}/messages${qs ? `?${qs}` : ''}`,
    );
  },
  sendText: (sessionId: string, chatId: string, text: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-text`, {
      method: 'POST',
      body: JSON.stringify({ chatId, text }),
    }),
  reply: (sessionId: string, chatId: string, quotedMessageId: string, text: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/reply`, {
      method: 'POST',
      body: JSON.stringify({ chatId, quotedMessageId, text }),
    }),
  sendImage: (sessionId: string, chatId: string, url: string, caption?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption }),
    }),
  sendImageFile: (
    sessionId: string,
    chatId: string,
    base64: string,
    mimetype: string,
    options?: { caption?: string; filename?: string },
  ) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-image`, {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        base64,
        mimetype,
        caption: options?.caption,
        filename: options?.filename,
      }),
    }),
  sendVideo: (sessionId: string, chatId: string, url: string, caption?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-video`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, caption }),
    }),
  sendAudio: (sessionId: string, chatId: string, url: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-audio`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url }),
    }),
  sendDocument: (sessionId: string, chatId: string, url: string, filename?: string) =>
    request<MessageResponse>(`/sessions/${sessionId}/messages/send-document`, {
      method: 'POST',
      body: JSON.stringify({ chatId, url, filename }),
    }),
};

// =============================================================================
// Health & Infrastructure API
// =============================================================================

export const healthApi = {
  check: () => request<HealthStatus>('/health'),
  ready: () => request<HealthStatus>('/health/ready'),
};

export const appStatusApi = {
  get: () => request<import('../types/appStatusTypes').AppStatusResponse>('/app/status'),
};

export const infraApi = {
  getStatus: () => request<InfraStatus>('/infra/status'),
  updateConfig: (config: Partial<InfraStatus>) =>
    request<InfraStatus>('/infra/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  saveConfig: (config: SaveConfigPayload) =>
    request<{ message: string; saved: boolean; envPath: string; profiles: string[] }>('/infra/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    }),
  restart: (profiles?: string[], profilesToRemove?: string[]) =>
    request<{
      message: string;
      restarting: boolean;
      profiles: string[];
      profilesToRemove: string[];
      estimatedTime: number;
    }>('/infra/restart', {
      method: 'POST',
      body: JSON.stringify({ profiles: profiles || [], profilesToRemove: profilesToRemove || [] }),
    }),
  healthCheck: () => request<{ status: string; timestamp: string }>('/infra/health'),
  getStorageFileCount: () =>
    request<{ storageType: string; count: number; sizeBytes: number; sizeMB: string }>(
      '/infra/storage/files/count',
    ),
  exportStorage: () =>
    request<{ message: string; download: string }>('/infra/storage/export', { method: 'GET' }),
  importStorageUpload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${API_BASE_URL}/infra/storage/import-upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: form,
    }).then(async res => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(error.message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{
        imported: boolean;
        count: number;
        storageType: string;
        fileName: string;
      }>;
    });
  },
  exportData: () => request<{ exportedAt: string; counts: Record<string, number> }>('/infra/export-data'),
};

// =============================================================================
// Settings API
// =============================================================================

export const settingsApi = {
  get: () => request<Settings>('/settings'),
  update: (settings: Partial<Settings>) =>
    request<Settings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// =============================================================================
// Follow-up API
// =============================================================================

export type ConversationStage =
  | 'new_lead' | 'contacted' | 'replied' | 'needs_identified' | 'product_suggested'
  | 'price_sent' | 'negotiating' | 'waiting_customer_reply' | 'followup_needed'
  | 'payment_pending' | 'won' | 'lost' | 'dead_no_response';

export type ConversationSource =
  | 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'website'
  | 'phone_call' | 'walk_in' | 'referral' | 'repeat_customer' | 'google' | 'other';

export type ConversationPriority = 'low' | 'normal' | 'high' | 'hot';

export type PipelineBucket =
  | 'new_leads' | 'waiting_reply' | 'followup_needed' | 'payment_pending'
  | 'hot_leads' | 'lost_leads' | 'won_leads';

export type FollowUpQueueFilter =
  | 'due_now' | 'due_today' | 'overdue' | 'hot_leads'
  | 'payment_pending' | 'stock_reminders' | 'waiting_customer_reply'
  | 'ai_suggested' | 'needs_approval' | 'scheduled' | 'auto_sent' | 'failed' | 'stopped' | 'converted';

export type FollowUpAutopilotMode = 'off' | 'suggest_only' | 'auto_send_safe' | 'full_autopilot';

export interface FollowupAutopilotSettings {
  id: string;
  enabled: boolean;
  autopilotMode: FollowUpAutopilotMode;
  businessHoursOnly: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  maxFollowupsPerCustomerPerDay: number;
  maxFollowupsPerLead: number;
  requireApprovalForMediumRisk: boolean;
  requireApprovalForHighRisk: boolean;
  allowSmsFallback: boolean;
  allowWhatsAppSmsBoth: boolean;
  allowGroupAutopilot: boolean;
  pauseOnHighFailureRate: boolean;
  pauseOnCustomerComplaint: boolean;
  staffTakeoverPauseMinutes: number;
}

export interface FollowupAutopilotDashboard {
  autoSentToday: number;
  needsApproval: number;
  failed: number;
  pausedAccounts: string[];
  enabled: boolean;
  mode: FollowUpAutopilotMode;
}

export interface FollowupAutopilotReport {
  suggestionsCreated: number;
  autoSent: number;
  needsApproval: number;
  stopped: number;
  failed: number;
  repliesReceived: number;
  convertedSales: number;
  smsFallbackUsed: number;
  whatsappFailed: number;
  bestTemplates: { templateId: string; count: number }[];
  worstTemplates: { templateId: string; failedCount: number }[];
  filters: Record<string, string | undefined>;
}

export interface FollowupAutopilotAuditEntry {
  id: string;
  followupId: string | null;
  conversationId: string | null;
  sessionId: string | null;
  riskLevel: string | null;
  channelUsed: string | null;
  messageSent: string | null;
  decisionReason: string | null;
  approvedBy: string | null;
  sentBy: string | null;
  resultStatus: string | null;
  createdAt: string;
}

export interface FollowupConversation {
  id: string;
  sessionId: string;
  chatId: string;
  customerId?: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerHandle?: string | null;
  source: string;
  channel?: string | null;
  assignedStaffId: string | null;
  branchId: string | null;
  stage: ConversationStage;
  productInterest: string | null;
  productId: string | null;
  budget: number | null;
  priority?: ConversationPriority;
  firstMessageAt?: string | null;
  firstResponseAt?: string | null;
  responseTimeSeconds?: number | null;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  lastFollowupAt: string | null;
  nextFollowupAt: string | null;
  linkedSaleId: string | null;
  outcome: string | null;
  lostReason: string | null;
  internalNote: string | null;
  followupRequired?: boolean;
  followupCompleted?: boolean;
  isManual?: boolean;
  nextAction?: string | null;
}

export interface PipelineCard {
  id: string;
  sessionId: string;
  chatId: string;
  customerName: string | null;
  customerPhone: string | null;
  customerHandle: string | null;
  source: string;
  channel: string | null;
  stage: string;
  productInterest: string | null;
  priority: string;
  budget?: number | null;
  closedAt?: string | null;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  nextFollowupAt: string | null;
  nextAction: string | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  isManual: boolean;
  linkedSaleId: string | null;
  responseTimeSeconds: number | null;
  customerId?: string | null;
  inauzwaCustomerId?: string | null;
  crmResolved?: boolean;
  crmInternalNote?: string | null;
  crmFollowUpAt?: string | null;
  linkedThreadCount?: number;
}

export interface CustomerProfile {
  profileKey: string;
  displayName: string | null;
  displayPhone: string | null;
  inauzwaCustomerId: string | null;
  linkedThreadCount: number;
  primaryConversationId: string;
  conversations: PipelineCard[];
  stats: {
    openLeads: number;
    wonLeads: number;
    lostLeads: number;
    latestActivityAt: string | null;
  };
}

export interface PipelineDashboardStats {
  totalLeadsToday: number;
  leadsBySource: Record<string, number>;
  leadsByStaff: Record<string, number>;
  leadsByStage: Record<string, number>;
  wonLeads: number;
  lostLeads: number;
  lostReasonBreakdown: Record<string, number>;
  conversionRate: number;
  averageResponseTimeSeconds: number;
  overdueFollowups: number;
  paymentPending: number;
  hotLeadsIgnored: number;
  salesLinked: number;
}

export interface FollowupQueueItemView {
  id: string;
  conversationId: string;
  sessionId: string;
  chatId: string;
  customerName: string | null;
  customerPhone: string | null;
  source: string;
  productInterest: string | null;
  stage: string;
  dueAt: string;
  status: string;
  templatePreview: string | null;
  recommendedAction: string | null;
  attemptNumber: number;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  branchId: string | null;
  warningAt: string | null;
  escalatedAt: string | null;
  kpiPenaltyFlag: boolean;
  within24hWindow: boolean;
  priority?: ConversationPriority;
  lastCustomerMessageAt?: string | null;
  isAutopilot?: boolean;
  detectedReason?: string | null;
  customerMood?: string | null;
  riskLevel?: string | null;
  confidenceScore?: number | null;
  suggestedChannel?: string | null;
  suggestedMessage?: string | null;
  originalCustomerMessage?: string | null;
  lastStaffMessage?: string | null;
  stopReason?: string | null;
  channelUsed?: string | null;
  templateName?: string | null;
}

export interface FollowupTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  smsBody?: string | null;
  channel: string;
  language: string;
  requiresWhatsappApproval: boolean;
  whatsappTemplateName: string | null;
  whatsappTemplateStatus: string;
  branchId: string | null;
  isActive: boolean;
}

export interface FollowupRule {
  id: string;
  name: string;
  triggerEvent: string;
  stage: string | null;
  condition: string | null;
  delayMinutes: number;
  templateId: string | null;
  mode: 'create_task' | 'auto_send';
  maxAttempts: number;
  stopIfCustomerReplied: boolean;
  stopIfSaleLinked: boolean;
  active: boolean;
  branchId: string | null;
}

export interface FollowupAttempt {
  id: string;
  followupId: string;
  conversationId: string;
  staffId: string | null;
  sentAt: string | null;
  mode: string;
  templateId: string | null;
  messageBody: string | null;
  deliveryStatus: string | null;
  customerReplied: boolean;
  outcome: string | null;
  createdAt: string;
}

export interface FollowupKpiReport {
  staffId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  followupsDue: number;
  followupsCompletedOnTime: number;
  followupsCompletedLate: number;
  followupsMissed: number;
  overdueFollowups: number;
  conversionsAfterFollowup: number;
  lostLeadsWithoutFollowup: number;
  averageResponseTimeMs: number;
}

export const followupApi = {
  getPermissions: () => request<{ permissions: string[] }>('/followup/permissions'),
  listStaff: async () =>
    asArray<{ id: string; name: string; role: string }>(
      await request<Array<{ id: string; name: string; role: string }>>('/followup/staff'),
    ),
  getConversation: async (sessionId: string, chatId: string) =>
    assertFollowupConversation(
      await request<FollowupConversation>(
        `/followup/conversations/${sessionId}/${encodeURIComponent(chatId)}`,
      ),
    ),
  getConversationById: async (id: string) =>
    assertFollowupConversation(
      await request<FollowupConversation>(`/followup/conversations/id/${id}`),
    ),
  updateConversation: (id: string, data: Partial<FollowupConversation>) =>
    request<FollowupConversation>(`/followup/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  setStage: (id: string, stage: ConversationStage, sessionId: string, chatId: string) =>
    request<FollowupConversation>(`/followup/conversations/${id}/stage`, {
      method: 'POST',
      body: JSON.stringify({ stage, sessionId, chatId }),
    }),
  closeLost: (
    id: string,
    data: {
      lostReason: string;
      lostNotes: string;
      alternativeOffered: boolean;
      customerRefusedFollowup?: boolean;
    },
  ) =>
    request<FollowupConversation>(`/followup/conversations/${id}/close-lost`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  linkSale: (
    id: string,
    data: {
      saleId: string;
      leadSource?: string;
      assignedStaffId?: string;
      customerId?: string;
      quoteId?: string;
      amount?: number;
      grossProfit?: number;
    },
  ) =>
    request<FollowupConversation>(`/followup/conversations/${id}/link-sale`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  setLeadSource: (id: string, source: ConversationSource) =>
    request<FollowupConversation>(`/followup/conversations/${id}/source`, {
      method: 'PATCH',
      body: JSON.stringify({ source }),
    }),
  backfillSaleAttributions: (dryRun = false) =>
    request<{ created: number; skipped: number; dryRun: boolean }>(
      `/followup/admin/backfill-sale-attributions${dryRun ? '?dryRun=true' : ''}`,
      { method: 'POST' },
    ),
  backfillIdentity: (dryRun = false) =>
    request<{ scanned: number; phonesFilled: number; namesFilled: number }>(
      `/followup/admin/backfill-identity${dryRun ? '?dryRun=true' : ''}`,
      { method: 'POST' },
    ),
  createManualLead: (data: {
    customerName: string;
    source: ConversationSource;
    customerPhone?: string;
    customerHandle?: string;
    customerId?: string;
    channel?: string;
    branchId?: string;
    assignedStaffId?: string;
    priority?: ConversationPriority;
    productInterest?: string;
    budget?: number;
    notes?: string;
  }) =>
    request<FollowupConversation>('/followup/conversations/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  assignConversation: (id: string, staffId?: string | null) =>
    request<FollowupConversation>(`/followup/conversations/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ staffId: staffId ?? null }),
    }),
  getPipelineCounts: (branchId?: string, staffId?: string, source?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (staffId) params.set('staffId', staffId);
    if (source) params.set('source', source);
    const q = params.toString() ? `?${params}` : '';
    return request<Record<PipelineBucket, number>>(`/followup/pipeline/counts${q}`);
  },
  getPipeline: async (bucket: PipelineBucket, branchId?: string, staffId?: string, source?: string) => {
    const params = new URLSearchParams({ bucket });
    if (branchId) params.set('branchId', branchId);
    if (staffId) params.set('staffId', staffId);
    if (source) params.set('source', source);
    return asArray<PipelineCard>(await request<PipelineCard[]>(`/followup/pipeline?${params}`));
  },
  getPipelineDashboard: (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : '';
    return request<PipelineDashboardStats>(`/followup/pipeline/dashboard${q}`);
  },
  getConversionReport: (branchId?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return request<{ bySource: Record<string, { total: number; won: number; lost: number }>; byStaff: Record<string, { total: number; won: number; lost: number }>; total: number }>(
      `/followup/pipeline/reports/conversion${q}`,
    );
  },
  getLeadSourceReport: (branchId?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const q = params.toString() ? `?${params}` : '';
    return request<{
      leadsBySource: Record<string, number>;
      salesBySource: Record<string, number>;
      revenueBySource: Record<string, number>;
      grossProfitBySource: Record<string, number>;
      conversionBySource: Record<string, { total: number; won: number; lost: number; rate: number }>;
      leadsByStaffAndSource: Record<string, Record<string, number>>;
      lostLeadsBySource: Record<string, number>;
      totalLeads: number;
      totalSales: number;
      totalRevenue: number;
      totalGrossProfit: number;
    }>(`/followup/pipeline/reports/lead-sources${q}`);
  },
  getAbandonedLeads: async (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : '';
    return asArray<PipelineCard>(
      await request<PipelineCard[]>(`/followup/pipeline/reports/abandoned${q}`),
    );
  },
  getPaymentPendingLeads: async (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : '';
    return asArray<PipelineCard>(
      await request<PipelineCard[]>(`/followup/pipeline/reports/payment-pending${q}`),
    );
  },
  getLostReasonReport: (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : '';
    return request<Record<string, number>>(`/followup/pipeline/reports/lost-reasons${q}`);
  },
  markWon: (id: string, linkedSaleId?: string) =>
    request<FollowupConversation>(`/followup/conversations/${id}/won`, {
      method: 'POST',
      body: JSON.stringify({ linkedSaleId }),
    }),
  getHistory: async (conversationId: string) =>
    asArray<FollowupAttempt>(
      await request<FollowupAttempt[]>(`/followup/conversations/id/${conversationId}/history`),
    ),
  getQueue: async (filter: FollowUpQueueFilter = 'due_now', branchId?: string, staffId?: string) => {
    const params = new URLSearchParams({ filter });
    if (branchId) params.set('branchId', branchId);
    if (staffId) params.set('staffId', staffId);
    return asArray<FollowupQueueItemView>(await request<FollowupQueueItemView[]>(`/followup/queue?${params}`));
  },
  getQueueCounts: (branchId?: string, staffId?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (staffId) params.set('staffId', staffId);
    const q = params.toString() ? `?${params}` : '';
    return request<Record<FollowUpQueueFilter, number>>(`/followup/queue/counts${q}`);
  },
  searchPipeline: async (q: string, branchId?: string, staffId?: string, source?: string) => {
    const params = new URLSearchParams({ q });
    if (branchId) params.set('branchId', branchId);
    if (staffId) params.set('staffId', staffId);
    if (source) params.set('source', source);
    return asArray<PipelineCard>(await request<PipelineCard[]>(`/followup/pipeline/search?${params}`));
  },
  listCustomers: (params?: {
    q?: string;
    stage?: string;
    branchId?: string;
    staffId?: string;
    source?: string;
    unidentifiedOnly?: boolean;
    resolvedOnly?: boolean;
    followUpDueOnly?: boolean;
    multiThreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.stage) query.set('stage', params.stage);
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.staffId) query.set('staffId', params.staffId);
    if (params?.source) query.set('source', params.source);
    if (params?.unidentifiedOnly) query.set('unidentifiedOnly', 'true');
    if (params?.resolvedOnly) query.set('resolvedOnly', 'true');
    if (params?.followUpDueOnly) query.set('followUpDueOnly', 'true');
    if (params?.multiThreadOnly) query.set('multiThreadOnly', 'true');
    if (params?.limit != null) query.set('limit', String(params.limit));
    if (params?.offset != null) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<{
      data: PipelineCard[];
      total: number;
      stats: { total: number; unidentified: number; activeThisWeek: number };
    }>(`/followup/customers${qs ? `?${qs}` : ''}`);
  },
  listCustomerRelated: async (conversationId: string) =>
    asArray<PipelineCard>(
      await request<PipelineCard[]>(`/followup/customers/${conversationId}/related`),
    ),
  getCustomerProfile: (conversationId: string) =>
    request<CustomerProfile>(`/followup/customers/${conversationId}/profile`),
  sendFollowup: (
    id: string,
    options?: { variables?: Record<string, string>; channel?: 'whatsapp' | 'sms' | 'both' },
  ) =>
    request<{ messageBody: string; sent: boolean; channels?: string[] }>(`/followup/queue/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({
        variables: options?.variables,
        channel: options?.channel,
      }),
    }),
  completeFollowup: (id: string, data: { outcome: string; messageBody?: string; sent?: boolean }) =>
    request(`/followup/queue/${id}/complete`, { method: 'POST', body: JSON.stringify(data) }),
  rescheduleFollowup: (id: string, data: { dueAt: string; notes?: string }) =>
    request(`/followup/queue/${id}/reschedule`, { method: 'POST', body: JSON.stringify(data) }),
  assignFollowup: (id: string, staffId: string) =>
    request(`/followup/queue/${id}/assign`, { method: 'POST', body: JSON.stringify({ staffId }) }),
  listTemplates: (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : '';
    return request<FollowupTemplate[]>(`/followup/templates${q}`);
  },
  createTemplate: (data: Partial<FollowupTemplate>) =>
    request<FollowupTemplate>('/followup/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id: string, data: Partial<FollowupTemplate>) =>
    request<FollowupTemplate>(`/followup/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteTemplate: (id: string) => request(`/followup/templates/${id}`, { method: 'DELETE' }),
  previewTemplate: (id: string, variables: Record<string, string>) =>
    request<{ body: string }>(`/followup/templates/${id}/preview`, {
      method: 'POST',
      body: JSON.stringify(variables),
    }),
  listRules: (branchId?: string) => {
    const q = branchId ? `?branchId=${branchId}` : '';
    return request<FollowupRule[]>(`/followup/rules${q}`);
  },
  createRule: (data: Partial<FollowupRule>) =>
    request<FollowupRule>('/followup/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateRule: (id: string, data: Partial<FollowupRule>) =>
    request<FollowupRule>(`/followup/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRule: (id: string) => request(`/followup/rules/${id}`, { method: 'DELETE' }),
  getReports: (branchId?: string, periodStart?: string) => {
    const params = new URLSearchParams();
    if (branchId) params.set('branchId', branchId);
    if (periodStart) params.set('periodStart', periodStart);
    const q = params.toString() ? `?${params}` : '';
    return request<FollowupKpiReport[]>(`/followup/reports${q}`);
  },
  getAutopilotSettings: () => request<FollowupAutopilotSettings>('/followup/autopilot/settings'),
  updateAutopilotSettings: (data: Partial<FollowupAutopilotSettings>) =>
    request<FollowupAutopilotSettings>('/followup/autopilot/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  getAutopilotDashboard: () => request<FollowupAutopilotDashboard>('/followup/autopilot/dashboard'),
  approveAutopilot: (id: string, message?: string) =>
    request<{ messageBody: string; channels: string[] }>(`/followup/queue/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  rejectAutopilot: (id: string, reason?: string) =>
    request(`/followup/queue/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  scheduleAutopilot: (id: string, dueAt: string) =>
    request(`/followup/queue/${id}/schedule-autopilot`, {
      method: 'POST',
      body: JSON.stringify({ dueAt }),
    }),
  pauseAutopilot: (sessionId: string, chatId: string, minutes?: number) => {
    const q = minutes != null ? `?minutes=${minutes}` : '';
    return request(`/followup/conversations/${sessionId}/${encodeURIComponent(chatId)}/autopilot/pause${q}`, {
      method: 'POST',
    });
  },
  resumeAutopilot: (sessionId: string, chatId: string) =>
    request(`/followup/conversations/${sessionId}/${encodeURIComponent(chatId)}/autopilot/resume`, {
      method: 'POST',
    }),
  unpauseAutopilotSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/followup/autopilot/sessions/${sessionId}/unpause`, {
      method: 'POST',
    }),
  getAutopilotAudit: (params?: { limit?: number; sessionId?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.sessionId) q.set('sessionId', params.sessionId);
    const qs = q.toString();
    return request<FollowupAutopilotAuditEntry[]>(`/followup/autopilot/audit${qs ? `?${qs}` : ''}`);
  },
  getAutopilotReport: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params ?? '').toString();
    return request<FollowupAutopilotReport>(`/followup/reports/autopilot${q ? `?${q}` : ''}`);
  },
};

// =============================================================================
// Quick Reply Templates (inbox staff speed — NOT WhatsApp-approved templates)
// =============================================================================

export type QuickReplyCategory =
  | 'greeting'
  | 'ask_budget'
  | 'ask_usage'
  | 'send_price'
  | 'product_available'
  | 'out_of_stock'
  | 'suggest_alternative'
  | 'payment_instructions'
  | 'delivery_info'
  | 'warranty'
  | 'repair_status'
  | 'follow_up'
  | 'closing_sale'
  | 'thank_you';

export interface QuickReplyTemplate {
  id: string;
  branchId: string | null;
  name: string;
  category: QuickReplyCategory;
  body: string;
  language: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type QuickReplyVariables = {
  customer_name?: string;
  product_name?: string;
  price?: string;
  staff_name?: string;
  branch_name?: string;
  payment_number?: string;
  pickup_location?: string;
  warranty?: string;
  delivery_fee?: string;
};

export const QUICK_REPLY_CATEGORIES: QuickReplyCategory[] = [
  'greeting',
  'ask_budget',
  'ask_usage',
  'send_price',
  'product_available',
  'out_of_stock',
  'suggest_alternative',
  'payment_instructions',
  'delivery_info',
  'warranty',
  'repair_status',
  'follow_up',
  'closing_sale',
  'thank_you',
];

export const quickReplyApi = {
  getPermissions: () => request<{ permissions: string[] }>('/quick-reply/permissions'),
  listTemplates: (opts?: {
    branchId?: string;
    category?: QuickReplyCategory;
    search?: string;
    manage?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (opts?.branchId) params.set('branchId', opts.branchId);
    if (opts?.category) params.set('category', opts.category);
    if (opts?.search) params.set('search', opts.search);
    if (opts?.manage) params.set('manage', 'true');
    const q = params.toString() ? `?${params}` : '';
    return request<QuickReplyTemplate[]>(`/quick-reply/templates${q}`);
  },
  createTemplate: (data: Partial<QuickReplyTemplate>) =>
    request<QuickReplyTemplate>('/quick-reply/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTemplate: (id: string, data: Partial<QuickReplyTemplate>) =>
    request<QuickReplyTemplate>(`/quick-reply/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteTemplate: (id: string) => request(`/quick-reply/templates/${id}`, { method: 'DELETE' }),
  previewTemplate: (id: string, variables: QuickReplyVariables) =>
    request<{ body: string }>(`/quick-reply/templates/${id}/preview`, {
      method: 'POST',
      body: JSON.stringify(variables),
    }),
};

// =============================================================================
// Plugin Types
// =============================================================================

export interface PluginConfigPropertySchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  secret?: boolean;
}

export interface PluginConfigSchema {
  type: 'object';
  properties: Record<string, PluginConfigPropertySchema>;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  type: 'engine' | 'storage' | 'queue' | 'auth' | 'extension';
  description?: string;
  author?: string;
  status: 'installed' | 'enabled' | 'disabled' | 'error';
  config: Record<string, unknown>;
  builtIn: boolean;
  provides: string[];
  configSchema?: PluginConfigSchema;
  loadedAt?: string;
  enabledAt?: string;
  error?: string;
}

export interface Engine {
  id: string;
  name: string;
  enabled: boolean;
  features: string[];
}

// =============================================================================
// Quotes (WhatsApp chat quotations)
// =============================================================================

export type QuoteStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted_to_sale';

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId: string | null;
  variantId: string | null;
  itemName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  warranty: string | null;
  stockStatus: string | null;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  sessionId: string;
  chatId: string;
  conversationId: string | null;
  assignedStaffId: string | null;
  leadSource: string | null;
  status: QuoteStatus;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  currency: string | null;
  notes: string | null;
  paymentInstructions: string | null;
  branchPickupInfo: string | null;
  validUntil: string | null;
  linkedSaleId: string | null;
  externalProformaId: string | null;
  createdBy: string | null;
  items: QuoteItem[];
  createdAt: string;
  updatedAt: string;
}

export const quoteApi = {
  getPermissions: () => request<{ permissions: string[] }>('/quotes/permissions'),
  list: (params?: { sessionId?: string; chatId?: string; branchId?: string; status?: QuoteStatus }) => {
    const query = new URLSearchParams();
    if (params?.sessionId) query.set('sessionId', params.sessionId);
    if (params?.chatId) query.set('chatId', params.chatId);
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return request<Quote[]>(`/quotes${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => request<Quote>(`/quotes/${id}`),
  previewMessage: (id: string) => request<{ body: string }>(`/quotes/${id}/preview-message`),
  createFromChat: (data: {
    sessionId: string;
    chatId: string;
    branchId?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    customerPhone?: string | null;
    conversationId?: string | null;
    notes?: string | null;
    validUntil?: string | null;
  }) =>
    request<Quote>('/quotes/chat', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: Partial<{
      customerName: string | null;
      customerPhone: string | null;
      customerId: string | null;
      notes: string | null;
      paymentInstructions: string | null;
      branchPickupInfo: string | null;
      validUntil: string | null;
      discountAmount: number;
      deliveryFee: number;
      taxAmount: number;
      items: Array<{
        productId?: string | null;
        variantId?: string | null;
        itemName: string;
        description?: string | null;
        quantity: number;
        unitPrice: number;
        discountAmount?: number;
        warranty?: string | null;
        metadata?: Record<string, unknown> | null;
      }>;
    }>,
  ) =>
    request<Quote>(`/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  addItem: (
    id: string,
    item: {
      productId?: string | null;
      variantId?: string | null;
      itemName: string;
      description?: string | null;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      warranty?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ) =>
    request<Quote>(`/quotes/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),
  removeItem: (id: string, itemId: string) =>
    request<Quote>(`/quotes/${id}/items/${itemId}`, { method: 'DELETE' }),
  setDeliveryFee: (id: string, deliveryFee: number) =>
    request<Quote>(`/quotes/${id}/delivery-fee`, {
      method: 'PATCH',
      body: JSON.stringify({ deliveryFee }),
    }),
  send: (id: string, data?: { messageBody?: string }) =>
    request<Quote>(`/quotes/${id}/send`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  notifyBySms: (id: string) =>
    request<{ id: string; success: boolean; smsCount: number; segmentWarning: string | null; status: string }>(
      `/quotes/${id}/notify-sms`,
      { method: 'POST' },
    ),
  accept: (id: string) => request<Quote>(`/quotes/${id}/accept`, { method: 'POST' }),
  reject: (id: string) => request<Quote>(`/quotes/${id}/reject`, { method: 'POST' }),
  convert: (id: string, data?: { linkedSaleId?: string; paymentPending?: boolean }) =>
    request<Quote>(`/quotes/${id}/convert`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
  searchInauzwaCustomers: (q: string) =>
    request<Array<{ id: string; name: string; phone: string | null }>>(
      `/quotes/inauzwa/customers/search?q=${encodeURIComponent(q)}`,
    ),
  listInauzwaProformas: (customerId: string) =>
    request<
      Array<{
        id: string;
        proformaNumber: string;
        status: string;
        total: number;
        validUntil: string | null;
        customerName: string | null;
      }>
    >(`/quotes/inauzwa/customers/${encodeURIComponent(customerId)}/proformas`),
  listInauzwaSales: (customerId: string) =>
    request<
      Array<{
        id: string;
        saleNumber: string | null;
        total: number;
        createdAt: string;
        paymentStatus: string | null;
      }>
    >(`/quotes/inauzwa/customers/${encodeURIComponent(customerId)}/sales`),
};

// =============================================================================
// SMS API (outgoing only — MobiShastra)
// =============================================================================

export type SmsChannelStatus =
  | 'not_connected'
  | 'testing'
  | 'connected'
  | 'low_balance'
  | 'failed'
  | 'disabled';

export interface SmsStatusView {
  connected: boolean;
  status: SmsChannelStatus;
  isEnabled: boolean;
  configured: boolean;
  lowBalance: boolean;
  lastBalance: number | null;
  lastError: string | null;
}

export interface SmsSettingsView {
  provider: string;
  isEnabled: boolean;
  status: SmsChannelStatus;
  profileId: string | null;
  passwordMasked: boolean;
  senderId: string | null;
  countryCode: string;
  priority: string;
  lastBalance: number | null;
  lastTestAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
}

export interface SmsLogView {
  id: string;
  provider: string;
  toPhone: string;
  normalizedPhone: string;
  customerId: string | null;
  conversationId: string | null;
  relatedType: string | null;
  relatedId: string | null;
  message: string;
  messagePreview: string;
  smsCount: number;
  status: string;
  providerMessageId: string | null;
  providerResponse: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  sentBy: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface SmsSegmentPreview {
  smsCount: number;
  isUnicode: boolean;
  charCount: number;
  warning?: string;
}

export const smsApi = {
  getStatus: () => request<SmsStatusView>('/sms/status'),
  getSettings: () => request<SmsSettingsView>('/sms/settings'),
  saveSettings: (body: {
    profileId?: string;
    password?: string;
    senderId?: string;
    countryCode?: string;
    priority?: string;
    isEnabled?: boolean;
  }) =>
    request<SmsSettingsView>('/sms/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  test: (body: { toPhone: string; message?: string }) =>
    request<{ success: boolean; code: string; message: string; status: SmsChannelStatus }>(
      '/sms/test',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  checkBalance: () =>
    request<{
      balance: number | null;
      rawResponse: string;
      status: SmsChannelStatus;
      success: boolean;
      error: string | null;
    }>('/sms/balance'),
  send: (body: {
    toPhone: string;
    message: string;
    customerId?: string;
    conversationId?: string;
    relatedType?: string;
    relatedId?: string;
  }) =>
    request<{ id: string; success: boolean; smsCount: number; segmentWarning: string | null; status: string }>(
      '/sms/send',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  bulkSend: (body: {
    recipients: Array<{ phone: string; customerId?: string; customerName?: string }>;
    message: string;
  }) =>
    request<{
      success: boolean;
      recipientCount: number;
      smsCountPerRecipient: number;
      totalSmsCount: number;
      segmentWarning: string | null;
      logIds: string[];
    }>('/sms/bulk-send', { method: 'POST', body: JSON.stringify(body) }),
  getLogs: (params?: { status?: string; q?: string; period?: string; sentBy?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    if (params?.period) qs.set('period', params.period);
    if (params?.sentBy) qs.set('sentBy', params.sentBy);
    const query = qs.toString();
    return request<SmsLogView[]>(`/sms/logs${query ? `?${query}` : ''}`);
  },
  disable: () => request<SmsSettingsView>('/sms/disable', { method: 'POST' }),
  activate: () => request<SmsSettingsView>('/sms/activate', { method: 'POST' }),
  previewSegments: (message: string) =>
    request<SmsSegmentPreview>('/sms/preview-segments', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};

// =============================================================================
// AI API
// =============================================================================

export type AiProviderId =
  | 'GEMINI'
  | 'OPENAI'
  | 'ANTHROPIC'
  | 'GROQ'
  | 'DEEPSEEK'
  | 'XAI'
  | 'MISTRAL'
  | 'TOGETHER'
  | 'MOONSHOT'
  | 'GLM'
  | 'QWEN'
  | 'STEPFUN'
  | 'OLLAMA'
  | 'OPENROUTER'
  | 'CUSTOM';

export interface AiConfigView {
  provider: AiProviderId;
  model: string;
  baseUrl?: string | null;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  toolCallingEnabled: boolean;
  autoReplyEnabled?: boolean;
  autoReplyPrivateOnly?: boolean;
  autoReplyCooldownMinutes?: number;
  autoReplyContextMessages?: number;
  autoReplyPrompt?: string;
  autoReplyOutsideHoursOnly?: boolean;
  autoReplyTimezone?: string;
  autoReplyStartHour?: number;
  autoReplyEndHour?: number;
  autoReplyWeekdays?: number[];
  autoReplyTone?: string;
  autoReplyPreset?: string;
  autoReplyOptOutMessage?: string;
  disabledTools?: string[];
  knowledgeRagEnabled?: boolean;
  memoryRagEnabled?: boolean;
  progressiveProfilingEnabled?: boolean;
  profilingMaxQuestionsPerReply?: number;
  profilingAutoSaveHighConfidenceNames?: boolean;
  profilingRequireReviewMediumConfidence?: boolean;
  profilingDetectNameCorrections?: boolean;
  profilingSilentSaveFields?: boolean;
  profilingCreateLostDemandFollowups?: boolean;
  profilingAskNameImmediately?: boolean;
  profilingDisabledInGroups?: boolean;
  profilingHighConfidenceThreshold?: number;
  profilingMediumConfidenceThreshold?: number;
  profilingNameSaveReplyTemplate?: string | null;
  profilingNameCorrectionReply?: string | null;
  humanTimingEnabled?: boolean;
  activeChatWaitMinMs?: number;
  activeChatWaitMaxMs?: number;
  warmChatWaitMinMs?: number;
  warmChatWaitMaxMs?: number;
  coldChatWaitMinMs?: number;
  coldChatWaitMaxMs?: number;
  burstPauseMinMs?: number;
  burstPauseMaxMs?: number;
  maxBurstWaitMs?: number;
  typingMinMs?: number;
  typingMaxMs?: number;
  greetingRepeatCooldownMinutes?: number;
  presenceIntentEnabled?: boolean;
  suspiciousNameConfirmationEnabled?: boolean;
  autoReplyUseQuotedReply?: boolean;
  replyToBurstLatestMessage?: boolean;
  noTypingDuringDebounce?: boolean;
  humanReplyStyle?: string;
  aiUnrestrictedMode?: boolean;
  autoReplyModelTier?: string;
  inboxAssistantModelTier?: string;
  trainingModelTier?: string;
  adminAssistantModelTier?: string;
  allowPremiumModelForAutoReply?: boolean;
  aiDailyBudgetUsd?: number;
  aiMonthlyBudgetUsd?: number;
  autoReplyDailyBudgetUsd?: number;
  stopAutoReplyWhenBudgetExceeded?: boolean;
  notifyAdminWhenBudgetAtPercent?: number;
  allowAdminOverrideBudget?: boolean;
  aiBudgetPaused?: boolean;
  autoReplyPaused?: boolean;
  autoReplyContextMessagesMax?: number;
  autoReplyCooldownSeconds?: number;
  maxCustomerToolIterations?: number;
  maxAdminToolIterations?: number;
  maxAiCallsPerInboundMessage?: number;
  includeCrmWhenNeeded?: boolean;
  includeKnowledgeWhenNeeded?: boolean;
  includeCatalogWhenNeeded?: boolean;
  includeMemoryWhenNeeded?: boolean;
  ignoreDuplicateMessageIds?: boolean;
  ignorePromotionalMessages?: boolean;
  apiKeySet: boolean;
  testStatus?: string | null;
  testError?: string | null;
  updatedAt?: string;
}

export interface AiFallbackEntry {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKeySet: boolean;
  apiKeyHint?: string | null;
}

export interface AgentActionResult {
  actionId: string;
  status:
    | 'success'
    | 'failed'
    | 'confirmation_required'
    | 'permission_denied'
    | 'blocked'
    | 'link_only';
  message: string;
  risk: 'safe' | 'medium' | 'high' | 'blocked';
  confirmationId?: string;
  quickLinks?: Array<{ label: string; route: string; panelId?: string }>;
  data?: Record<string, unknown>;
}

export interface AiChatResult {
  content: string;
  actions: Array<{ tool: string; args: Record<string, unknown>; result: string }>;
  provider: string;
  model: string;
  latencyMs: number;
  agentAction?: AgentActionResult;
  skippedLlm?: boolean;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiChatMessageRow {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  toolCallsJson?: string | null;
  agentActionJson?: string | null;
  provider?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  createdAt: string;
}

export interface AiIndexStatusView {
  chunks: number;
  vectorSearch: boolean;
  database: string;
}

export interface AiSetupCheckItemView {
  id: string;
  ok: boolean;
  detail?: string | null;
}

export interface AiSetupStatusView {
  ready: boolean;
  completed: number;
  total: number;
  items: AiSetupCheckItemView[];
}

export interface AiStatusView {
  enabled: boolean;
  apiKeySet: boolean;
  autoReplyEnabled: boolean;
  toolCallingEnabled: boolean;
  testStatus: string | null;
  provider: string | null;
  model: string | null;
  memory: AiIndexStatusView;
  knowledge: AiIndexStatusView;
  setup?: AiSetupStatusView;
}

export interface AiAutoReplyHealthCheckView {
  id: string;
  ok: boolean;
  detail?: string | null;
  fixTarget?: 'ai' | 'automations' | 'whatsapp-safety' | 'channels' | 'ai-knowledge' | 'products' | null;
}

export interface AiAutoReplySessionHealthView {
  sessionId: string;
  name: string;
  status: string;
  aiAutoReplyEnabled: boolean;
  connected: boolean;
  automationPaused: boolean;
  circuitBreakerOpen: boolean;
}

export interface AiAutoReplyHealthView {
  masterEnabled: boolean;
  ready: boolean;
  checks: AiAutoReplyHealthCheckView[];
  sessions: AiAutoReplySessionHealthView[];
  stats: {
    aiReplies24h: number;
    openEscalations: number;
    knowledgeChunks: number;
    knowledgeFiles: number;
  };
}

export const aiApi = {
  getConfig: () => request<AiConfigView>('/settings/ai'),
  getStatus: () => request<AiStatusView>('/settings/ai/status'),
  getAutoReplyHealth: () => request<AiAutoReplyHealthView>('/settings/ai/auto-reply/health'),
  setAutoReplyMaster: (enabled: boolean) =>
    request<AiAutoReplyHealthView>('/settings/ai/auto-reply/master', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    }),
  applyUnrestrictedAutoReply: () =>
    request<AiAutoReplyHealthView & { resumedThreads: number }>(
      '/settings/ai/auto-reply/unrestricted/apply',
      { method: 'POST' },
    ),
  getAutoReplyPresets: () =>
    request<Array<{ id: string; label: string; tone: string; prompt: string }>>(
      '/settings/ai/auto-reply/presets',
    ),
  saveConfig: (body: Partial<AiConfigView> & { apiKey?: string }) =>
    request<AiConfigView>('/settings/ai', { method: 'PUT', body: JSON.stringify(body) }),
  test: () =>
    request<{ ok: boolean; error?: string; latencyMs?: number; reply?: string }>(
      '/settings/ai/test',
      { method: 'POST' },
    ),
  previewAutoReply: (sampleMessage?: string) =>
    request<{ ok: boolean; reply?: string; error?: string }>('/settings/ai/auto-reply/preview', {
      method: 'POST',
      body: JSON.stringify({ sampleMessage }),
    }),
  getModels: (provider: AiProviderId) =>
    request<string[]>(`/settings/ai/models?provider=${provider}`),
  getFallbacks: () => request<AiFallbackEntry[]>('/settings/ai/fallbacks'),
  addFallback: (body: { provider: string; model: string; apiKey?: string; baseUrl?: string }) =>
    request<void>('/settings/ai/fallbacks', { method: 'POST', body: JSON.stringify(body) }),
  removeFallback: (index: number) =>
    request<void>(`/settings/ai/fallbacks/${index}`, { method: 'DELETE' }),
  clearApiKey: () =>
    request<AiConfigView>('/settings/ai/api-key', { method: 'DELETE' }),
  listTools: () =>
    request<Array<{ name: string; description: string; parameters: Record<string, unknown> }>>(
      '/ai/tools',
    ),
  chat: (body: {
    messages: Array<{
      role: string;
      content: string;
      images?: Array<{ mimeType: string; data: string }>;
    }>;
    conversationId?: string;
    currentPage?: string;
    currentChatId?: string;
    currentCustomerId?: string;
    branchId?: string;
  }) => request<AiChatResult>('/ai/chat', { method: 'POST', body: JSON.stringify(body) }),
  listKnowledgeFiles: () =>
    request<{ files: Array<{ path: string; size: number; updatedAt: string }> }>('/ai/knowledge'),
  readKnowledgeFile: (path: string) =>
    request<{ path: string; content: string }>(`/ai/knowledge/read?path=${encodeURIComponent(path)}`),
  writeKnowledgeFile: (path: string, content: string) =>
    request<{ path: string; size: number }>('/ai/knowledge', {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }),
  searchKnowledge: (q: string, limit = 10) =>
    request<{ results: Array<{ path: string; snippet: string }> }>(
      `/ai/knowledge/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    ),
  getKnowledgeIndexStatus: () => request<{ chunks: number }>('/ai/knowledge/index-status'),
  reindexKnowledge: () =>
    request<{ files: number; chunks: number }>('/ai/knowledge/reindex', { method: 'POST' }),
  listMemoryFiles: () =>
    request<{ files: Array<{ path: string; size: number; updatedAt: string }> }>('/ai/memory'),
  readMemoryFile: (path: string, fromLine?: number, lineCount?: number) => {
    const params = new URLSearchParams({ path });
    if (fromLine != null) params.set('fromLine', String(fromLine));
    if (lineCount != null) params.set('lineCount', String(lineCount));
    return request<{ path: string; content: string }>(`/ai/memory/read?${params}`);
  },
  writeMemoryFile: (path: string, content: string) =>
    request<{ path: string; size: number }>('/ai/memory', {
      method: 'PUT',
      body: JSON.stringify({ path, content }),
    }),
  searchMemory: (q: string, limit = 8) =>
    request<{
      hits: Array<{ path: string; startLine: number; endLine: number; text: string; score: number }>;
    }>(`/ai/memory/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  runMemoryDream: () =>
    request<{ promoted: number; entries: string[] }>('/ai/memory/dream', { method: 'POST' }),
  getMemoryIndexStatus: () => request<{ chunks: number }>('/ai/memory/index-status'),
  reindexMemory: () =>
    request<{ files: number; chunks: number }>('/ai/memory/reindex', { method: 'POST' }),
  listConversations: () => request<AiConversation[]>('/ai/conversations'),
  createConversation: () =>
    request<AiConversation>('/ai/conversations', { method: 'POST' }),
  listMessages: (id: string) => request<AiChatMessageRow[]>(`/ai/conversations/${id}/messages`),
  deleteConversation: (id: string) =>
    request<void>(`/ai/conversations/${id}`, { method: 'DELETE' }),
  listBranchProfiles: () => request<BranchAiProfile[]>('/ai/profile/branches'),
  getBranchProfile: (branchId: string) =>
    request<{ profile: BranchAiProfile | null; paymentAccounts: BranchPaymentAccount[] }>(
      `/ai/profile/branches/${encodeURIComponent(branchId)}`,
    ),
  upsertBranchProfile: (branchId: string, data: Partial<BranchAiProfile>) =>
    request<BranchAiProfile>(`/ai/profile/branches/${encodeURIComponent(branchId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createPaymentAccount: (branchId: string, data: CreateBranchPaymentAccountInput) =>
    request<BranchPaymentAccount>(
      `/ai/profile/branches/${encodeURIComponent(branchId)}/payment-accounts`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  updatePaymentAccount: (id: string, data: Partial<CreateBranchPaymentAccountInput>) =>
    request<BranchPaymentAccount>(`/ai/profile/payment-accounts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deletePaymentAccount: (id: string) =>
    request<{ ok: boolean }>(`/ai/profile/payment-accounts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  seedPaymentFromEnv: (branchId: string) =>
    request<{ created: boolean; branchId: string }>(
      `/ai/profile/branches/${encodeURIComponent(branchId)}/seed-payment-from-env`,
      { method: 'POST' },
    ),
  backfillEscalationAssignees: () =>
    request<{ updated: number }>('/ai/signals/backfill-assignees', { method: 'POST' }),
  getAiDashboardSignals: (sinceHours = 48) =>
    request<AiDashboardSignals>(
      `/ai/signals/dashboard?sinceHours=${encodeURIComponent(String(sinceHours))}`,
    ),
  listGroupLeads: (sessionId: string, chatId: string) =>
    request<{
      leads: Array<{
        id: string;
        detectedIntent: string;
        incomingText: string;
        signalType: string | null;
        createdAt: string;
      }>;
      escalation: {
        id: string;
        status: string;
        detail: string | null;
        createdAt: string;
      } | null;
    }>(
      `/ai/signals/group-leads?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  searchEverywhere: (
    q: string,
    options?: {
      categories?: string;
      sessionId?: string;
      chatId?: string;
      groupsOnly?: boolean;
      limit?: number;
    },
  ) => {
    const params = new URLSearchParams({ q });
    if (options?.categories) params.set('categories', options.categories);
    if (options?.sessionId) params.set('sessionId', options.sessionId);
    if (options?.chatId) params.set('chatId', options.chatId);
    if (options?.groupsOnly) params.set('groupsOnly', '1');
    if (options?.limit != null) params.set('limit', String(options.limit));
    return request<AiSearchEverywhereResult>(`/ai/search/everywhere?${params.toString()}`);
  },
  listLearningImports: () => request<AiLearningImport[]>('/ai/learning/imports'),
  getLearningImport: (id: string) =>
    request<AiLearningImport>(`/ai/learning/imports/${encodeURIComponent(id)}`),
  importLearningFile: (
    sourceName: string,
    content: string,
    fileName: string,
    format: 'csv' | 'archive' = 'csv',
  ) =>
    request<AiLearningImport>('/ai/learning/import', {
      method: 'POST',
      body: JSON.stringify({
        sourceName,
        fileName,
        ...(format === 'archive' ? { archive: content } : { csv: content }),
      }),
    }),
  /** @deprecated use importLearningFile */
  importLearningCsv: (sourceName: string, csv: string) =>
    request<AiLearningImport>('/ai/learning/import', {
      method: 'POST',
      body: JSON.stringify({ sourceName, csv, fileName: 'import.csv' }),
    }),
  promoteLearningToFaq: (importId: string) =>
    request<{ path: string; added: number }>(
      `/ai/learning/imports/${encodeURIComponent(importId)}/promote-faq`,
      { method: 'POST' },
    ),
  promoteLearningToExamples: (importId: string) =>
    request<{ path: string; added: number }>(
      `/ai/learning/imports/${encodeURIComponent(importId)}/promote-examples`,
      { method: 'POST' },
    ),
};

export interface AiUsageSummaryView {
  todayCostUsd: number;
  monthCostUsd: number;
  last7DaysCostUsd: number;
  autoReplyTodayCostUsd: number;
  adminTodayCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalAiCalls: number;
  averageCostPerReply: number;
  mostExpensiveModel: string | null;
  mostExpensiveFeature: string | null;
}

export interface AiBudgetStatusView {
  dailyTotalUsd: number;
  monthlyTotalUsd: number;
  autoReplyDailyUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  autoReplyDailyBudgetUsd: number;
  dailyUsagePercent: number;
  monthlyUsagePercent: number;
  autoReplyDailyPercent: number;
  aiBudgetPaused: boolean;
  autoReplyPaused: boolean;
  atWarningThreshold: boolean;
}

export interface AiUsageLogRow {
  id: string;
  feature: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  actualCostUsd: number;
  status: string;
  toolCallsCount: number;
  conversationId?: string | null;
  messageId?: string | null;
  createdAt: string;
}

export const aiUsageApi = {
  getPermissions: () => request<{ permissions: string[] }>('/ai/cost/permissions'),
  getSummary: () =>
    request<{
      usage: AiUsageSummaryView;
      budget: AiBudgetStatusView;
    }>('/admin/ai-usage/summary'),
  getDaily: (days = 30) =>
    request<Array<{ date: string; costUsd: number }>>(
      `/admin/ai-usage/daily?days=${days}`,
    ),
  getByModel: (since?: string) =>
    request<Array<{ model: string; provider: string; costUsd: number; calls: number }>>(
      since ? `/admin/ai-usage/by-model?since=${encodeURIComponent(since)}` : '/admin/ai-usage/by-model',
    ),
  getByFeature: (since?: string) =>
    request<Array<{ feature: string; costUsd: number; calls: number }>>(
      since ? `/admin/ai-usage/by-feature?since=${encodeURIComponent(since)}` : '/admin/ai-usage/by-feature',
    ),
  getRecent: (params?: {
    limit?: number;
    offset?: number;
    feature?: string;
    provider?: string;
    model?: string;
    status?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.feature) q.set('feature', params.feature);
    if (params?.provider) q.set('provider', params.provider);
    if (params?.model) q.set('model', params.model);
    if (params?.status) q.set('status', params.status);
    const qs = q.toString();
    return request<{ items: AiUsageLogRow[]; total: number }>(
      `/admin/ai-usage/recent${qs ? `?${qs}` : ''}`,
    );
  },
  getBudgetStatus: () => request<AiBudgetStatusView>('/admin/ai-budget/status'),
  updateBudgetSettings: (body: {
    aiDailyBudgetUsd?: number;
    aiMonthlyBudgetUsd?: number;
    autoReplyDailyBudgetUsd?: number;
    stopAutoReplyWhenBudgetExceeded?: boolean;
    notifyAdminWhenBudgetAtPercent?: number;
    allowAdminOverrideBudget?: boolean;
  }) =>
    request<{ ok: boolean; budget: AiBudgetStatusView }>('/admin/ai-budget/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  pauseAutoReply: () =>
    request<{ ok: boolean; autoReplyPaused: boolean }>('/admin/ai-control/pause-auto-reply', {
      method: 'POST',
    }),
  resumeAutoReply: () =>
    request<{ ok: boolean; autoReplyPaused: boolean }>('/admin/ai-control/resume-auto-reply', {
      method: 'POST',
    }),
};

export type AiLearningItemStatus =
  | 'pending_review'
  | 'suggested'
  | 'approved'
  | 'rejected'
  | 'ignored'
  | 'merged'
  | 'applied'
  | 'needs_more_info';

export interface AiLearningItem {
  id: string;
  conversationId: string | null;
  sessionId: string | null;
  chatId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  branchId: string | null;
  question: string;
  normalizedQuestion: string;
  detectedIntent: string | null;
  detectedProduct: string | null;
  contextMessages: Array<{ role: string; body: string; at?: string }> | null;
  aiDraftAnswer: string | null;
  adminFinalAnswer: string | null;
  status: AiLearningItemStatus;
  confidenceScore: number;
  whyUnsure: string | null;
  source: string;
  timesAsked: number;
  priority: string;
  approvedBy: string | null;
  approvedAt: string | null;
  targetFile: string | null;
  knowledgeCategory: string | null;
  tone: string | null;
  reviewPeriodDays: number | null;
  reviewDate: string | null;
  internalNote: string | null;
  similarGroupId: string | null;
  outcome: string | null;
  issueType?: string | null;
  sourceType?: string | null;
  title?: string | null;
  conversationExcerpt?: string | null;
  suggestedTargetFile?: string | null;
  metadata?: Record<string, unknown> | null;
  appliedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiLearningKnowledge {
  id: string;
  questionPattern: string;
  alternativeQuestions: string[] | null;
  approvedAnswer: string;
  category: string | null;
  targetFile: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  timesUsed: number;
  successRate: number | null;
  reviewDate: string | null;
  status: string;
  sourceItemId: string | null;
  sessionId: string | null;
  chatId: string | null;
  internalNotes: string | null;
  lastEditedBy: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiLearningSettings {
  id: string;
  enableLearningDetection: boolean;
  requireAdminApproval: boolean;
  autoCreatePendingQuestion: boolean;
  autoSuggestDraftAnswer: boolean;
  groupSimilarQuestions: boolean;
  trackRepeatedQuestions: boolean;
  trackStaffCorrections: boolean;
  trackCustomerOutcome: boolean;
  highConfidenceThreshold: number;
  trainingKnowledgeMatchThreshold?: number;
  trainingGroupChatsMode?: 'skip' | 'separate' | 'include';
  mediumConfidenceThreshold: number;
  defaultUnknownReply: string;
  trackProductMentions: boolean;
  trackVariants: boolean;
  trackUnmatchedProducts: boolean;
  trackOutOfStockDemand: boolean;
  trackInstallmentDemand: boolean;
  trackDiscountPressure: boolean;
  trackPaymentReadyDemand: boolean;
  trackCategoryDemand: boolean;
  trackBrandDemand: boolean;
  allowedTargetFiles: string[] | null;
  ignoredIntents: string[] | null;
  riskyCategories: string[] | null;
  trainingCenterEnabled?: boolean;
  autoCreateFromLowConfidence?: boolean;
  autoCreateFromHumanReplies?: boolean;
  dailyInboxScan?: boolean;
  scanLastDays?: number;
  dailyScanTime?: string;
  useLlmTrainingSuggestions?: boolean;
  autoClusterRepeated?: boolean;
  autoReindexAfterApproval?: boolean;
  allowMarkdownWrites?: boolean;
  allowMemoryWrites?: boolean;
  allowDbTrainingRules?: boolean;
  maskPrivateDataInExports?: boolean;
  autoReindexSmallUpdatesOnly?: boolean;
  knowledgeIndexStale?: boolean;
  updatedAt: string;
}

export interface AiLearningOverview {
  pendingLearning: number;
  unknownQuestionsToday: number;
  mostAskedProduct: string | null;
  outOfStockDemand: number;
  installmentDemand: number;
  aiPausedChats: number;
}

export interface ProductDemandSummaryRow {
  id: string;
  branchId: string | null;
  productId: string | null;
  variantId: string | null;
  detectedProductName: string | null;
  category: string | null;
  brand: string | null;
  period: string;
  requestCount: number;
  uniqueCustomers: number;
  priceRequests: number;
  availabilityRequests: number;
  installmentRequests: number;
  discountRequests: number;
  paymentReadyCount: number;
  outOfStockCount: number;
  lastAskedAt: string | null;
  recommendedAction: string | null;
  trend: string;
  markedImportant: boolean;
}

export interface MissingProductRequest {
  id: string;
  rawProductName: string;
  possibleCategory: string | null;
  brand: string | null;
  timesAsked: number;
  uniqueCustomers: number;
  branchId: string | null;
  suggestedProductId: string | null;
  confidenceScore: number | null;
  status: string;
  exampleMessages: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCatalogRequest {
  id: string;
  productName: string;
  category: string | null;
  brand: string | null;
  suggestedSpecs: string | null;
  branchId: string | null;
  customerCount: number;
  exampleMessages: string[] | null;
  priority: string;
  notes: string | null;
  assignedStaffId: string | null;
  dueDate: string | null;
  missingProductRequestId: string | null;
  status: string;
  productId: string | null;
  fulfilledAt: string | null;
  linkedProductName?: string | null;
  createdAt: string;
}

export interface ProductDemandRecommendation {
  id: string;
  title: string;
  reason: string;
  dataProof: string | null;
  expectedImpact: string | null;
  priority: string;
  suggestedAction: string | null;
  productIds: string[] | null;
  productNames: string[] | null;
  customersAffected: number;
  branchId: string | null;
  status: string;
  createdAt: string;
}

export interface ProductDemandCampaign {
  id: string;
  title: string;
  message: string;
  channel: string;
  status: string;
  productNames: string[] | null;
  productIds: string[] | null;
  recommendationId: string | null;
  summaryId: string | null;
  branchId: string | null;
  sessionId: string | null;
  recipientCount: number;
  sentCount: number;
  recipients: Array<{
    phone?: string | null;
    customerId?: string | null;
    customerName?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
  }> | null;
  createdAt: string;
  sentAt: string | null;
}

export interface RecommendationActionResult {
  recommendation: ProductDemandRecommendation;
  taskId?: string;
  campaignId?: string;
  campaignPrefill?: {
    title: string;
    message: string;
    productNames: string[];
  };
}

export interface AiLearningDemandAlerts {
  learning: {
    pendingCount: number;
    unknownToday: number;
    repeatedUnknownCount: number;
    staffCorrectionsWaiting: number;
    urgentWaitingCustomers: number;
    aiPausedChats: number;
    topPending: AiLearningItem[];
  };
  demand: {
    outOfStockDemand: number;
    installmentDemand: number;
    missingProducts: number;
    mostAskedProduct: string | null;
    mostAskedCategory: string | null;
    topMissingProduct: string | null;
    highestInstallmentDemand: number;
    highestDiscountPressure: number;
    paymentReadyDemand: number;
    trendingThisWeek: number;
    draftCampaignsCount: number;
    approvedCampaignsCount?: number;
    topDraftCampaigns: Array<{
      id: string;
      title: string;
      recipientCount: number;
      channel: string;
    }>;
  };
  profile?: {
    nameReview: number;
    learningReview: number;
    lostWaiting: number;
    openLostDemand: number;
  };
}

export interface CustomerProfileEnrichmentView {
  id: string;
  sessionId: string;
  chatId: string;
  preferredName: string | null;
  fullName: string | null;
  nameConfidenceScore: number | null;
  nameNeedsReview: boolean;
  profileCompleteness: number | null;
  wantedProduct: string | null;
  wantedVariant: string | null;
  budgetRange: string | null;
  customerUseCase: string | null;
  deliveryPreference: string | null;
  paymentPreference: string | null;
  notifyWhenAvailable: boolean;
  profileLearningPaused: boolean;
  lastProfileUpdatedByAiAt: string | null;
  aiProfileNotes?: Record<string, unknown> | null;
  crm?: {
    customerName?: string | null;
    confirmedCity?: string | null;
    preferredBranchId?: string | null;
    lastProductInterest?: string | null;
  };
}

export interface CustomerProfileLearningEventView {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  confidenceScore: number | null;
  status: string;
  createdAt: string;
}

export interface LostDemandFollowupView {
  id: string;
  sessionId: string;
  chatId: string;
  wantedProduct: string;
  wantedVariant: string | null;
  status: string;
  notifyWhenAvailable: boolean;
  customerNameAtTime: string | null;
  createdAt: string;
}

export const customerProfileApi = {
  getEnrichment: (sessionId: string, chatId: string) =>
    request<CustomerProfileEnrichmentView>(
      `/customers/profile-enrichment?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  patchEnrichment: (id: string, body: Partial<CustomerProfileEnrichmentView>) =>
    request<CustomerProfileEnrichmentView>(`/customers/profile-enrichment/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listLearningEvents: (sessionId: string, chatId: string) =>
    request<CustomerProfileLearningEventView[]>(
      `/customers/profile-learning-events?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  approveEvent: (eventId: string) =>
    request(`/customers/profile-learning-events/${encodeURIComponent(eventId)}/approve`, {
      method: 'POST',
    }),
  rejectEvent: (eventId: string) =>
    request(`/customers/profile-learning-events/${encodeURIComponent(eventId)}/reject`, {
      method: 'POST',
    }),
  listLostDemand: (status?: string) =>
    request<LostDemandFollowupView[]>(
      `/lost-demand-followups${status ? `?status=${encodeURIComponent(status)}` : ''}`,
    ),
  closeLostDemand: (id: string) =>
    request(`/lost-demand-followups/${encodeURIComponent(id)}/close`, { method: 'POST' }),
};

export const aiLearningApi = {
  getOverview: () => request<AiLearningOverview>('/ai-learning/overview'),
  listItems: (params?: { status?: string; search?: string; branchId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.branchId) q.set('branchId', params.branchId);
    const qs = q.toString();
    return request<AiLearningItem[]>(`/ai-learning/items${qs ? `?${qs}` : ''}`);
  },
  getItem: (id: string) => request<AiLearningItem>(`/ai-learning/items/${encodeURIComponent(id)}`),
  getSimilar: (id: string) =>
    request<AiLearningItem[]>(`/ai-learning/items/${encodeURIComponent(id)}/similar`),
  patchItem: (id: string, body: Partial<AiLearningItem>) =>
    request<AiLearningItem>(`/ai-learning/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  approveItem: (id: string, body: { adminFinalAnswer: string; targetFile?: string; category?: string }) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  rejectItem: (id: string) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
  ignoreItem: (id: string) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/ignore`, { method: 'POST' }),
  mergeItems: (id: string, targetIds: string[]) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/merge`, {
      method: 'POST',
      body: JSON.stringify({ targetIds }),
    }),
  replyAndTeach: (id: string, body: { adminFinalAnswer: string; targetFile?: string; category?: string }) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/reply-and-teach`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  teachOnly: (id: string, body: { adminFinalAnswer: string; targetFile?: string; category?: string }) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/teach-only`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  replyOnly: (id: string, body: { answer: string }) =>
    request(`/ai-learning/items/${encodeURIComponent(id)}/reply-only`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listKnowledge: (params?: { status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString();
    return request<AiLearningKnowledge[]>(`/ai-learning/knowledge${qs ? `?${qs}` : ''}`);
  },
  patchKnowledge: (id: string, body: Partial<AiLearningKnowledge>) =>
    request<AiLearningKnowledge>(`/ai-learning/knowledge/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  disableKnowledge: (id: string) =>
    request(`/ai-learning/knowledge/${encodeURIComponent(id)}/disable`, { method: 'POST' }),
  markKnowledgeNeedsReview: (id: string) =>
    request(`/ai-learning/knowledge/${encodeURIComponent(id)}/mark-needs-review`, { method: 'POST' }),
  listHistory: () => request<AiLearningItem[]>('/ai-learning/history'),
  getSettings: () => request<AiLearningSettings>('/ai-learning/settings'),
  patchSettings: (body: Partial<AiLearningSettings>) =>
    request<AiLearningSettings>('/ai-learning/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  resetSettings: () => request<AiLearningSettings>('/ai-learning/settings/reset', { method: 'POST' }),
};

export interface AiTrainingOverview {
  pendingQuestions: number;
  highPriority: number;
  approvedToday: number;
  appliedKnowledge: number;
  needsReindex: boolean;
  aiSuggestions: number;
  urgentCount: number;
}

export interface AiTrainingSuggestion {
  id: string;
  trainingItemId: string;
  optionLabel: string | null;
  optionText: string | null;
  responseText: string | null;
  actionType: string;
  targetFile: string | null;
  targetSection: string | null;
  targetKey: string | null;
  confidence: number;
  reasoning: string | null;
  risks: string[] | null;
  isRecommended: boolean;
  createdAt: string;
}

export interface AiTrainingItemDetail extends AiLearningItem {
  trainingQuestion: string;
  suggestions: AiTrainingSuggestion[];
}

export interface AiTrainingApprovalPreview {
  targetFile: string;
  targetSection: string | null;
  updateMode: string;
  oldContentPreview: string;
  newContentPreview: string;
  warnings: string[];
  requiresAdmin?: boolean;
}

export interface AiTrainingAuditEntry {
  id: string;
  trainingItemId: string;
  action: string;
  actorType: string;
  actorId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export const aiTrainingApi = {
  getOverview: () => request<AiTrainingOverview>('/ai-training/overview'),
  listItems: (params?: {
    status?: string;
    search?: string;
    branchId?: string;
    sourceType?: string;
    issueType?: string;
    priority?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.branchId) q.set('branchId', params.branchId);
    if (params?.sourceType) q.set('sourceType', params.sourceType);
    if (params?.issueType) q.set('issueType', params.issueType);
    if (params?.priority) q.set('priority', params.priority);
    const qs = q.toString();
    return request<AiLearningItem[]>(`/ai-training/items${qs ? `?${qs}` : ''}`);
  },
  getItem: (id: string) =>
    request<AiTrainingItemDetail>(`/ai-training/items/${encodeURIComponent(id)}`),
  createManual: (body: { question: string; title?: string; suggestedTargetFile?: string; customInstruction?: string }) =>
    request<AiLearningItem>('/ai-training/items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  scanInbox: (days?: number) =>
    request<{ created: number; scanned: number }>(
      `/ai-training/scan/inbox${days != null ? `?days=${days}` : ''}`,
      { method: 'POST' },
    ),
  scanSystem: () =>
    request<{ created: number }>('/ai-training/scan/system', { method: 'POST' }),
  generateSuggestions: (id: string) =>
    request<AiTrainingSuggestion[]>(
      `/ai-training/items/${encodeURIComponent(id)}/generate-suggestions`,
      { method: 'POST' },
    ),
  previewApproval: (
    id: string,
    body: {
      selectedSuggestionId?: string;
      customAnswer?: string;
      customInstruction?: string;
      targetFile?: string;
      updateMode?: string;
    },
  ) =>
    request<AiTrainingApprovalPreview>(
      `/ai-training/items/${encodeURIComponent(id)}/preview-approval`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  approve: (
    id: string,
    body: {
      selectedSuggestionId?: string;
      customAnswer?: string;
      customInstruction?: string;
      targetFile?: string;
      updateMode?: string;
      applyNow?: boolean;
    },
  ) =>
    request(`/ai-training/items/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  reject: (id: string) =>
    request(`/ai-training/items/${encodeURIComponent(id)}/reject`, { method: 'POST' }),
  ignore: (id: string) =>
    request(`/ai-training/items/${encodeURIComponent(id)}/ignore`, { method: 'POST' }),
  bulkIgnore: (ids: string[]) =>
    request<AiLearningItem[]>('/ai-training/items/bulk-ignore', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  bulkApprove: (ids: string[], applyNow = true, overrides?: Array<{ id: string; customAnswer?: string; selectedSuggestionId?: string }>) =>
    request<{ approved: string[]; skipped: Array<{ id: string; reason: string }>; failed: Array<{ id: string; error: string }> }>(
      '/ai-training/items/bulk-approve',
      {
        method: 'POST',
        body: JSON.stringify({ ids, applyNow, overrides }),
      },
    ),
  reindex: (includeMemory?: boolean) =>
    request<{ knowledgeChunks: number; error?: string }>('/ai-training/reindex', {
      method: 'POST',
      body: JSON.stringify({ includeMemory: includeMemory ?? false }),
    }),
  getAudit: (trainingItemId?: string) => {
    const q = trainingItemId ? `?trainingItemId=${encodeURIComponent(trainingItemId)}` : '';
    return request<AiTrainingAuditEntry[]>(`/ai-training/audit${q}`);
  },
  getSettings: () => request<AiLearningSettings>('/ai-training/settings'),
  patchSettings: (body: Partial<AiLearningSettings>) =>
    request<AiLearningSettings>('/ai-training/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export const productDemandApi = {
  getOverview: () => request<Record<string, unknown>>('/product-demand/overview'),
  listItems: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params ?? {});
    const qs = q.toString();
    return request<ProductDemandSummaryRow[]>(`/product-demand/items${qs ? `?${qs}` : ''}`);
  },
  getItem: (id: string) => request(`/product-demand/items/${encodeURIComponent(id)}`),
  listMissing: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<MissingProductRequest[]>(`/product-demand/missing${q}`);
  },
  getMissingDetail: (id: string) =>
    request<{
      missing: MissingProductRequest;
      recentChats: Array<{
        sessionId: string;
        chatId: string;
        customerId: string | null;
        lastMessage: string | null;
        lastAskedAt: string;
      }>;
    }>(`/product-demand/missing/${encodeURIComponent(id)}`),
  mapMissing: (id: string, body: { productId: string; variantId?: string; aliasNames?: string[] }) =>
    request(`/product-demand/missing/${encodeURIComponent(id)}/map`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  ignoreMissing: (id: string) =>
    request(`/product-demand/missing/${encodeURIComponent(id)}/ignore`, { method: 'POST' }),
  addAlias: (body: { aliasText: string; productId: string; variantId?: string }) =>
    request('/product-demand/alias', { method: 'POST', body: JSON.stringify(body) }),
  createStockingReminder: (body: Record<string, string | undefined>) =>
    request('/product-demand/stocking-reminder', { method: 'POST', body: JSON.stringify(body) }),
  createProductRequest: (body: {
    productName: string;
    category?: string;
    brand?: string;
    suggestedSpecs?: string;
    branchId?: string;
    customerCount?: number;
    exampleMessages?: string[];
    priority?: string;
    notes?: string;
    assignedStaffId?: string;
    dueDate?: string;
    missingProductRequestId?: string;
    createStockingReminder?: boolean;
  }) =>
    request('/product-demand/product-request', { method: 'POST', body: JSON.stringify(body) }),
  listProductRequests: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<ProductCatalogRequest[]>(`/product-demand/product-requests${q}`);
  },
  getProductRequest: (id: string) =>
    request<ProductCatalogRequest>(`/product-demand/product-requests/${encodeURIComponent(id)}`),
  updateProductRequest: (
    id: string,
    body: {
      status?: string;
      notes?: string;
      assignedStaffId?: string;
      dueDate?: string;
      priority?: string;
    },
  ) =>
    request<ProductCatalogRequest>(`/product-demand/product-requests/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  linkProductRequest: (id: string, productId: string) =>
    request<ProductCatalogRequest>(
      `/product-demand/product-requests/${encodeURIComponent(id)}/link-product`,
      { method: 'POST', body: JSON.stringify({ productId }) },
    ),
  listRecommendations: () => request<ProductDemandRecommendation[]>('/product-demand/recommendations'),
  recommendationAction: (id: string, action: string) =>
    request<RecommendationActionResult>(
      `/product-demand/recommendations/${encodeURIComponent(id)}/action`,
      {
        method: 'POST',
        body: JSON.stringify({ action }),
      },
    ),
  dismissRecommendation: (id: string) =>
    request(`/product-demand/recommendations/${encodeURIComponent(id)}/dismiss`, { method: 'POST' }),
  listCampaigns: () => request<ProductDemandCampaign[]>('/product-demand/campaigns'),
  getCampaignMetrics: () =>
    request<{
      draft: number;
      approved: number;
      sent: number;
      cancelled: number;
      total: number;
      sms: number;
      whatsapp: number;
      totalRecipients: number;
    }>('/product-demand/campaigns/metrics'),
  getCampaign: (id: string) =>
    request<ProductDemandCampaign>(`/product-demand/campaigns/${encodeURIComponent(id)}`),
  updateCampaign: (
    id: string,
    body: { title?: string; message?: string; channel?: string; sessionId?: string },
  ) =>
    request<ProductDemandCampaign>(`/product-demand/campaigns/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  sendCampaign: (id: string, body?: { channel?: string; sessionId?: string; templateId?: string }) =>
    request<ProductDemandCampaign>(
      `/product-demand/campaigns/${encodeURIComponent(id)}/send`,
      { method: 'POST', body: JSON.stringify(body ?? {}) },
    ),
  safetyPreflight: (id: string, body?: { sessionId?: string; templateId?: string }) =>
    request<CampaignSafetyPreflightResult>(
      `/product-demand/campaigns/${encodeURIComponent(id)}/safety-preflight`,
      { method: 'POST', body: JSON.stringify(body ?? {}) },
    ),
  approveCampaignLaunch: (id: string) =>
    request<ProductDemandCampaign>(
      `/product-demand/campaigns/${encodeURIComponent(id)}/approve-launch`,
      { method: 'POST' },
    ),
};

export const aiLearningDashboardApi = {
  getAlerts: () => request<AiLearningDemandAlerts>('/dashboard/ai-learning-demand-alerts'),
};

export interface AiLearningImport {
  id: string;
  sourceName: string;
  status: string;
  totalRows: number;
  importedRows: number;
  questionCount: number;
  topQuestions: Array<{ text: string; count: number; intent?: string }> | null;
  intentBreakdown?: Record<string, number> | null;
  replySamples?: Array<{ customer: string; staff: string; intent: string }> | null;
  importFormat?: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BranchAiProfile {
  id: string;
  branchId: string;
  businessName: string | null;
  branchName: string | null;
  aiDisplayName: string | null;
  locationDescription: string | null;
  googleMapsUrl: string | null;
  nearbyLandmarks: string | null;
  openingHours: string | null;
  phoneNumbers: string[] | null;
  deliveryPolicy: string | null;
  warrantyPolicy: string | null;
  installmentPolicyDefault: string | null;
  aiTone: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchPaymentAccount {
  id: string;
  branchId: string;
  methodType: 'mobile_money' | 'bank' | 'cash' | 'other';
  providerName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  instructions: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchPaymentAccountInput {
  methodType: BranchPaymentAccount['methodType'];
  providerName?: string | null;
  accountName: string;
  accountNumber: string;
  instructions?: string | null;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface AiDashboardSignals {
  discountRequests: number;
  installmentRequests: number;
  paymentConfirmations: number;
  openEscalations: number;
  stockingReminders: number;
  recentEscalations: Array<{
    id: string;
    sessionId: string;
    chatId: string;
    reason: string;
    detail: string | null;
    status: string;
    assignedStaffId?: string | null;
    createdAt: string;
    customerName?: string | null;
    customerPhone?: string | null;
    displayName?: string | null;
    sessionName?: string | null;
  }>;
  openStockingReminders: Array<{
    id: string;
    productId: string | null;
    productName: string | null;
    sessionId: string | null;
    chatId: string | null;
    note: string | null;
    createdAt: string;
    customerName?: string | null;
    customerPhone?: string | null;
    displayName?: string | null;
    sessionName?: string | null;
  }>;
}

export interface AiSearchEverywhereResult {
  query: string;
  categories: string | string[];
  results: {
    conversations?: Array<{
      sessionId: string;
      sessionName?: string;
      chatId: string;
      displayName?: string;
      isGroup?: boolean;
      lastPreview?: string;
    }>;
    products?: Array<{
      id: string;
      name: string;
      sku?: string;
      sellingPrice?: number;
      currency?: string;
    }>;
    quotes?: Array<{
      id: string;
      quoteNumber?: string;
      customerName?: string;
      status?: string;
    }>;
    leads?: Array<{
      id: string;
      customerName?: string;
      customerPhone?: string;
      stage?: string;
    }>;
    messages?: Array<{
      id: string;
      sessionId: string;
      chatId: string;
      body?: string;
    }>;
  };
  totals: Record<string, number>;
}

// =============================================================================
// Storage & Backup API
// =============================================================================

export type StorageMediaStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'failed'
  | 'deleted';

export interface StorageUsageBreakdown {
  totalBytes: number;
  messagesDbBytes: number;
  mediaBytes: number;
  imagesBytes: number;
  videosBytes: number;
  documentsBytes: number;
  audioVoiceBytes: number;
  stickersBytes: number;
  sessionDataBytes: number;
  backupBytes: number;
  bySession: Array<{ sessionId: string; sessionName: string; bytes: number }>;
  byChatType: Record<string, number>;
  byMediaType: Record<string, number>;
}

export interface StorageWarning {
  id: string;
  severity: 'high' | 'medium';
  message: string;
}

export interface ChatTypeStorageSettings {
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
  autoDownloadDocuments: boolean;
  autoDownloadAudio: boolean;
  autoDownloadVoice: boolean;
  autoDownloadStickers: boolean;
}

export interface GlobalStorageSettings {
  maxAutoDownloadSizeMb: number;
  keepMediaDays: number;
  excludeStarredMediaFromCleanup: boolean;
  allowGroupAutoDownload: boolean;
  manualDownloadOnlyForGroups: boolean;
}

export interface StorageSettingsResponse {
  global: GlobalStorageSettings;
  chatTypes: Record<string, ChatTypeStorageSettings>;
  sessionOverrides: Array<{
    sessionId: string;
    allowGroupAutoDownload?: boolean;
    manualDownloadOnlyForGroups?: boolean;
    autoDownloadImages?: boolean;
    autoDownloadVideos?: boolean;
    autoDownloadDocuments?: boolean;
    autoDownloadAudio?: boolean;
    autoDownloadVoice?: boolean;
    autoDownloadStickers?: boolean;
  }>;
}

export interface CleanupPreviewResult {
  confirmToken: string;
  candidateCount: number;
  bytesToFree: number;
  breakdown: { byMediaType: Record<string, number>; bySession: Record<string, number> };
  sampleMessageIds: string[];
}

export interface BackupRecordRow {
  id: string;
  filename: string;
  backupType: string;
  includedModules: string[] | null;
  mediaIncluded: boolean;
  fileSizeBytes: number;
  appVersion: string | null;
  dbVersion: string | null;
  createdBy: string | null;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface BackupSettingsRow {
  id: string;
  schedule: 'manual' | 'daily' | 'weekly' | 'monthly';
  backupTime: string;
  includeMedia: boolean;
  mediaScope: 'exclude' | 'imagesOnly' | 'documentsOnly' | 'all';
  destination: 'local' | 's3' | 'r2';
  s3Bucket: string | null;
  s3Region: string | null;
  updatedAt: string;
}

export const storageApi = {
  getPermissions: () => request<{ permissions: string[] }>('/storage/permissions'),
  getUsage: () =>
    request<{ usage: StorageUsageBreakdown; warnings: StorageWarning[] }>('/storage/usage'),
  getSettings: () => request<StorageSettingsResponse>('/storage/settings'),
  saveSettings: (body: Partial<StorageSettingsResponse>) =>
    request<StorageSettingsResponse>('/storage/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  downloadMedia: (messageId: string) =>
    request<{ ok: boolean; mediaStatus: StorageMediaStatus; messageId: string; sessionId: string }>(
      `/storage/media/${messageId}/download`,
      { method: 'POST' },
    ),
  starMedia: (messageId: string, starred: boolean) =>
    request<{ messageId: string; starred: boolean }>(`/storage/media/${messageId}/star`, {
      method: 'POST',
      body: JSON.stringify({ starred }),
    }),
  previewCleanup: (body: Record<string, unknown>) =>
    request<CleanupPreviewResult>('/storage/cleanup/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  runCleanup: (body: Record<string, unknown>) =>
    request<{ deletedCount: number; bytesFreed: number }>('/storage/cleanup/run', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

export const backupApi = {
  getSettings: () => request<BackupSettingsRow>('/backup/settings'),
  saveSettings: (body: Partial<BackupSettingsRow>) =>
    request<BackupSettingsRow>('/backup/settings', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  create: (body: {
    backupType: string;
    mediaScope?: string;
    includeMedia?: boolean;
  }) => request<BackupRecordRow>('/backup/create', { method: 'POST', body: JSON.stringify(body) }),
  history: () => request<BackupRecordRow[]>('/backup/history'),
  downloadUrl: (id: string) => `/api/backup/${id}/download`,
  restorePreview: (id: string) =>
    request<{
      backupId: string;
      modules: string[];
      recordCounts: Record<string, number>;
      conflicts: Array<{ id: string; params?: Record<string, string | number> }>;
      warnings: Array<{ id: string; params?: Record<string, string | number> }>;
      supportedModes: Array<'merge' | 'upsert'>;
    }>(`/backup/${id}/restore-preview`, { method: 'POST' }),
  restore: (id: string, confirm: boolean, mode: 'merge' | 'upsert' = 'merge') =>
    request<{ restored: boolean; imported: Record<string, number>; mode: 'merge' | 'upsert' }>(
      `/backup/${id}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({ confirm, mode }),
      },
    ),
};

// =============================================================================
// WhatsApp Safety API
// =============================================================================

export interface WhatsAppSafetySettings {
  id: string;
  globalEnabled: boolean;
  warmupEnabled: boolean;
  aiSafetyEnabled?: boolean;
  maxOutboundPerHour: number;
  maxOutboundPerDay: number;
  maxAutoRepliesPerCustomerPerDay: number;
  campaignsEnabled: boolean;
  followupAutoSendEnabled: boolean;
  aiAutoReplyEnabled: boolean;
  groupsAutoReplyEnabled: boolean;
  groupManagementEnabled: boolean;
  productBulkSendEnabled: boolean;
  statusPostsEnabled: boolean;
  whatsappCloudSyncEnabled: boolean;
  whatsappCloudWabaId?: string | null;
  whatsappCloudLastSyncAt?: string | null;
  whatsappCloudLastSyncSummary?: string | null;
  outside24hRequiresTemplate: boolean;
  startupSafeModeEnabled: boolean;
  autoDownloadMediaOnStartup?: boolean;
  fetchGroupInfoOnStartup?: boolean;
  minDelayBetweenMessagesMs: number;
  maxDelayBetweenMessagesMs: number;
  perContactCooldownMinutes: number;
  minAiReplyDelayMs?: number;
  maxAiReplyDelayMs?: number;
}

export interface WhatsAppSafetyOverview {
  safetyEnabled: boolean;
  pendingQueue: number;
  blockedToday: number;
  optedOutContacts: number;
  accountsInWarmup: number;
}

export interface WhatsAppSafetyQueueRow {
  id: string;
  sessionId: string;
  status: string;
  chatId: string;
  phone?: string | null;
  source: string;
  riskLevel: string;
  scheduledAt?: string | null;
  createdAt?: string | null;
}

export interface WhatsAppSafetyWarmupRow {
  id: string;
  sessionId: string;
  status: 'active' | 'paused' | 'completed';
  dayNumber: number;
  outboundSentToday: number;
  maxOutboundToday: number;
}

export interface WhatsAppConsentLookup {
  optInStatus: string;
  canMarketing: boolean;
  canFollowup: boolean;
  within24h: boolean;
  requiresTemplate: boolean;
  lastCustomerMessageAt: string | null;
}

export interface WhatsAppSafetyConsentRow {
  id: string;
  phone: string;
  optInStatus?: string;
  optOutReason?: string | null;
  canMarketing?: boolean;
  canFollowup?: boolean;
  canUtility?: boolean;
}

export interface WhatsAppSafetyAuditRow {
  id: string;
  decision: string;
  source: string;
  reason: string;
}

export interface WhatsAppSafetyHealthAlert {
  id: string;
  sessionId: string;
  eventType: string;
  message: string;
}

export interface WhatsAppSessionHealthEvent {
  id: string;
  sessionId: string;
  eventType: string;
  severity: string;
  message: string;
  createdAt: string;
}

export interface WhatsAppSessionHealthDetail {
  events: WhatsAppSessionHealthEvent[];
  automationPaused: boolean;
  startupSafeMode: boolean;
  queuePending: number;
  warmup?: WhatsAppSafetyWarmupRow | null;
}

export interface WhatsAppTemplateSyncStatus {
  enabled: boolean;
  configured: boolean;
  hasAccessToken: boolean;
  phoneNumberIdConfigured: boolean;
  cloudSendReady: boolean;
  wabaId: string | null;
  lastSyncAt: string | null;
  lastSyncSummary: string | null;
}

export interface WhatsAppCloudTemplateSendResult {
  ok: boolean;
  blocked: boolean;
  queued: boolean;
  reason: string;
  messageId?: string;
  queueItemId?: string;
  error?: string;
}

export interface WhatsAppCloudConnectionTestResult {
  ok: boolean;
  configured: boolean;
  hasAccessToken: boolean;
  wabaId: string | null;
  wabaName?: string | null;
  templateCount?: number;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  error?: string | null;
}

export interface WhatsAppSafetyTemplateRow {
  id: string;
  name: string;
  whatsappTemplateName: string | null;
  whatsappTemplateStatus: string;
  requiresWhatsappApproval: boolean;
  category: string;
  isActive: boolean;
}

export interface WhatsAppTemplateSyncResult {
  matched: number;
  updated: number;
  unchanged: number;
  unmatchedLocal: number;
  unmatchedCloud: number;
  errors: string[];
  syncedAt: string;
}

export interface CampaignSafetyPreflightResult {
  totalRecipients: number;
  optedInRecipients: number;
  blockedSkipped: number;
  outside24hCount: number;
  templateRequiredCount: number;
  estimatedSendMinutes: number;
  riskScore: number;
  launchAllowed: boolean;
  requiredFixes: string[];
}

export interface WhatsAppCheckSendResult {
  proceed: boolean;
  queued: boolean;
  blocked: boolean;
  reason: string;
  queueItemId?: string;
}

export interface WhatsAppSafetyDashboardAlerts {
  blockedToday: number;
  pendingQueue: number;
  warmups: WhatsAppSafetyWarmupRow[];
  approvalRequired: WhatsAppSafetyQueueRow[];
  criticalAlerts: WhatsAppSafetyHealthAlert[];
}

export interface WhatsAppLinkPreflightItem {
  id: string;
  ok: boolean;
  severity: 'required' | 'recommended' | 'manual';
  detail?: string | null;
  fixTarget?: 'whatsapp-safety' | 'plugins' | 'session-proxy' | 'session-engine' | null;
  fixField?: string | null;
}

export interface WhatsAppLinkPreflightResult {
  sessionId: string | null;
  sessionName: string | null;
  ready: boolean;
  blockingOk: boolean;
  recommendedOk: boolean;
  completed: number;
  total: number;
  engineType: string;
  items: WhatsAppLinkPreflightItem[];
}

export interface WhatsAppLinkPreflightSummaryRow {
  sessionId: string;
  sessionName: string;
  ready: boolean;
  blockingOk: boolean;
  issueCount: number;
}

export interface WhatsAppLinkPreflightSummary {
  notReadyCount: number;
  sessions: WhatsAppLinkPreflightSummaryRow[];
}

export const whatsAppSafetyApi = {
  getLinkPreflight: (sessionId?: string) => {
    const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return request<WhatsAppLinkPreflightResult>(`/whatsapp-safety/link-preflight${q}`);
  },
  getLinkPreflightSummary: () =>
    request<WhatsAppLinkPreflightSummary>('/whatsapp-safety/link-preflight/summary'),
  getSettings: () => request<WhatsAppSafetySettings>('/whatsapp-safety/settings'),
  patchSettings: (patch: Partial<WhatsAppSafetySettings>) =>
    request<WhatsAppSafetySettings>('/whatsapp-safety/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  resetSafeDefaults: () =>
    request<WhatsAppSafetySettings>('/whatsapp-safety/settings/reset-safe-defaults', {
      method: 'POST',
    }),
  getOverview: () => request<WhatsAppSafetyOverview>('/whatsapp-safety/overview'),
  checkSend: (body: {
    sessionId: string;
    chatId: string;
    body: string;
    messageType?: string;
    source?: string;
    isManualStaffSend?: boolean;
    templateId?: string;
  }) =>
    request<WhatsAppCheckSendResult>('/whatsapp-safety/check-send', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  restoreOptOut: (id: string, body?: { canMarketing?: boolean; canFollowup?: boolean }) =>
    request(`/whatsapp-safety/opt-outs/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    }),
  listQueue: (params?: { status?: string; sessionId?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.sessionId) q.set('sessionId', params.sessionId);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return request<WhatsAppSafetyQueueRow[]>(`/whatsapp-send-queue${suffix}`);
  },
  getQueueStats: () => request<Record<string, number>>('/whatsapp-send-queue/stats'),
  listWarmup: () => request<WhatsAppSafetyWarmupRow[]>('/whatsapp-warmup'),
  listConsent: () => request<WhatsAppSafetyConsentRow[]>('/whatsapp-consent'),
  listMarketingGaps: () =>
    request<WhatsAppSafetyConsentRow[]>('/whatsapp-consent/marketing-gaps'),
  lookupConsent: (sessionId: string, chatId: string) =>
    request<WhatsAppConsentLookup>(
      `/whatsapp-consent/lookup?sessionId=${encodeURIComponent(sessionId)}&chatId=${encodeURIComponent(chatId)}`,
    ),
  patchConsent: (
    id: string,
    patch: { canMarketing?: boolean; canFollowup?: boolean; canUtility?: boolean },
  ) =>
    request<WhatsAppSafetyConsentRow>(`/whatsapp-consent/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  listAuditLogs: (sessionId?: string) => {
    const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return request<WhatsAppSafetyAuditRow[]>(`/whatsapp-safety/audit-logs${q}`);
  },
  listBlockedSends: (sessionId?: string) => {
    const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return request<WhatsAppSafetyAuditRow[]>(`/whatsapp-safety/blocked-sends${q}`);
  },
  getDashboardAlerts: () =>
    request<WhatsAppSafetyDashboardAlerts>('/dashboard/whatsapp-safety-alerts'),
  approveQueue: (id: string, approvedBy?: string) =>
    request(`/whatsapp-send-queue/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy }),
    }),
  cancelQueue: (id: string) =>
    request(`/whatsapp-send-queue/${id}/cancel`, { method: 'POST' }),
  retryQueue: (id: string) =>
    request(`/whatsapp-send-queue/${id}/retry`, { method: 'POST' }),
  pauseWarmup: (sessionId: string) =>
    request(`/whatsapp-warmup/${sessionId}/pause`, { method: 'POST' }),
  resumeWarmup: (sessionId: string) =>
    request(`/whatsapp-warmup/${sessionId}/resume`, { method: 'POST' }),
  resetWarmup: (sessionId: string) =>
    request(`/whatsapp-warmup/${sessionId}/reset`, { method: 'POST' }),
  pauseAutomation: (sessionId: string) =>
    request(`/whatsapp-session-health/${sessionId}/pause-automation`, { method: 'POST' }),
  resumeAutomation: (sessionId: string) =>
    request(`/whatsapp-session-health/${sessionId}/resume-automation`, { method: 'POST' }),
  listSessionHealth: (sessionId?: string) => {
    const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
    return request<WhatsAppSessionHealthEvent[]>(`/whatsapp-session-health${q}`);
  },
  getSessionHealth: (sessionId: string) =>
    request<WhatsAppSessionHealthDetail>(`/whatsapp-session-health/${encodeURIComponent(sessionId)}`),
  listApprovalTemplates: () =>
    request<WhatsAppSafetyTemplateRow[]>('/whatsapp-safety/templates'),
  getTemplateSyncStatus: () =>
    request<WhatsAppTemplateSyncStatus>('/whatsapp-safety/templates/sync-status'),
  syncTemplatesFromCloud: () =>
    request<WhatsAppTemplateSyncResult>('/whatsapp-safety/templates/sync-from-cloud', {
      method: 'POST',
    }),
  testCloudConnection: () =>
    request<WhatsAppCloudConnectionTestResult>('/whatsapp-safety/cloud/connection-test'),
  sendCloudTemplate: (body: {
    sessionId: string;
    chatId: string;
    templateId: string;
    bodyParameters?: string[];
  }) =>
    request<WhatsAppCloudTemplateSendResult>('/whatsapp-safety/cloud/send-template', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// =============================================================================
// Agent Actions API
// =============================================================================

export const agentActionsApi = {
  resolve: (body: {
    text: string;
    currentPage?: string;
    currentChatId?: string;
    currentCustomerId?: string;
    branchId?: string;
  }) =>
    request<AgentActionResult | { matched: false }>('/agent-actions/resolve', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  execute: (body: {
    actionId: string;
    params?: Record<string, unknown>;
    currentPage?: string;
    currentChatId?: string;
    currentCustomerId?: string;
  }) =>
    request<AgentActionResult>('/agent-actions/execute', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  confirm: (confirmationId: string, conversationId?: string) =>
    request<AgentActionResult>('/agent-actions/confirm', {
      method: 'POST',
      body: JSON.stringify({ confirmationId, conversationId }),
    }),
  list: (pending?: boolean) =>
    request<{
      actions: Array<{ id: string; title: string; category: string; risk: string }>;
      settings: Record<string, unknown>;
      pendingConfirmations: Array<{ id: string; actionId: string; warningMessage: string | null }>;
      pendingCount: number;
    }>(`/agent-actions${pending ? '?pending=true' : ''}`),
  audit: (limit = 50) =>
    request<Array<Record<string, unknown>>>(`/agent-actions/audit?limit=${limit}`),
};

// =============================================================================
// Plugins API
// =============================================================================

export const pluginsApi = {
  list: () => request<Plugin[]>('/plugins'),
  get: (id: string) => request<Plugin>(`/plugins/${id}`),
  enable: (id: string) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/enable`, {
      method: 'POST',
    }),
  disable: (id: string) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/disable`, {
      method: 'POST',
    }),
  updateConfig: (id: string, config: Record<string, unknown>) =>
    request<{ success: boolean; message: string }>(`/plugins/${id}/config`, {
      method: 'PUT',
      body: JSON.stringify({ config }),
    }),
  healthCheck: (id: string) => request<{ healthy: boolean; message?: string }>(`/plugins/${id}/health`),
  getEngines: () => request<Engine[]>('/infra/engines'),
  getCurrentEngine: () => request<{ engineType: string }>('/infra/engines/current'),
};
