import { app, safeStorage } from 'electron';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv, scryptSync } from 'crypto';
import { DesktopAppConfig, DEFAULT_CONFIG } from '../shared/desktop-config';
import { resolveChromiumExecutable } from './runtime-paths';
import { getEmbeddedDataSqlitePath } from './paths';

const CONFIG_FILE = 'desktop-config.json';
const SENSITIVE_KEYS: (keyof DesktopAppConfig)[] = [
  'databaseUrl',
  'setupToken',
  'jwtSecret',
  'apiMasterKey',
];

function getAppDataRoot(): string {
  return path.join(app.getPath('userData'));
}

function getConfigPath(): string {
  return path.join(getAppDataRoot(), 'config', CONFIG_FILE);
}

function deriveKey(): Buffer {
  const salt = 'inauzwa-crm-desktop-v1';
  return scryptSync(app.getPath('userData'), salt, 32);
}

function encryptValue(value: string): string {
  if (!value) return '';
  if (safeStorage.isEncryptionAvailable()) {
    return `safe:${safeStorage.encryptString(value).toString('base64')}`;
  }
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `aes:${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptValue(payload: string): string {
  if (!payload) return '';
  if (payload.startsWith('safe:')) {
    if (!safeStorage.isEncryptionAvailable()) return '';
    return safeStorage.decryptString(Buffer.from(payload.slice(5), 'base64'));
  }
  if (payload.startsWith('aes:')) {
    const [, ivHex, dataHex] = payload.split(':');
    const decipher = createDecipheriv('aes-256-cbc', deriveKey(), Buffer.from(ivHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
  return payload;
}

export function maskSecrets(config: DesktopAppConfig): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...config };
  if (config.databaseUrl) {
    try {
      const url = new URL(config.databaseUrl);
      masked.databaseUrl = `postgresql://${url.username || 'user'}:****@${url.hostname}/${url.pathname.replace(/^\//, '')}`;
    } catch {
      masked.databaseUrl = 'postgresql://****';
    }
  }
  if (config.setupToken) masked.setupToken = '****';
  if (config.jwtSecret) masked.jwtSecret = '****';
  if (config.apiMasterKey) masked.apiMasterKey = '****';
  return masked;
}

