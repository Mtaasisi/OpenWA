// API Service Layer for OpenWA Dashboard
// Centralized API client with TypeScript types

const API_BASE_URL = '/api';

// =============================================================================
// Types
// =============================================================================

export interface Session {
  id: string;
  name: string;
  status: 'created' | 'initializing' | 'qr_ready' | 'authenticating' | 'ready' | 'disconnected' | 'failed';
  phone?: string;
  pushName?: string;
  lastActive?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStats {
  total: number;
  active: number;
  ready: number;
  disconnected: number;
  byStatus: Record<string, number>;
  memoryUsage: { heapUsed: number; heapTotal: number; rss: number };
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
  lastDirection: 'incoming' | 'outgoing';
  messageCount: number;
  unreadCount: number;
  hasUnread: boolean;
  resolved: boolean;
  hasFollowUp: boolean;
  customerName?: string | null;
  linkedExternalId?: string | null;
}

export interface InboxThreadCrm {
  sessionId: string;
  chatId: string;
  resolved: boolean;
  resolvedAt: string | null;
  internalNote: string | null;
  followUpAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  linkedExternalId: string | null;
  updatedAt: string;
}

export interface UpdateInboxThreadCrmPayload {
  sessionId: string;
  chatId: string;
  resolved?: boolean;
  internalNote?: string | null;
  followUpAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  linkedExternalId?: string | null;
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

export interface InfraStatus {
  api?: { port: number; baseUrl: string };
  database: { connected: boolean; type: string; host: string };
  redis: { connected: boolean; host: string; port: number };
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Get API key from sessionStorage for authentication
  const apiKey = sessionStorage.getItem('openwa_api_key');

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-API-Key': apiKey } : {}),
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
  create: (name: string) =>
    request<Session>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  delete: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  start: (id: string) => request<Session>(`/sessions/${id}/start`, { method: 'POST' }),
  stop: (id: string) => request<Session>(`/sessions/${id}/stop`, { method: 'POST' }),
  getQR: (id: string) => request<{ qrCode: string; status: string }>(`/sessions/${id}/qr`),
  getStats: () => request<SessionStats>('/sessions/stats/overview'),
  getGroups: (id: string) => request<{ id: string; name: string }[]>(`/sessions/${id}/groups`),
  getConversations: (id: string) => request<Conversation[]>(`/sessions/${id}/conversations`),
  markConversationRead: (sessionId: string, chatId: string) =>
    request<{ ok: boolean }>(`/sessions/${sessionId}/conversations/${encodeURIComponent(chatId)}/read`, {
      method: 'PATCH',
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
  sellingPrice: number | null;
  quantity: number;
  variantType: ProductVariantType;
  isParent: boolean;
  parentVariantId: string | null;
  attributes: Record<string, string | number | boolean | null> | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmProduct {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  imageUrl: string | null;
  currency: string | null;
  sellingPrice: number | null;
  isActive: boolean;
  sortOrder: number;
  externalId?: string | null;
  variants: CrmProductVariant[];
  totalStock: number;
  variantCount: number;
  createdAt: string;
  updatedAt: string;
}

/** List endpoint omits variant payloads. */
export type CrmProductListItem = Omit<CrmProduct, 'variants'> & { variants?: never };

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
  includeAllVariants?: boolean;
  includeAvailableDevices?: boolean;
  inStockOnly?: boolean;
  includeImage?: boolean;
  refreshStock?: boolean;
}

type InauzwaConnectionInfo = {
  configured: boolean;
  source: 'database' | 'api' | null;
  configuredVia: 'env' | 'ui' | null;
  databaseUrlMasked: string | null;
  apiUrl: string | null;
  hasApiToken: boolean;
  loginEmail: string | null;
  connectedViaLogin: boolean;
};

type InauzwaPreferencesDto = {
  branchId: string | null;
  vendorId: string | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  refreshBeforeSend: boolean;
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
  list: (params?: { q?: string; inStockOnly?: boolean; activeOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.inStockOnly) query.set('inStockOnly', 'true');
    if (params?.activeOnly === false) query.set('activeOnly', 'false');
    const qs = query.toString();
    return request<CrmProductListItem[]>(`/products${qs ? `?${qs}` : ''}`);
  },
  catalogStats: (params?: { activeOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.activeOnly === false) query.set('activeOnly', 'false');
    const qs = query.toString();
    return request<CatalogStats>(`/products/catalog/stats${qs ? `?${qs}` : ''}`);
  },
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
      includeAllVariants?: boolean;
      includeAvailableDevices?: boolean;
      inStockOnly?: boolean;
    },
  ) => {
    const query = new URLSearchParams();
    if (params?.variantId) query.set('variantId', params.variantId);
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
      defaultSupabaseAnonKey: string | null;
      hasSupabaseConfig: boolean;
      preferences: InauzwaPreferencesDto;
    }>('/products/sync/inauzwa/status'),
  listInauzwaBranches: () =>
    request<{ id: string; name: string }[]>('/products/sync/inauzwa/branches'),
  updateInauzwaSettings: (payload: {
    branchId?: string | null;
    vendorId?: string | null;
    autoSyncEnabled?: boolean;
    autoSyncIntervalMinutes?: number;
    refreshBeforeSend?: boolean;
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

export const inboxApi = {
  getConversations: () => request<Conversation[]>('/inbox/conversations'),
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
};

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
