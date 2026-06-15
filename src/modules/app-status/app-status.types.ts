export type AppStatusLevel = 'success' | 'warning' | 'error' | 'neutral' | 'loading';

export interface AppStatusWarning {
  id: string;
  level: 'warning' | 'error';
  title: string;
  message: string;
  createdAt: string;
  action?: {
    label: string;
    route: string;
  };
}

export interface AppStatusSessionItem {
  id: string;
  name: string;
  status: string;
  connected: boolean;
  qrNeeded: boolean;
  lastActiveAt: string | null;
}

export interface AppStatusResponse {
  overall: AppStatusLevel;
  updatedAt: string;
  workSummary: {
    pending: number;
    efficiency: number;
  };
  ai: {
    status: AppStatusLevel;
    label: string;
    autoReply: 'on' | 'off' | 'paused';
    provider: string;
    model: string;
    knowledgeIndexed: boolean;
    pendingLearning: number;
    lastError: string | null;
  };
  whatsapp: {
    status: AppStatusLevel;
    label: string;
    activeSessions: number;
    qrNeeded: number;
    disconnected: number;
    sessions: AppStatusSessionItem[];
  };
  queue: {
    status: AppStatusLevel;
    pending: number;
    delayed: number;
    failed: number;
  };
  database: {
    status: AppStatusLevel;
    label: string;
    latencyMs: number;
    lastPingAt: string;
  };
  sync: {
    status: AppStatusLevel;
    label: string;
    unsynced: number;
    failed: number;
    lastSyncAt: string | null;
  };
  branch: {
    id: string;
    name: string;
    status: AppStatusLevel;
    paymentProfileConfigured: boolean;
  };
  user: {
    id: string;
    name: string;
    role: string;
  };
  warnings: AppStatusWarning[];
  desktop?: {
    localBackendRunning: boolean;
    whatsAppEngineRunning: boolean;
    sessionPathAccessible: boolean;
    version: string;
  };
}
