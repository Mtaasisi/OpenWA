import { getDesktopMainSqlitePath, getDesktopDataSqlitePath, isDesktopMode } from '../common/utils/desktop-paths.util';

const defaultPort = isDesktopMode() ? 2886 : 2785;

export default () => ({
  port: parseInt(process.env.PORT || String(defaultPort), 10),

  desktop: {
    enabled: isDesktopMode(),
    dataRoot: process.env.OPENWA_DATA_ROOT || null,
    deviceId: process.env.DESKTOP_DEVICE_ID || null,
    setupToken: process.env.DESKTOP_SETUP_TOKEN || null,
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  // Queue configuration
  queue: {
    enabled: process.env.QUEUE_ENABLED === 'true',
  },

  // Cache configuration
  cache: {
    enabled: process.env.CACHE_ENABLED === 'true',
  },

  jwt: {
    secret:
      process.env.JWT_SECRET ||
      (process.env.NODE_ENV === 'production' ? undefined : 'openwa-jwt-dev-secret-change-me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '8h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // Main Database configuration (always SQLite for boot config)
  database: {
    type: 'sqlite' as const,
    database: isDesktopMode() ? getDesktopMainSqlitePath() : './data/main.sqlite',
    synchronize: true,
    logging: process.env.DATABASE_LOGGING === 'true',
  },

  // Data Storage Database configuration (pluggable: SQLite, PostgreSQL, etc.)
  dataDatabase: {
    type: process.env.DATABASE_TYPE || 'sqlite',
    database:
      (process.env.DATABASE_TYPE || 'sqlite') === 'postgres'
        ? process.env.DATABASE_NAME || 'openwa'
        : isDesktopMode()
          ? getDesktopDataSqlitePath()
          : process.env.DATABASE_NAME || './data/openwa.sqlite',
    // PostgreSQL/MySQL connection (used when type is postgres/mysql)
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
    // Connection pooling (PostgreSQL)
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
    // SSL configuration
    ssl: process.env.DATABASE_SSL === 'true',
    sslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  },

  // WhatsApp engine configuration
  engine: {
    type: process.env.ENGINE_TYPE || 'whatsapp-web.js',
    puppeteer: {
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: (process.env.PUPPETEER_ARGS || '--no-sandbox,--disable-setuid-sandbox').split(','),
    },
    sessionDataPath: process.env.SESSION_DATA_PATH || './data/sessions',
    wa: {
      sessionReadyTimeoutMs: parseInt(process.env.WA_SESSION_READY_TIMEOUT_MS || '0', 10),
      slowConnectNoticeMs: parseInt(process.env.WA_SLOW_CONNECT_NOTICE_MS || '60000', 10),
      backgroundSyncDelayMs: parseInt(process.env.WA_BACKGROUND_SYNC_DELAY_MS || '60000', 10),
      backgroundChatBatchSize: parseInt(process.env.WA_BACKGROUND_CHAT_BATCH_SIZE || '20', 10),
      backgroundChatBatchDelayMs: parseInt(process.env.WA_BACKGROUND_CHAT_BATCH_DELAY_MS || '30000', 10),
      backgroundProfileDelayMs: parseInt(process.env.WA_BACKGROUND_PROFILE_DELAY_MS || '2000', 10),
      mediaBackfillDelayMs: parseInt(process.env.WA_MEDIA_BACKFILL_DELAY_MS || '500', 10),
      syncWindowMs: parseInt(process.env.WA_SYNC_WINDOW_MS || '300000', 10),
      historyBackfillMessages: parseInt(process.env.WA_HISTORY_BACKFILL_MESSAGES || '40', 10),
      historyBackfillDelayMs: parseInt(process.env.WA_HISTORY_BACKFILL_DELAY_MS || '3000', 10),
      largeAccountThreshold: parseInt(process.env.WA_LARGE_ACCOUNT_THRESHOLD || '2000', 10),
      queueCountsCacheTtlMs: parseInt(process.env.WA_INBOX_QUEUE_COUNTS_CACHE_MS || '60000', 10),
      defaultActiveSinceDays: parseInt(process.env.WA_INBOX_DEFAULT_ACTIVE_SINCE_DAYS || '90', 10),
      largeAccountCountsSampleLimit: parseInt(
        process.env.WA_LARGE_ACCOUNT_COUNTS_SAMPLE || '500',
        10,
      ),
      largeAccountSyncMaxChats: parseInt(process.env.WA_LARGE_ACCOUNT_SYNC_MAX_CHATS || '200', 10),
      largeAccountHotTierDays: parseInt(process.env.WA_LARGE_ACCOUNT_HOT_TIER_DAYS || '30', 10),
      largeAccountHotTierSize: parseInt(process.env.WA_LARGE_ACCOUNT_HOT_TIER_SIZE || '500', 10),
      largeAccountColdResolvedDays: parseInt(process.env.WA_LARGE_ACCOUNT_COLD_RESOLVED_DAYS || '180', 10),
    },
  },

  // WhatsApp session lifecycle (reconnect, auto-start on boot)
  session: {
    autoStart: process.env.AUTO_START_SESSIONS !== 'false',
    maxReconnectAttempts: parseInt(process.env.SESSION_MAX_RECONNECT_ATTEMPTS || '10', 10),
    connectMaxReconnectAttempts: parseInt(process.env.SESSION_CONNECT_RECONNECT_ATTEMPTS || '20', 10),
    reconnectBaseDelayMs: parseInt(process.env.SESSION_RECONNECT_BASE_DELAY_MS || '5000', 10),
    reconnectInfinite: process.env.SESSION_RECONNECT_INFINITE === 'true',
    reconnectMaxDelayMs: parseInt(process.env.SESSION_RECONNECT_MAX_DELAY_MS || '300000', 10),
    healthMonitorEnabled: process.env.SESSION_HEALTH_MONITOR_ENABLED !== 'false',
    healthMonitorIntervalMs: parseInt(process.env.SESSION_HEALTH_MONITOR_INTERVAL_MS || '60000', 10),
    healthAutoRestart: process.env.SESSION_HEALTH_AUTO_RESTART !== 'false',
    scheduledRestartEnabled: process.env.SESSION_SCHEDULED_RESTART_ENABLED === 'true',
    /** 0 = Sunday … 6 = Saturday */
    scheduledRestartDay: parseInt(process.env.SESSION_SCHEDULED_RESTART_DAY || '0', 10),
    scheduledRestartTime: process.env.SESSION_SCHEDULED_RESTART_TIME || '03:00',
  },

  // Webhook configuration
  webhook: {
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '10000', 10),
    maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY || '5000', 10),
  },

  // API configuration
  api: {
    rateLimit: {
      disabled:
        process.env.RATE_LIMIT_DISABLED === 'true' ||
        (process.env.NODE_ENV !== 'production' && process.env.RATE_LIMIT_DISABLED !== 'false'),
      // Short burst protection (dashboard inbox opens many parallel requests)
      shortTtl: parseInt(process.env.RATE_LIMIT_SHORT_TTL || '1000', 10),
      shortLimit: parseInt(process.env.RATE_LIMIT_SHORT_LIMIT || '60', 10),
      // Medium protection: legacy RATE_LIMIT_TTL (seconds) / RATE_LIMIT_MAX still supported
      mediumTtl: parseInt(
        process.env.RATE_LIMIT_MEDIUM_TTL ||
          (process.env.RATE_LIMIT_TTL ? String(Number(process.env.RATE_LIMIT_TTL) * 1000) : '60000'),
        10,
      ),
      mediumLimit: parseInt(process.env.RATE_LIMIT_MEDIUM_LIMIT || process.env.RATE_LIMIT_MAX || '200', 10),
      // Long protection: 1000 requests per hour
      longTtl: parseInt(process.env.RATE_LIMIT_LONG_TTL || '3600000', 10),
      longLimit: parseInt(process.env.RATE_LIMIT_LONG_LIMIT || '1000', 10),
    },
  },

  // Plugin configuration
  plugins: {
    enabled: process.env.PLUGINS_ENABLED !== 'false',
    dir: process.env.PLUGINS_DIR || './plugins',
  },

  // INAUZWA inventory import (optional)
  inauzwa: {
    databaseUrl: process.env.INAUZWA_DATABASE_URL || process.env.INAUZWA_SUPABASE_DB_URL,
    apiUrl: process.env.INAUZWA_API_URL,
    apiToken: process.env.INAUZWA_API_TOKEN,
    branchId: process.env.INAUZWA_BRANCH_ID,
    vendorId: process.env.INAUZWA_VENDOR_ID,
    currency: process.env.INAUZWA_CURRENCY || 'TZS',
    supabaseUrl: process.env.INAUZWA_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    supabaseAnonKey: process.env.INAUZWA_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    autoSyncEnabled: process.env.INAUZWA_AUTO_SYNC_ENABLED === 'true',
    autoSyncIntervalMinutes: parseInt(process.env.INAUZWA_AUTO_SYNC_INTERVAL_MINUTES || '60', 10),
  },

  ai: {
    knowledgePath: process.env.AI_KNOWLEDGE_PATH || './data/ai-knowledge',
    knowledgeAutoIndexOnBoot: process.env.AI_KNOWLEDGE_AUTO_INDEX !== 'false',
    memoryPath: process.env.AI_MEMORY_PATH || './data/ai-memory',
    memoryAutoIndexOnBoot: process.env.AI_MEMORY_AUTO_INDEX !== 'false',
    /** 0 = disabled. e.g. 24 runs memory dream once per day. */
    memoryDreamIntervalHours: parseInt(process.env.AI_MEMORY_DREAM_INTERVAL_HOURS || '0', 10),
  },

  // Storage configuration
  storage: {
    type: process.env.STORAGE_TYPE || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './data/media',
    s3: {
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
    },
  },
});