function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export class ConfigManager {
  private config: DesktopAppConfig;

  constructor() {
    this.ensureDirectories();
    this.config = this.load();
  }

  ensureDirectories(): void {
    const root = getAppDataRoot();
    const subdirs = ['config', 'sessions', 'media', 'backups', 'logs', 'ai-knowledge', 'ai-memory', 'temp', 'cache'];
    for (const sub of subdirs) {
      const dir = path.join(root, sub);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  private load(): DesktopAppConfig {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return this.createDefault();
    }
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      const config = { ...DEFAULT_CONFIG, ...raw } as DesktopAppConfig & Record<string, string>;
      for (const key of SENSITIVE_KEYS) {
        const val = raw[key];
        if (typeof val === 'string' && (val.startsWith('safe:') || val.startsWith('aes:'))) {
          (config as Record<string, unknown>)[key] = decryptValue(val);
        }
      }
      const withPaths = this.applyPathDefaults(config);
      const migrated = this.migrateToEmbeddedDatabase(withPaths);
      if (migrated.databaseMode !== withPaths.databaseMode || migrated.databaseUrl !== withPaths.databaseUrl) {
        this.config = migrated;
        this.save();
      }
      return this.ensureSecrets(migrated, true);
    } catch {
      return this.createDefault();
    }
  }

  private ensureSecrets(config: DesktopAppConfig, persistIfChanged: boolean): DesktopAppConfig {
    const next = { ...config };
    let changed = false;
    if (!next.jwtSecret?.trim()) {
      next.jwtSecret = generateSecret(48);
      changed = true;
    }
    if (!next.apiMasterKey?.trim()) {
      next.apiMasterKey = generateSecret(32);
      changed = true;
    }
    if (!next.setupToken?.trim()) {
      next.setupToken = generateSecret(24);
      changed = true;
    }
    if (changed && persistIfChanged) {
      this.config = next;
      this.save();
    }
    return next;
  }

  private createDefault(): DesktopAppConfig {
    const root = getAppDataRoot();
    const config: DesktopAppConfig = {
      ...DEFAULT_CONFIG,
      appInstalledAt: new Date().toISOString(),
      deviceId: randomUUID(),
      deviceName: os.hostname(),
      storagePath: root,
      sessionsPath: path.join(root, 'sessions'),
      mediaPath: path.join(root, 'media'),
      logsPath: path.join(root, 'logs'),
      aiKnowledgePath: path.join(root, 'ai-knowledge'),
      setupToken: generateSecret(24),
      jwtSecret: generateSecret(48),
      apiMasterKey: generateSecret(32),
      appVersion: app.getVersion(),
    };
    this.config = config;
    this.save();
    return this.config;
  }

  /** Desktop installs use local SQLite; drop legacy Neon URL defaults. */
  private migrateToEmbeddedDatabase(config: DesktopAppConfig): DesktopAppConfig {
    if (config.databaseMode === 'embedded' && !config.databaseUrl?.trim()) {
      return config;
    }
    return {
      ...config,
      databaseMode: 'embedded',
      databaseUrl: '',
      lastSuccessfulDbConnectionAt: null,
    };
  }

  private applyPathDefaults(config: DesktopAppConfig): DesktopAppConfig {
    const root = getAppDataRoot();
    return {
      ...config,
      storagePath: config.storagePath || root,
      sessionsPath: config.sessionsPath || path.join(root, 'sessions'),
      mediaPath: config.mediaPath || path.join(root, 'media'),
      logsPath: config.logsPath || path.join(root, 'logs'),
      aiKnowledgePath: config.aiKnowledgePath || path.join(root, 'ai-knowledge'),
    };
  }

  getConfig(): DesktopAppConfig {
    return { ...this.config };
  }

  getMaskedConfig(): Record<string, unknown> {
    return maskSecrets(this.config);
  }

  saveConfig(updates: Partial<DesktopAppConfig>): DesktopAppConfig {
    this.config = this.applyPathDefaults({ ...this.config, ...updates });
    this.save();
    return this.getConfig();
  }

  updateConfig(updates: Partial<DesktopAppConfig>): DesktopAppConfig {
    return this.saveConfig(updates);
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (this.config.setupCompleted) {
      if (this.config.databaseMode === 'external' && !this.config.databaseUrl?.trim()) {
        errors.push('External database URL is required');
      }
      if (!this.config.branchId?.trim()) errors.push('Branch is required');
    }
    return { valid: errors.length === 0, errors };
  }

  resetConfig(): DesktopAppConfig {
    if (fs.existsSync(getConfigPath())) {
      fs.unlinkSync(getConfigPath());
    }
    this.config = this.createDefault();
    return this.config;
  }

  private save(): void {
    const configPath = getConfigPath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const toSave: Record<string, unknown> = { ...this.config };
    for (const key of SENSITIVE_KEYS) {
      const val = toSave[key];
      if (typeof val === 'string' && val) {
        toSave[key] = encryptValue(val);
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf8');
    this.writeAppEnv();
  }

  writeAppEnv(): void {
    const envPath = path.join(getAppDataRoot(), 'config', 'app.env');
    const c = this.config;
    const chromiumPath = resolveChromiumExecutable();
    const dataSqlitePath = getEmbeddedDataSqlitePath(getAppDataRoot());
    const lines = [
      '# Inauzwa CRM Desktop — managed by Electron',
      `APP_DESKTOP_MODE=true`,
      `OPENWA_DATA_ROOT=${getAppDataRoot()}`,
      `PORT=${c.appPort}`,
      `APP_HOST=127.0.0.1`,
      `NODE_ENV=production`,
      ...(c.databaseMode === 'external' && c.databaseUrl?.trim()
        ? [
            `DATABASE_URL=${c.databaseUrl}`,
            'DATABASE_TYPE=postgres',
            'DATABASE_SYNCHRONIZE=false',
          ]
        : [
            'DATABASE_TYPE=sqlite',
            `DATABASE_NAME=${dataSqlitePath}`,
            'DATABASE_SYNCHRONIZE=true',
          ]),
      `DESKTOP_DEVICE_ID=${c.deviceId}`,
      `DESKTOP_SETUP_TOKEN=${c.setupToken}`,
      `SESSION_DATA_PATH=${c.sessionsPath}`,
      `STORAGE_LOCAL_PATH=${c.mediaPath}`,
      `STORAGE_PATH=${c.mediaPath}`,
      `AI_KNOWLEDGE_PATH=${c.aiKnowledgePath}`,
      `AI_MEMORY_PATH=${path.join(getAppDataRoot(), 'ai-memory')}`,
      `LOG_DIR=${c.logsPath}`,
      `ENGINE_TYPE=whatsapp-web.js`,
      `PUPPETEER_HEADLESS=true`,
      `PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox,--disable-dev-shm-usage,--disable-gpu`,
      ...(chromiumPath ? [`PUPPETEER_EXECUTABLE_PATH=${chromiumPath}`] : []),
      `AUTO_START_SESSIONS=true`,
      `REDIS_ENABLED=false`,
      `QUEUE_ENABLED=false`,
      `STORAGE_TYPE=local`,
      `PLUGINS_ENABLED=true`,
      `CORS_ORIGINS=http://127.0.0.1:${c.appPort},http://localhost:${c.appPort}`,
      `ENABLE_SWAGGER=false`,
      `JWT_SECRET=${c.jwtSecret}`,
      `API_MASTER_KEY=${c.apiMasterKey}`,
    ];
    if (c.adminEmail) {
      lines.push(`BOOTSTRAP_ADMIN_EMAIL=${c.adminEmail}`);
    }
    fs.writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
  }

  getAppDataRoot(): string {
    return getAppDataRoot();
  }

  checkStorageWritable(): Record<string, boolean> {
    const checks: Record<string, boolean> = {};
    const paths = [
      ['config', path.join(getAppDataRoot(), 'config')],
      ['sessions', this.config.sessionsPath],
      ['media', this.config.mediaPath],
      ['logs', this.config.logsPath],
      ['ai-knowledge', this.config.aiKnowledgePath],
    ] as const;
    for (const [name, p] of paths) {
      try {
        const test = path.join(p, `.write-test-${Date.now()}`);
        fs.writeFileSync(test, 'ok');
        fs.unlinkSync(test);
        checks[name] = true;
      } catch {
        checks[name] = false;
      }
    }
    return checks;
  }
}
