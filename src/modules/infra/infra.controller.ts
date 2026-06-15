import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  BadRequestException,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Request } from 'express';
import { Public, RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { resolveControlledImportFile, toRelativeDataPath } from '../../common/utils/safe-import-path.util';
import { persistDashboardEnvUpdates } from '../../common/utils/env-file.util';
import { EngineFactory } from '../../engine/engine.factory';
import { DockerService } from '../docker';
import { CacheService } from '../../common/cache/cache.service';
import { StorageService } from '../../common/storage/storage.service';
import { ShutdownService } from '../../common/services/shutdown.service';
import { InfraStatusService } from './infra-status.service';
import { createLogger } from '../../common/services/logger.service';
import { isDesktopMode } from '../../common/utils/desktop-paths.util';
import * as fs from 'fs';
import * as path from 'path';

interface SaveConfigDto {
  server?: {
    nodeEnv?: 'production' | 'development';
    domain?: string;
    port?: string;
    dashboardPort?: string;
    baseUrl?: string;
    dashboardUrl?: string;
    corsOrigins?: string;
  };
  webhook?: {
    timeout?: number;
    maxRetries?: number;
    retryDelay?: number;
  };
  rateLimit?: {
    ttl?: number;
    max?: number;
  };
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

// Database migration types for export/import
interface SessionRow {
  id: string;
  name: string;
  status: string;
  phone: string | null;
  pushName: string | null;
  config: string | Record<string, unknown>;
  proxyUrl: string | null;
  proxyType: string | null;
  connectedAt: string | null;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface WebhookRow {
  id: string;
  sessionId: string;
  url: string;
  events: string | string[];
  secret: string | null;
  headers: string | Record<string, string>;
  active: boolean;
  retryCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  sessionId: string;
  messageId: string;
  chatId: string;
  direction: string;
  type: string;
  content: string | Record<string, unknown>;
  status: string;
  metadata: string | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface MessageBatchRow {
  id: string;
  batchId: string;
  sessionId: string;
  status: string;
  messages: string | unknown[];
  options: string | Record<string, unknown>;
  progress: string | Record<string, unknown>;
  results: string | unknown[];
  currentIndex: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface MigrationTables {
  sessions: SessionRow[];
  webhooks: WebhookRow[];
  messages: MessageRow[];
  messageBatches: MessageBatchRow[];
}

type AuthedRequest = Request & { apiKey?: ApiKey };

@ApiTags('infrastructure')
@Controller('infra')
@RequireRole(ApiKeyRole.ADMIN)
export class InfraController {
  private readonly logger = createLogger('InfraController');

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource('main')
    private readonly mainDataSource: DataSource,
    @InjectDataSource('data')
    private readonly dataDataSource: DataSource,
    private readonly engineFactory: EngineFactory,
    private readonly dockerService: DockerService,
    private readonly cacheService: CacheService,
    private readonly storageService: StorageService,
    private readonly shutdownService: ShutdownService,
    private readonly infraStatusService: InfraStatusService,
    private readonly auditService: AuditService,
  ) {}

  private auditContext(req: AuthedRequest, metadata?: Record<string, unknown>) {
    return {
      apiKey: req.apiKey,
      ipAddress: req.ip || req.socket.remoteAddress || undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
      method: req.method,
      path: req.path,
      metadata,
    };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get infrastructure status' })
  @ApiResponse({ status: 200, description: 'Infrastructure status' })
  getStatus() {
    return this.infraStatusService.getStatus();
  }

  @Get('engines')
  @ApiOperation({ summary: 'Get available WhatsApp engines' })
  @ApiResponse({ status: 200, description: 'List of available engines' })
  getEngines(): Array<{ id: string; name: string; enabled: boolean; features: string[] }> {
    return this.engineFactory.getAvailableEngines();
  }

  @Get('engines/current')
  @ApiOperation({ summary: 'Get current active engine' })
  @ApiResponse({ status: 200, description: 'Current engine info' })
  getCurrentEngine(): { engineType: string } {
    return { engineType: this.engineFactory.getCurrentEngine() };
  }

  @Put('config')
  @ApiOperation({ summary: 'Save infrastructure configuration to .env file' })
  @ApiResponse({ status: 200, description: 'Configuration saved' })
  @ApiBody({ description: 'Configuration to save' })
  async saveConfig(
    @Body() config: SaveConfigDto,
    @Req() req: AuthedRequest,
  ): Promise<{ message: string; saved: boolean; envPath: string; profiles: string[] }> {
    if (isDesktopMode()) {
      throw new BadRequestException(
        'Infrastructure settings are managed automatically by the desktop app.',
      );
    }
    try {
      const profiles: string[] = [];
      const updates: Record<string, string> = {};

      if (config.database) {
        updates.DATABASE_TYPE = config.database.type || 'sqlite';
        updates.POSTGRES_BUILTIN = config.database.builtIn ? 'true' : 'false';
        if (config.database.type === 'postgres') {
          if (config.database.builtIn) {
            updates.DATABASE_HOST = 'postgres';
            updates.DATABASE_PORT = '5432';
            updates.DATABASE_USERNAME = 'openwa';
            updates.DATABASE_PASSWORD = 'openwa';
            updates.DATABASE_NAME = 'openwa';
            profiles.push('postgres');
          } else {
            updates.DATABASE_HOST = config.database.host || 'localhost';
            updates.DATABASE_PORT = config.database.port || '5432';
            updates.DATABASE_USERNAME = config.database.username || 'postgres';
            updates.DATABASE_PASSWORD = config.database.password || '';
            updates.DATABASE_NAME = config.database.database || 'openwa';
          }
          updates.DATABASE_POOL_SIZE = String(config.database.poolSize || 10);
          updates.DATABASE_SSL = config.database.sslEnabled ? 'true' : 'false';
        }
      }

      if (config.redis !== undefined || config.queue !== undefined) {
        updates.REDIS_ENABLED = config.redis?.enabled ? 'true' : 'false';
        updates.REDIS_BUILTIN = config.redis?.builtIn ? 'true' : 'false';
        updates.QUEUE_ENABLED = config.queue?.enabled ? 'true' : 'false';
        if (config.redis?.enabled) {
          if (config.redis.builtIn) {
            updates.REDIS_HOST = 'redis';
            updates.REDIS_PORT = '6379';
            profiles.push('redis');
          } else {
            updates.REDIS_HOST = config.redis.host || 'localhost';
            updates.REDIS_PORT = config.redis.port || '6379';
            if (config.redis.password) updates.REDIS_PASSWORD = config.redis.password;
          }
        }
      }

      if (config.server) {
        if (config.server.nodeEnv) updates.NODE_ENV = config.server.nodeEnv;
        if (config.server.domain !== undefined) updates.DOMAIN = config.server.domain;
        if (config.server.port) updates.PORT = config.server.port;
        if (config.server.dashboardPort) updates.DASHBOARD_PORT = config.server.dashboardPort;
        if (config.server.baseUrl !== undefined) updates.BASE_URL = config.server.baseUrl;
        if (config.server.dashboardUrl !== undefined) updates.DASHBOARD_URL = config.server.dashboardUrl;
        if (config.server.corsOrigins !== undefined) updates.CORS_ORIGINS = config.server.corsOrigins;
      }

      if (config.webhook) {
        if (config.webhook.timeout !== undefined) updates.WEBHOOK_TIMEOUT = String(config.webhook.timeout);
        if (config.webhook.maxRetries !== undefined) updates.WEBHOOK_MAX_RETRIES = String(config.webhook.maxRetries);
        if (config.webhook.retryDelay !== undefined) updates.WEBHOOK_RETRY_DELAY = String(config.webhook.retryDelay);
      }

      if (config.rateLimit) {
        if (config.rateLimit.ttl !== undefined) {
          updates.RATE_LIMIT_TTL = String(config.rateLimit.ttl);
          updates.RATE_LIMIT_MEDIUM_TTL = String(config.rateLimit.ttl * 1000);
        }
        if (config.rateLimit.max !== undefined) {
          updates.RATE_LIMIT_MAX = String(config.rateLimit.max);
          updates.RATE_LIMIT_MEDIUM_LIMIT = String(config.rateLimit.max);
        }
      }

      if (config.storage) {
        updates.STORAGE_TYPE = config.storage.type || 'local';
        updates.MINIO_BUILTIN = config.storage.builtIn ? 'true' : 'false';
        if (config.storage.type === 'local') {
          updates.STORAGE_LOCAL_PATH = config.storage.localPath || './data/media';
        } else if (config.storage.type === 's3') {
          if (config.storage.builtIn) {
            updates.S3_ENDPOINT = 'http://minio:9000';
            updates.S3_ACCESS_KEY = 'minioadmin';
            updates.S3_SECRET_KEY = 'minioadmin';
            updates.S3_BUCKET = 'openwa';
            updates.S3_REGION = 'us-east-1';
            profiles.push('minio');
          } else {
            updates.S3_BUCKET = config.storage.s3Bucket || '';
            updates.S3_REGION = config.storage.s3Region || 'ap-southeast-1';
            updates.S3_ACCESS_KEY = config.storage.s3AccessKey || '';
            updates.S3_SECRET_KEY = config.storage.s3SecretKey || '';
            if (config.storage.s3Endpoint) updates.S3_ENDPOINT = config.storage.s3Endpoint;
          }
        }
      }

      if (config.engine) {
        updates.ENGINE_TYPE = config.engine.type || 'whatsapp-web.js';
        updates.SESSION_DATA_PATH = config.engine.sessionDataPath || './data/sessions';
        updates.PUPPETEER_HEADLESS = config.engine.headless !== false ? 'true' : 'false';
        updates.PUPPETEER_ARGS = (config.engine.browserArgs || '--no-sandbox,--disable-setuid-sandbox')
          .split(/[,\s]+/)
          .map(s => s.trim())
          .filter(Boolean)
          .join(',');
      }

      const envPath = persistDashboardEnvUpdates(updates);
      const relativeEnvPath = toRelativeDataPath(envPath);
      this.logger.log('Configuration saved', { envPath: relativeEnvPath });

      await this.auditService.logInfo(
        AuditAction.INFRA_CONFIG_SAVED,
        this.auditContext(req, { profiles, envPath: relativeEnvPath }),
      );

      const profileMsg = profiles.length > 0 ? ` Docker profiles required: ${profiles.join(', ')}.` : '';

      return {
        message: `Configuration saved successfully.${profileMsg} Server restart required to apply changes.`,
        saved: true,
        envPath: relativeEnvPath,
        profiles,
      };
    } catch (error) {
      return {
        message: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        saved: false,
        envPath: '',
        profiles: [],
      };
    }
  }
  @Post('restart')
  @ApiOperation({ summary: 'Request server restart with Docker orchestration' })
  @ApiResponse({ status: 200, description: 'Server will restart with new profiles' })
  async requestRestart(
    @Body() body: { profiles?: string[]; profilesToRemove?: string[] } | undefined,
    @Req() req: AuthedRequest,
  ): Promise<{
    message: string;
    restarting: boolean;
    profiles: string[];
    profilesToRemove: string[];
    estimatedTime: number;
    orchestration?: object;
    removal?: object;
  }> {
    const profiles = body?.profiles || [];
    const profilesToRemove = body?.profilesToRemove || [];
    let orchestrationResult: object | undefined;
    let removalResult: { removed: string[]; errors: string[] } | undefined;

    this.logger.log('Restart requested', { profiles });
    this.logger.log('Profiles to remove', { profilesToRemove });

    // If profiles are specified, orchestrate Docker containers
    if (this.dockerService.isDockerAvailable()) {
      // First, remove containers for disabled services
      if (profilesToRemove.length > 0) {
        this.logger.log('Removing disabled profiles...');
        removalResult = { removed: [], errors: [] };

        for (const profile of profilesToRemove) {
          try {
            const success = await this.dockerService.removeService(profile);
            if (success) {
              removalResult.removed.push(profile);
            } else {
              removalResult.errors.push(`Failed to remove ${profile}`);
            }
          } catch (err) {
            removalResult.errors.push(`Error removing ${profile}: ${err}`);
          }
        }
        this.logger.log('Removal result', { removalResult });
      }

      // Then, start containers for enabled services
      if (profiles.length > 0) {
        this.logger.log('Orchestrating enabled profiles...');
        orchestrationResult = await this.dockerService.orchestrateProfiles(profiles);
        this.logger.log('Orchestration result', { orchestrationResult });
      }
    } else {
      this.logger.warn('Docker not available, writing signal file instead');
      // Fallback: write signal file for host script
      try {
        const signalFile = path.resolve(process.cwd(), 'data', '.orchestration-request.json');
        const orchestrationRequest = {
          timestamp: new Date().toISOString(),
          profiles,
          profilesToRemove,
          action: 'restart-with-profiles',
        };
        fs.writeFileSync(signalFile, JSON.stringify(orchestrationRequest, null, 2), 'utf8');
        this.logger.log('Orchestration request written', { signalFile });
      } catch (err) {
        this.logger.error('Failed to write orchestration request', err instanceof Error ? err.message : String(err));
      }
    }

    await this.auditService.logInfo(
      AuditAction.INFRA_RESTART_REQUESTED,
      this.auditContext(req, {
        profiles,
        profilesToRemove,
        dockerAvailable: this.dockerService.isDockerAvailable(),
      }),
    );

    // Schedule graceful shutdown after delay to allow response and container orchestration
    void this.shutdownService.shutdown(3000);

    // Calculate estimated time - base 15s + additional for each service (increased for reliability)
    let estimatedTime = 15;
    if (profiles.includes('postgres')) estimatedTime += 20;
    if (profiles.includes('redis')) estimatedTime += 13;
    if (profiles.includes('minio')) estimatedTime += 15;
    if (profilesToRemove.length > 0) estimatedTime += profilesToRemove.length * 5; // +5s per removal

    return {
      message:
        profiles.length > 0 || profilesToRemove.length > 0
          ? `Server is restarting. Enabling: ${profiles.join(', ') || 'none'}. Disabling: ${profilesToRemove.join(', ') || 'none'}.`
          : 'Server is restarting. Please wait...',
      restarting: true,
      profiles,
      profilesToRemove,
      estimatedTime,
      orchestration: orchestrationResult,
      removal: removalResult,
    };
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Server is healthy' })
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('export-data')
  @ApiOperation({ summary: 'Export all data from Data DB for migration' })
  @ApiResponse({ status: 200, description: 'Exported data as JSON' })
  async exportData(@Req() req: AuthedRequest): Promise<{
    exportedAt: string;
    dataDbType: string;
    tables: MigrationTables;
    counts: { sessions: number; webhooks: number; messages: number; messageBatches: number };
  }> {
    // Get all entities from Data DB
    const sessions = await this.dataDataSource.query<SessionRow[]>('SELECT * FROM sessions');
    const webhooks = await this.dataDataSource.query<WebhookRow[]>('SELECT * FROM webhooks');

    // Messages table may not exist yet or be empty
    let messages: MessageRow[] = [];
    let messageBatches: MessageBatchRow[] = [];

    try {
      messages = await this.dataDataSource.query<MessageRow[]>('SELECT * FROM messages');
    } catch (error) {
      this.logger.debug('Messages table not available for export', { error: String(error) });
    }

    try {
      messageBatches = await this.dataDataSource.query<MessageBatchRow[]>('SELECT * FROM message_batches');
    } catch (error) {
      this.logger.debug('Message batches table not available for export', { error: String(error) });
    }

    await this.auditService.logInfo(
      AuditAction.INFRA_DATA_EXPORTED,
      this.auditContext(req, {
        counts: {
          sessions: sessions.length,
          webhooks: webhooks.length,
          messages: messages.length,
          messageBatches: messageBatches.length,
        },
      }),
    );

    return {
      exportedAt: new Date().toISOString(),
      dataDbType: this.configService.get<string>('dataDatabase.type', 'sqlite'),
      tables: {
        sessions,
        webhooks,
        messages,
        messageBatches,
      },
      counts: {
        sessions: sessions.length,
        webhooks: webhooks.length,
        messages: messages.length,
        messageBatches: messageBatches.length,
      },
    };
  }

  @Post('import-data')
  @ApiOperation({ summary: 'Import data to Data DB (replaces existing data)' })
  @ApiBody({
    description: 'Exported data from export-data endpoint',
    schema: {
      type: 'object',
      properties: {
        tables: {
          type: 'object',
          properties: {
            sessions: { type: 'array' },
            webhooks: { type: 'array' },
            messages: { type: 'array' },
            messageBatches: { type: 'array' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Data imported successfully' })
  async importData(
    @Body()
    data: {
      tables: Partial<MigrationTables>;
    },
    @Req() req: AuthedRequest,
  ): Promise<{
    imported: boolean;
    counts: { sessions: number; webhooks: number; messages: number; messageBatches: number };
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const queryRunner = this.dataDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Clear existing data (in correct order due to foreign keys)
      await queryRunner.query('DELETE FROM webhooks');
      await queryRunner.query('DELETE FROM messages').catch(() => {});
      await queryRunner.query('DELETE FROM message_batches').catch(() => {});
      await queryRunner.query('DELETE FROM sessions');

      // Import sessions first
      let sessionsCount = 0;
      if (data.tables.sessions?.length) {
        for (const session of data.tables.sessions) {
          try {
            await queryRunner.query(
              `INSERT INTO sessions (id, name, status, phone, "pushName", config, "proxyUrl", "proxyType", "connectedAt", "lastActiveAt", "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
              [
                session.id,
                session.name,
                session.status,
                session.phone,
                session.pushName,
                typeof session.config === 'string' ? session.config : JSON.stringify(session.config || {}),
                session.proxyUrl,
                session.proxyType,
                session.connectedAt,
                session.lastActiveAt,
                session.createdAt,
                session.updatedAt,
              ],
            );
            sessionsCount++;
          } catch (err) {
            warnings.push(`Failed to import session ${session.id}: ${err}`);
          }
        }
      }

      // Import webhooks
      let webhooksCount = 0;
      if (data.tables.webhooks?.length) {
        for (const webhook of data.tables.webhooks) {
          try {
            await queryRunner.query(
              `INSERT INTO webhooks (id, "sessionId", url, events, secret, headers, active, "retryCount", "lastTriggeredAt", "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                webhook.id,
                webhook.sessionId,
                webhook.url,
                typeof webhook.events === 'string' ? webhook.events : JSON.stringify(webhook.events || []),
                webhook.secret,
                typeof webhook.headers === 'string' ? webhook.headers : JSON.stringify(webhook.headers || {}),
                webhook.active,
                webhook.retryCount,
                webhook.lastTriggeredAt,
                webhook.createdAt,
                webhook.updatedAt,
              ],
            );
            webhooksCount++;
          } catch (err) {
            warnings.push(`Failed to import webhook ${webhook.id}: ${err}`);
          }
        }
      }

      // Import messages (optional)
      let messagesCount = 0;
      if (data.tables.messages?.length) {
        for (const msg of data.tables.messages) {
          try {
            await queryRunner.query(
              `INSERT INTO messages (id, "sessionId", "messageId", "chatId", direction, type, content, status, metadata, "createdAt", "updatedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                msg.id,
                msg.sessionId,
                msg.messageId,
                msg.chatId,
                msg.direction,
                msg.type,
                typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || {}),
                msg.status,
                typeof msg.metadata === 'string' ? msg.metadata : JSON.stringify(msg.metadata || {}),
                msg.createdAt,
                msg.updatedAt,
              ],
            );
            messagesCount++;
          } catch (err) {
            warnings.push(`Failed to import message ${msg.id}: ${err}`);
          }
        }
      }

      // Import message batches (optional)
      let messageBatchesCount = 0;
      if (data.tables.messageBatches?.length) {
        for (const batch of data.tables.messageBatches) {
          try {
            await queryRunner.query(
              `INSERT INTO message_batches (id, "batchId", "sessionId", status, messages, options, progress, results, "currentIndex", "createdAt", "updatedAt", "startedAt", "completedAt") 
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                batch.id,
                batch.batchId,
                batch.sessionId,
                batch.status,
                typeof batch.messages === 'string' ? batch.messages : JSON.stringify(batch.messages || []),
                typeof batch.options === 'string' ? batch.options : JSON.stringify(batch.options || {}),
                typeof batch.progress === 'string' ? batch.progress : JSON.stringify(batch.progress || {}),
                typeof batch.results === 'string' ? batch.results : JSON.stringify(batch.results || []),
                batch.currentIndex,
                batch.createdAt,
                batch.updatedAt,
                batch.startedAt,
                batch.completedAt,
              ],
            );
            messageBatchesCount++;
          } catch (err) {
            warnings.push(`Failed to import message batch ${batch.id}: ${err}`);
          }
        }
      }

      await queryRunner.commitTransaction();

      await this.auditService.logInfo(
        AuditAction.INFRA_DATA_IMPORTED,
        this.auditContext(req, {
          counts: {
            sessions: sessionsCount,
            webhooks: webhooksCount,
            messages: messagesCount,
            messageBatches: messageBatchesCount,
          },
          warningCount: warnings.length,
        }),
      );

      return {
        imported: true,
        counts: {
          sessions: sessionsCount,
          webhooks: webhooksCount,
          messages: messagesCount,
          messageBatches: messageBatchesCount,
        },
        warnings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ============================================================================
  // STORAGE MIGRATION API
  // ============================================================================

  @Get('storage/files/count')
  @ApiOperation({ summary: 'Get file count in current storage' })
  @ApiResponse({ status: 200, description: 'File count and size' })
  async getStorageFileCount(): Promise<{
    storageType: string;
    count: number;
    sizeBytes: number;
    sizeMB: string;
  }> {
    const { count, sizeBytes } = await this.storageService.getFileCount();
    return {
      storageType: this.storageService.getCurrentStorageType(),
      count,
      sizeBytes,
      sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
    };
  }

  @Get('storage/export')
  @ApiOperation({ summary: 'Export all storage files as tar.gz' })
  @ApiResponse({ status: 200, description: 'Tar.gz archive stream' })
  async exportStorage(@Req() req: AuthedRequest): Promise<{ message: string; download: string }> {
    const stream = await this.storageService.createExportStream();
    const exportsDir = path.join(process.cwd(), 'data', 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    const fileName = `storage-export-${Date.now()}.tar.gz`;
    const exportPath = path.join(exportsDir, fileName);

    const writeStream = fs.createWriteStream(exportPath);
    stream.pipe(writeStream);

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const relativeDownload = toRelativeDataPath(exportPath);
    await this.auditService.logInfo(
      AuditAction.INFRA_STORAGE_EXPORTED,
      this.auditContext(req, { download: relativeDownload }),
    );

    return {
      message: 'Storage export completed',
      download: relativeDownload,
    };
  }

  @Post('storage/import-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const name = path.basename(file.originalname || '');
        if (!name.endsWith('.tar.gz')) {
          cb(new BadRequestException('Only .tar.gz archives are allowed') as Error, false);
          return;
        }
        cb(null, true);
      },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'data', 'imports');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, file, cb) => {
          const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
          cb(null, safe);
        },
      }),
    }),
  )
  @ApiOperation({ summary: 'Upload and import storage archive (tar.gz)' })
  @ApiResponse({ status: 200, description: 'Import result' })
  async importStorageUpload(
    @UploadedFile() file: { path: string; originalname: string; size: number } | undefined,
    @Req() req: AuthedRequest,
  ): Promise<{ imported: boolean; count: number; storageType: string; fileName: string }> {
    if (!file?.path) {
      throw new BadRequestException('file is required (.tar.gz)');
    }

    const readStream = fs.createReadStream(file.path);
    const count = await this.storageService.importFromStream(readStream);

    await this.auditService.logInfo(
      AuditAction.INFRA_STORAGE_IMPORTED,
      this.auditContext(req, {
        fileName: path.basename(file.originalname),
        count,
        method: 'upload',
      }),
    );

    return {
      imported: true,
      count,
      storageType: this.storageService.getCurrentStorageType(),
      fileName: path.basename(file.originalname),
    };
  }

  @Post('storage/import')
  @ApiOperation({ summary: 'Import storage files from tar.gz in data/imports' })
  @ApiBody({
    description: 'File name of tar.gz inside data/imports (not an absolute path)',
    schema: { type: 'object', properties: { fileName: { type: 'string' } } },
  })
  @ApiResponse({ status: 200, description: 'Import result' })
  async importStorage(
    @Body() body: { fileName?: string; filePath?: string },
    @Req() req: AuthedRequest,
  ): Promise<{ imported: boolean; count: number; storageType: string }> {
    const fileName = body.fileName ?? (body.filePath ? path.basename(body.filePath) : '');
    if (!fileName) {
      throw new BadRequestException('fileName is required');
    }

    const resolved = resolveControlledImportFile(fileName);
    if (!fs.existsSync(resolved)) {
      throw new NotFoundException(`Import file not found: ${fileName}`);
    }

    const readStream = fs.createReadStream(resolved);
    const count = await this.storageService.importFromStream(readStream);

    await this.auditService.logInfo(
      AuditAction.INFRA_STORAGE_IMPORTED,
      this.auditContext(req, { fileName, count }),
    );

    return {
      imported: true,
      count,
      storageType: this.storageService.getCurrentStorageType(),
    };
  }
}
