import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ShutdownService } from './common/services/shutdown.service';
import { isSwaggerEnabled, resolveCorsOrigins, isDesktopMode } from './common/utils/production-security.util';
import { applyDatabaseUrlToEnv } from './common/utils/database-url.util';
import {
  applyDesktopPathEnvDefaults,
  ensureDesktopDirectories,
  getDesktopGeneratedEnvPath,
} from './common/utils/desktop-paths.util';
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { applyEnvUpdates, applyEnvFileToProcess, getGeneratedEnvPath, parseEnvFile } from './common/utils/env-file.util';

// Desktop mode: apply path defaults before loading env files
if (process.env.APP_DESKTOP_MODE === 'true') {
  applyDesktopPathEnvDefaults();
  if (process.env.DATABASE_URL) {
    applyDatabaseUrlToEnv(process.env.DATABASE_URL);
  }
  if (!process.env.PORT) {
    process.env.PORT = process.env.APP_PORT || '2886';
  }
  if (!process.env.APP_HOST) {
    process.env.APP_HOST = '127.0.0.1';
  }
  if (!process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS = `http://127.0.0.1:${process.env.PORT},http://localhost:${process.env.PORT}`;
  }
  if (!process.env.ENABLE_SWAGGER) {
    process.env.ENABLE_SWAGGER = 'false';
  }
}

const generatedEnvPath = getGeneratedEnvPath();
const userEnvPath = path.resolve(process.cwd(), '.env');

// Ensure config directory exists
const dataDir = path.dirname(generatedEnvPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (isDesktopMode()) {
  ensureDesktopDirectories();
}

// User-managed .env (does not override real process env) — skip in desktop packaged builds
if (!isDesktopMode() && fs.existsSync(userEnvPath)) {
  console.log('[Bootstrap] Loading .env from:', userEnvPath);
  dotenv.config({ path: userEnvPath, override: false });
}

if (fs.existsSync(generatedEnvPath)) {
  console.log('[Bootstrap] Loading saved configuration from:', generatedEnvPath);
  const generatedContent = fs.readFileSync(generatedEnvPath, 'utf8');
  if (!parseEnvFile(generatedContent).has('ENGINE_TYPE')) {
    applyEnvUpdates(generatedEnvPath, {
      ENGINE_TYPE: process.env.ENGINE_TYPE || 'whatsapp-web.js',
    });
    console.log('[Bootstrap] Backfilled ENGINE_TYPE in saved configuration');
  }
  dotenv.config({ path: generatedEnvPath, override: false });
  if (isDesktopMode()) {
    // dotenv can mishandle unquoted paths with spaces; re-apply with full-line parsing.
    applyEnvFileToProcess(generatedEnvPath, { override: true });
  }
  if (isDesktopMode() && process.env.DATABASE_URL) {
    applyDatabaseUrlToEnv(process.env.DATABASE_URL);
  }
} else if (!isDesktopMode()) {
  console.log('[Bootstrap] First run detected, creating default configuration...');
  const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_PATH=./data/media

# WhatsApp Engine
ENGINE_TYPE=whatsapp-web.js
SESSION_DATA_PATH=./data/sessions
PUPPETEER_HEADLESS=true
PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox

# Docker Profiles: none (minimal setup)
`;
  fs.writeFileSync(generatedEnvPath, minimalConfig);
  console.log('[Bootstrap] Created default configuration at:', generatedEnvPath);
  dotenv.config({ path: generatedEnvPath, override: false });
} else {
  console.log('[Bootstrap] Desktop mode — waiting for Electron-managed app.env');
}

applyDesktopPathEnvDefaults();

function isHashedAssetPath(urlPath: string): boolean {
  return urlPath.startsWith('/assets/') || /\.[a-zA-Z0-9]{2,8}$/.test(urlPath);
}

function mountDesktopStatic(app: NestExpressApplication): void {
  const staticPath = process.env.DESKTOP_STATIC_PATH;
  if (!staticPath || !fs.existsSync(staticPath)) {
    console.warn('[Bootstrap] DESKTOP_STATIC_PATH not found — dashboard static files unavailable');
    return;
  }
  const expressApp = app.getHttpAdapter().getInstance() as express.Application;
  expressApp.use(
    express.static(staticPath, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(`${path.sep}index.html`)) {
          res.setHeader('Cache-Control', 'no-cache');
          return;
        }
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );
  expressApp.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    const filePath = path.join(staticPath, req.path);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    // Missing hashed bundles must not be served as HTML — that breaks module/CSS MIME checks.
    if (isHashedAssetPath(req.path)) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  console.log('[Bootstrap] Serving dashboard static files from:', staticPath);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableShutdownHooks();

  const shutdownService = app.get(ShutdownService);
  shutdownService.setShutdownCallback(async () => {
    await app.close();
  });

  const desktopCsp = isDesktopMode();
  const connectSrc = desktopCsp
    ? [
        "'self'",
        'http://127.0.0.1:*',
        'http://localhost:*',
        'ws://127.0.0.1:*',
        'ws://localhost:*',
        'wss://127.0.0.1:*',
        'wss://localhost:*',
        // Avatar/media CDN fetch + cache (InboxContactAvatar, WhatsApp profile URLs)
        'https://*.whatsapp.net',
        'https://*.whatsapp.com',
      ]
    : ["'self'"];

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: desktopCsp ? ["'self'", 'data:', 'https:', 'blob:'] : ["'self'", 'data:', 'https:'],
          mediaSrc: desktopCsp ? ["'self'", 'data:', 'https:', 'blob:'] : ["'self'", 'data:', 'https:'],
          connectSrc,
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' && !isDesktopMode() ? [] : null,
        },
      },
      ...(isDesktopMode()
        ? {}
        : {
            hsts: {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            },
          }),
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = resolveCorsOrigins();
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) {
        return callback(new Error('Not allowed by CORS'));
      }
      if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'X-API-Key',
      'Authorization',
      'X-Request-ID',
      'X-Desktop-Setup-Token',
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  if (isDesktopMode()) {
    mountDesktopStatic(app);
  }

  const port = parseInt(process.env.PORT || (isDesktopMode() ? '2886' : '2785'), 10);
  const host = isDesktopMode() ? process.env.APP_HOST || '127.0.0.1' : '0.0.0.0';

  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('OpenWA API')
      .setDescription('Open Source WhatsApp API Gateway - Free, Self-Hosted HTTP API')
      .setVersion('0.1.6')
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'X-API-Key')
      .addTag('sessions', 'WhatsApp session management')
      .addTag('messages', 'Send and manage messages')
      .addTag('webhooks', 'Webhook configuration')
      .addTag('contacts', 'Contact management')
      .addTag('groups', 'Group management')
      .addTag('labels', 'Label management (WhatsApp Business)')
      .addTag('channels', 'Channel/Newsletter management')
      .addTag('health', 'Health check endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port, host);

  const label = isDesktopMode() ? 'Inauzwa CRM (desktop)' : 'OpenWA';
  console.log(`🚀 ${label} is running on: http://${host}:${port}`);
  if (isSwaggerEnabled()) {
    console.log(`📚 Swagger docs: http://${host}:${port}/api/docs`);
  }
}

void bootstrap();
