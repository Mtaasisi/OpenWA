import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DesktopDevice } from './entities/desktop-device.entity';
import { Session, SessionStatus } from '../session/entities/session.entity';
import {
  applyDatabaseUrlToEnv,
  maskDatabaseUrl,
  parseDatabaseUrl,
} from '../../common/utils/database-url.util';
import {
  getDesktopDataSqlitePath,
  getDesktopPathStatus,
  isDesktopMode,
  pathExistsAndWritable,
  resolveDesktopPath,
} from '../../common/utils/desktop-paths.util';
import { UserService } from '../auth/user.service';
import { AiProfileService } from '../ai/ai-profile.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { CreateAdminDto, RegisterDeviceDto, SetupBranchDto } from './dto/desktop.dto';

const STARTED_AT = Date.now();

@Injectable()
export class DesktopService {
  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    @InjectRepository(DesktopDevice, 'data')
    private readonly deviceRepo: Repository<DesktopDevice>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    private readonly userService: UserService,
    private readonly aiProfileService: AiProfileService,
    private readonly whatsappSafetySettings: WhatsAppSafetySettingsService,
  ) {}

  getAppVersion(): string {
    try {
      const pkg = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
      ) as { version?: string };
      return pkg.version || '0.0.0';
    } catch {
      return process.env.npm_package_version || '0.1.6';
    }
  }

  async testDatabaseConnection(databaseUrl?: string): Promise<{
    ok: boolean;
    message: string;
    maskedUrl?: string;
    pendingMigrations?: number;
    pgvectorInstalled?: boolean;
    pgvectorWarning?: string;
  }> {
    const dbType = process.env.DATABASE_TYPE || 'sqlite';
    if (!databaseUrl?.trim() && dbType === 'sqlite' && isDesktopMode()) {
      const sqlitePath = process.env.DATABASE_NAME || getDesktopDataSqlitePath();
      try {
        if (this.dataSource.isInitialized) {
          await this.dataSource.query('SELECT 1');
        }
        return {
          ok: true,
          message: 'Local database ready',
          maskedUrl: sqlitePath,
        };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Local database is not ready',
          maskedUrl: sqlitePath,
        };
      }
    }

    const url = databaseUrl?.trim() || process.env.DATABASE_URL;
    if (!url) {
      return { ok: false, message: 'Database URL is required' };
    }

    let parsed;
    try {
      parsed = parseDatabaseUrl(url);
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Invalid database URL',
      };
    }

    const testDs = new DataSource({
      type: 'postgres',
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password: parsed.password,
      database: parsed.database,
      ssl: parsed.ssl
        ? { rejectUnauthorized: parsed.sslRejectUnauthorized }
        : false,
      connectTimeoutMS: 15000,
    });

    try {
      await testDs.initialize();
      await testDs.query('SELECT 1');
      const hasPendingMigrations = await testDs.showMigrations();
      const pgvectorInstalled = await this.checkPgvectorExtension(testDs);
      await testDs.destroy();
      const pgvectorWarning = pgvectorInstalled
        ? undefined
        : 'pgvector extension is not enabled. Enable it in Neon (CREATE EXTENSION vector) for full AI memory search.';
      return {
        ok: true,
        message: pgvectorInstalled
          ? 'Database connection successful'
          : 'Database connected — enable pgvector in Neon for AI memory features',
        maskedUrl: maskDatabaseUrl(url),
        pendingMigrations: hasPendingMigrations ? 1 : 0,
        pgvectorInstalled,
        pgvectorWarning,
      };
    } catch (err) {
      try {
        await testDs.destroy();
      } catch {
        // ignore
      }
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Database connection failed. Check internet or Neon settings.',
        maskedUrl: maskDatabaseUrl(url),
      };
    }
  }

  async runMigrations(databaseUrl?: string): Promise<{ ok: boolean; message: string }> {
    if (databaseUrl?.trim()) {
      applyDatabaseUrlToEnv(databaseUrl);
    }

    const dbType = process.env.DATABASE_TYPE || 'sqlite';
    if (dbType === 'sqlite' && isDesktopMode()) {
      const test = await this.testDatabaseConnection();
      if (!test.ok) {
        throw new BadRequestException(test.message);
      }
      return { ok: true, message: 'Local database ready' };
    }

    if (dbType !== 'postgres') {
      throw new BadRequestException('Desktop external database mode requires PostgreSQL');
    }

    const test = await this.testDatabaseConnection();
    if (!test.ok) {
      throw new BadRequestException(test.message);
    }

    try {
      const hasPending = await this.dataSource.showMigrations();
      if (hasPending) {
        await this.dataSource.runMigrations();
      }
      return { ok: true, message: 'Migrations applied successfully' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Migration failed',
      };
    }
  }

  async seedDefaults(): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    const profilesSeeded = await this.aiProfileService.seedDefaultProfilesIfMissing();
    results.branchProfilesSeeded = profilesSeeded;

    try {
      await this.whatsappSafetySettings.getGlobal();
      results.whatsappSafety = 'ok';
    } catch {
      results.whatsappSafety = 'initialized';
    }

    return results;
  }

  async getAdminSetupStatus(): Promise<{
    hasUsers: boolean;
    users: Array<{ email: string; name: string }>;
  }> {
    const users = await this.userService.findAll();
    return {
      hasUsers: users.length > 0,
      users: users.map(u => ({ email: u.email, name: u.name })),
    };
  }

  async saveAdminAccount(dto: CreateAdminDto): Promise<{
    ok: boolean;
    created: boolean;
    updated?: boolean;
    email?: string;
    message: string;
  }> {
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password?.trim();
    if (!email) {
      return { ok: false, created: false, message: 'Email is required' };
    }
    if (!password || password.length < 8) {
      return { ok: false, created: false, message: 'Password must be at least 8 characters' };
    }

    const users = await this.userService.findAll();
    if (users.length === 0) {
      try {
        const user = await this.userService.createUser({
          email,
          password,
          name: dto.name || 'Admin',
          role: ApiKeyRole.ADMIN,
        });
        return {
          ok: true,
          created: true,
          email: user.email,
          message: 'Admin created. Use this email and password to sign in.',
        };
      } catch (err) {
        if (err instanceof ConflictException) {
          return { ok: false, created: false, message: 'Email already registered' };
        }
        throw err;
      }
    }

    const existing = await this.userService.findByEmail(email);
    if (!existing) {
      return {
        ok: false,
        created: false,
        message: `Admin already exists (${users[0]?.email}). Enter that email to set a new password, or sign in with it.`,
      };
    }

    await this.userService.updateUser(existing.id, { password });
    return {
      ok: true,
      created: false,
      updated: true,
      email: existing.email,
      message: 'Admin password saved. Use this email and password to sign in.',
    };
  }

  /** @deprecated Use saveAdminAccount — kept for older desktop builds. */
  async createAdminIfMissing(dto: CreateAdminDto) {
    return this.saveAdminAccount(dto);
  }

  async setupBranch(dto: SetupBranchDto) {
    const branchId = dto.branchId.trim().toLowerCase().replace(/\s+/g, '-');
    const profile = await this.aiProfileService.upsertProfile(branchId, {
      businessName: dto.businessName,
      branchName: dto.branchName,
      locationDescription: dto.locationDescription,
    });
    return profile;
  }

  async listBranches() {
    return this.aiProfileService.listProfiles();
  }

  async registerDevice(dto: RegisterDeviceDto): Promise<DesktopDevice> {
    let device = await this.deviceRepo.findOne({ where: { deviceId: dto.deviceId } });
    if (!device) {
      device = this.deviceRepo.create({ deviceId: dto.deviceId, deviceName: dto.deviceName });
    }
    device.deviceName = dto.deviceName;
    device.businessId = dto.businessId ?? device.businessId;
    device.branchId = dto.branchId ?? device.branchId;
    device.appVersion = dto.appVersion ?? this.getAppVersion();
    device.os = dto.os ?? device.os;
    device.status = 'active';
    device.lastSeenAt = new Date();
    return this.deviceRepo.save(device);
  }

  async getDeviceStatus(deviceId: string) {
    const device = await this.deviceRepo.findOne({ where: { deviceId } });
    const sessions = await this.sessionRepo.find();
    const conflicts = sessions.filter(
      s =>
        s.controlledByDeviceId &&
        s.controlledByDeviceId !== deviceId &&
        [SessionStatus.READY, SessionStatus.QR_READY, SessionStatus.INITIALIZING].includes(
          s.status as SessionStatus,
        ),
    );
    return {
      device,
      sessionConflicts: conflicts.map(s => ({
        sessionId: s.id,
        sessionName: s.name,
        controlledByDeviceId: s.controlledByDeviceId,
      })),
    };
  }

  async getDesktopHealth() {
    const dbConnected = this.dataSource.isInitialized;
    let databaseOk = false;
    if (dbConnected) {
      try {
        await this.dataSource.query('SELECT 1');
        databaseOk = true;
      } catch {
        databaseOk = false;
      }
    }

    const sessions = await this.sessionRepo.find();
    const connectedCount = sessions.filter(s => s.status === SessionStatus.READY).length;

    let safetyGuardEnabled = true;
    try {
      const settings = await this.whatsappSafetySettings.getGlobal();
      safetyGuardEnabled = settings.globalEnabled !== false;
    } catch {
      safetyGuardEnabled = true;
    }

    let pgvectorInstalled: boolean | undefined;
    if (databaseOk && (process.env.DATABASE_TYPE || 'sqlite') === 'postgres') {
      try {
        pgvectorInstalled = await this.checkPgvectorExtension(this.dataSource);
      } catch {
        pgvectorInstalled = false;
      }
    }

    const paths = isDesktopMode() ? getDesktopPathStatus() : {};
    const sessionsPath = isDesktopMode() ? resolveDesktopPath('sessions') : null;
    const mediaPath = isDesktopMode() ? resolveDesktopPath('media') : null;
    const logsPath = isDesktopMode() ? resolveDesktopPath('logs') : null;

    const dbType = process.env.DATABASE_TYPE || 'sqlite';
    const sqlitePath =
      dbType === 'sqlite' && isDesktopMode()
        ? process.env.DATABASE_NAME || getDesktopDataSqlitePath()
        : undefined;

    return {
      appVersion: this.getAppVersion(),
      mode: isDesktopMode() ? 'desktop' : 'server',
      uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
      database: {
        connected: databaseOk,
        type: dbType,
        maskedUrl: process.env.DATABASE_URL
          ? maskDatabaseUrl(process.env.DATABASE_URL)
          : sqlitePath,
        pgvectorInstalled,
      },
      backend: 'ok',
      paths: {
        sessions: { path: sessionsPath, ok: sessionsPath ? pathExistsAndWritable(sessionsPath) : false },
        media: { path: mediaPath, ok: mediaPath ? pathExistsAndWritable(mediaPath) : false },
        logs: { path: logsPath, ok: logsPath ? pathExistsAndWritable(logsPath) : false },
        all: paths,
      },
      whatsapp: {
        sessionCount: sessions.length,
        connectedCount,
      },
      safetyGuardEnabled,
      deviceId: this.configService.get<string>('desktop.deviceId'),
      chromiumConfigured: !!process.env.PUPPETEER_EXECUTABLE_PATH,
      nodePath: process.execPath,
    };
  }

  private async checkPgvectorExtension(ds: DataSource): Promise<boolean> {
    const rows = (await ds.query(
      `SELECT 1 AS ok FROM pg_extension WHERE extname = 'vector' LIMIT 1`,
    )) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  }
}
