import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CacheService } from '../../common/cache/cache.service';
import { isProductionEnv } from '../../common/utils/production-security.util';

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
  api: { port: number; baseUrl: string };
  server: InfraServerStatus;
  webhook: InfraWebhookStatus;
  rateLimit: InfraRateLimitStatus;
  database: {
    connected: boolean;
    type: string;
    host: string;
    port: string;
    database: string;
    username: string;
    poolSize: number;
    sslEnabled: boolean;
  };
  redis: { enabled: boolean; connected: boolean; host: string; port: number };
  queue: {
    enabled: boolean;
    messages: { pending: number; completed: number; failed: number };
    webhooks: { pending: number; completed: number; failed: number };
  };
  storage: { type: 'local' | 's3'; path?: string; bucket?: string };
  engine: { type: string; headless: boolean; sessionDataPath: string; browserArgs: string };
}

@Injectable()
export class InfraStatusService {
  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource('main')
    private readonly mainDataSource: DataSource,
    @InjectDataSource('data')
    private readonly dataDataSource: DataSource,
    private readonly cacheService: CacheService,
  ) {}

  async getStatus(): Promise<InfraStatus> {
    const mainDbConnected = this.mainDataSource.isInitialized;
    const dataDbConnected = this.dataDataSource.isInitialized;
    const dbConnected = mainDbConnected && dataDbConnected;
    const dbType = this.configService.get<string>('dataDatabase.type', 'sqlite');
    const dbHost = this.configService.get<string>('dataDatabase.host', 'localhost');

    const redisHost = process.env.REDIS_HOST || this.configService.get<string>('redis.host', 'localhost');
    const redisPort =
      parseInt(process.env.REDIS_PORT || '', 10) || this.configService.get<number>('redis.port', 6379);
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    const queueEnabled = this.configService.get<boolean>('queue.enabled', false);
    const redisConnected = await this.cacheService.isAvailable();

    const storageType = this.configService.get<'local' | 's3'>('storage.type', 'local');
    const storagePath = this.configService.get<string>('storage.localPath', './data/media');
    const engineType = this.configService.get<string>('engine.type', 'whatsapp-web.js');
    const engineHeadless = this.configService.get<boolean>('engine.headless', true);
    const sessionDataPath = this.configService.get<string>('engine.sessionDataPath', './data/sessions');
    const browserArgs = this.configService.get<string>('engine.browserArgs', '--no-sandbox --disable-gpu');
    const apiPort = this.configService.get<number>('port', 2785);
    const apiBaseUrl = (process.env.BASE_URL || process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
    const dashboardUrl = (process.env.DASHBOARD_URL || '').replace(/\/$/, '');
    const corsRaw = process.env.CORS_ORIGINS?.trim();
    const corsOrigins =
      corsRaw ||
      (isProductionEnv() ? '' : '*');
    const rateLimitTtl = process.env.RATE_LIMIT_TTL
      ? parseInt(process.env.RATE_LIMIT_TTL, 10)
      : Math.round(
          parseInt(
            process.env.RATE_LIMIT_MEDIUM_TTL ||
              this.configService.get<string>('api.rateLimit.mediumTtl', '60000'),
            10,
          ) / 1000,
        );

    return {
      api: { port: apiPort, baseUrl: apiBaseUrl || `http://localhost:${apiPort}` },
      server: {
        nodeEnv: isProductionEnv() ? 'production' : 'development',
        domain: process.env.DOMAIN || 'localhost',
        port: String(apiPort),
        dashboardPort: process.env.DASHBOARD_PORT || '2886',
        baseUrl: apiBaseUrl,
        dashboardUrl,
        corsOrigins,
      },
      webhook: {
        timeout: this.configService.get<number>('webhook.timeout', 10000),
        maxRetries: this.configService.get<number>('webhook.maxRetries', 3),
        retryDelay: this.configService.get<number>('webhook.retryDelay', 5000),
      },
      rateLimit: {
        ttl: Number.isFinite(rateLimitTtl) ? rateLimitTtl : 60,
        max: parseInt(
          process.env.RATE_LIMIT_MAX ||
            String(this.configService.get<number>('api.rateLimit.mediumLimit', 200)),
          10,
        ),
      },
      database: {
        connected: dbConnected,
        type: dbType,
        host: dbHost,
        port: String(this.configService.get<number>('dataDatabase.port', 5432)),
        database: this.configService.get<string>('dataDatabase.database', 'openwa'),
        username: this.configService.get<string>('dataDatabase.username', '') || '',
        poolSize: this.configService.get<number>('dataDatabase.poolSize', 10),
        sslEnabled: this.configService.get<boolean>('dataDatabase.ssl', false),
      },
      redis: { enabled: redisEnabled, connected: redisConnected, host: redisHost, port: redisPort },
      queue: {
        enabled: queueEnabled,
        messages: { pending: 0, completed: 0, failed: 0 },
        webhooks: { pending: 0, completed: 0, failed: 0 },
      },
      storage: { type: storageType, path: storagePath, bucket: process.env.S3_BUCKET },
      engine: { type: engineType, headless: engineHeadless, sessionDataPath, browserArgs },
    };
  }
}
