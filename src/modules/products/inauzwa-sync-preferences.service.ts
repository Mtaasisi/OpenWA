import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CrmInauzwaSyncSettings,
  INAUZWA_SYNC_SETTINGS_ID,
} from './entities/crm-inauzwa-sync-settings.entity';
import type { InauzwaSyncResult } from './inauzwa-sync.service';
import type { UpdateInauzwaSyncPreferencesDto } from './dto/product.dto';

export interface InauzwaSyncPreferencesDto {
  branchId: string | null;
  vendorId: string | null;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  refreshBeforeSend: boolean;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  lastSyncResult: InauzwaSyncResult | null;
  currency: string;
  connection: InauzwaConnectionInfoDto;
}

export interface InauzwaConnectionInfoDto {
  configured: boolean;
  source: 'database' | 'api' | 'supabase' | null;
  configuredVia: 'env' | 'ui' | null;
  databaseUrlMasked: string | null;
  apiUrl: string | null;
  hasApiToken: boolean;
  loginEmail: string | null;
  connectedViaLogin: boolean;
  supabaseUrl: string | null;
}

export interface InauzwaResolvedCredentials {
  databaseUrl: string | null;
  apiUrl: string | null;
  apiToken: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  currency: string;
  source: 'database' | 'api' | 'supabase' | null;
  configuredVia: 'env' | 'ui' | null;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function maskDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '****';
    if (parsed.username) parsed.username = '****';
    return parsed.toString();
  } catch {
    return url.length > 12 ? `${url.slice(0, 8)}****` : '****';
  }
}

@Injectable()
export class InauzwaSyncPreferencesService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CrmInauzwaSyncSettings, 'data')
    private readonly repo: Repository<CrmInauzwaSyncSettings>,
  ) {}

  async get(): Promise<CrmInauzwaSyncSettings> {
    let row = await this.repo.findOne({ where: { id: INAUZWA_SYNC_SETTINGS_ID } });
    if (!row) {
      row = this.repo.create({
        id: INAUZWA_SYNC_SETTINGS_ID,
        autoSyncEnabled: this.configService.get<boolean>('inauzwa.autoSyncEnabled', false),
        autoSyncIntervalMinutes: this.configService.get<number>(
          'inauzwa.autoSyncIntervalMinutes',
          60,
        ),
        refreshBeforeSend: true,
        branchId: this.configService.get<string>('inauzwa.branchId')?.trim() || null,
        vendorId: this.configService.get<string>('inauzwa.vendorId')?.trim() || null,
      });
      await this.repo.save(row);
    }
    return row;
  }

  async resolveCredentials(): Promise<InauzwaResolvedCredentials> {
    const row = await this.get();
    const envDatabaseUrl = this.configService.get<string>('inauzwa.databaseUrl')?.trim() || null;
    const envApiUrl = this.configService.get<string>('inauzwa.apiUrl')?.trim() || null;
    const envApiToken = this.configService.get<string>('inauzwa.apiToken')?.trim() || null;

    const uiDatabaseUrl = row.databaseUrl?.trim() || null;
    const uiApiUrl = row.apiUrl?.trim() || null;
    const uiApiToken = row.apiToken?.trim() || null;

    const databaseUrl = uiDatabaseUrl || envDatabaseUrl;
    const apiUrl = uiApiUrl || envApiUrl;
    const apiToken = uiApiToken || envApiToken;

  const currency =
    row.currency?.trim() ||
    this.configService.get<string>('inauzwa.currency')?.trim() ||
    'TZS';

    if (databaseUrl) {
      return {
        databaseUrl,
        apiUrl: null,
        apiToken: null,
        supabaseUrl: null,
        supabaseAnonKey: null,
        currency,
        source: 'database',
        configuredVia: uiDatabaseUrl ? 'ui' : 'env',
      };
    }

    if (row.useSupabaseAuth && uiApiToken && (row.supabaseUrl?.trim() || this.configService.get<string>('inauzwa.supabaseUrl')?.trim())) {
      const supabaseUrl = row.supabaseUrl?.trim() || this.configService.get<string>('inauzwa.supabaseUrl')?.trim() || null;
      const supabaseAnonKey =
        row.supabaseAnonKey?.trim() ||
        this.configService.get<string>('inauzwa.supabaseAnonKey')?.trim() ||
        null;
      if (supabaseUrl && supabaseAnonKey) {
        return {
          databaseUrl: null,
          apiUrl: uiApiUrl || envApiUrl,
          apiToken: uiApiToken,
          supabaseUrl,
          supabaseAnonKey,
          currency,
          source: 'supabase',
          configuredVia: 'ui',
        };
      }
    }

    if (apiUrl && apiToken) {
      return {
        databaseUrl: null,
        apiUrl,
        apiToken,
        supabaseUrl: null,
        supabaseAnonKey: null,
        currency,
        source: 'api',
        configuredVia: uiApiUrl || uiApiToken ? 'ui' : 'env',
      };
    }

    return {
      databaseUrl: null,
      apiUrl: null,
      apiToken: null,
      supabaseUrl: null,
      supabaseAnonKey: null,
      currency,
      source: null,
      configuredVia: null,
    };
  }

  async getConnectionInfo(): Promise<InauzwaConnectionInfoDto> {
    const row = await this.get();
    const resolved = await this.resolveCredentials();
    return {
      configured: resolved.source !== null,
      source: resolved.source,
      configuredVia: resolved.configuredVia,
      databaseUrlMasked: resolved.databaseUrl ? maskDatabaseUrl(resolved.databaseUrl) : null,
      apiUrl: resolved.apiUrl,
      hasApiToken: !!(row.apiToken?.trim() || this.configService.get<string>('inauzwa.apiToken')?.trim()),
      loginEmail: row.loginEmail?.trim() || null,
      connectedViaLogin: !!(row.loginEmail?.trim() && (row.apiToken?.trim() || resolved.apiToken)),
      supabaseUrl: resolved.supabaseUrl,
    };
  }

  async toDto(): Promise<InauzwaSyncPreferencesDto> {
    const row = await this.get();
    let lastSyncResult: InauzwaSyncResult | null = null;
    if (row.lastSyncResultJson) {
      try {
        lastSyncResult = JSON.parse(row.lastSyncResultJson) as InauzwaSyncResult;
      } catch {
        lastSyncResult = null;
      }
    }
    const resolved = await this.resolveCredentials();
    return {
      branchId: row.branchId,
      vendorId: row.vendorId,
      autoSyncEnabled: row.autoSyncEnabled,
      autoSyncIntervalMinutes: row.autoSyncIntervalMinutes,
      refreshBeforeSend: row.refreshBeforeSend,
      lastSyncAt: toIsoString(row.lastSyncAt),
      lastSyncError: row.lastSyncError,
      lastSyncResult,
      currency: resolved.currency,
      connection: await this.getConnectionInfo(),
    };
  }

  async update(dto: UpdateInauzwaSyncPreferencesDto): Promise<InauzwaSyncPreferencesDto> {
    const row = await this.get();
    if (dto.clearConnection) {
      row.databaseUrl = null;
      row.apiUrl = null;
      row.apiToken = null;
      row.loginEmail = null;
      row.useSupabaseAuth = false;
      row.supabaseUrl = null;
      row.supabaseAnonKey = null;
    }
    if (dto.databaseUrl !== undefined) {
      row.databaseUrl = dto.databaseUrl?.trim() || null;
    }
    if (dto.apiUrl !== undefined) {
      row.apiUrl = dto.apiUrl?.trim() || null;
    }
    if (dto.apiToken !== undefined && dto.apiToken.trim()) {
      row.apiToken = dto.apiToken.trim();
    }
    if (dto.loginEmail !== undefined) {
      row.loginEmail = dto.loginEmail?.trim() || null;
    }
    if (dto.useSupabaseAuth !== undefined) {
      row.useSupabaseAuth = dto.useSupabaseAuth;
    }
    if (dto.supabaseUrl !== undefined) {
      row.supabaseUrl = dto.supabaseUrl?.trim() || null;
    }
    if (dto.supabaseAnonKey !== undefined) {
      row.supabaseAnonKey = dto.supabaseAnonKey?.trim() || null;
    }
    if (dto.currency !== undefined) {
      row.currency = dto.currency?.trim() || null;
    }
    if (dto.branchId !== undefined) {
      row.branchId = dto.branchId?.trim() || null;
    }
    if (dto.vendorId !== undefined) {
      row.vendorId = dto.vendorId?.trim() || null;
    }
    if (dto.autoSyncEnabled !== undefined) {
      row.autoSyncEnabled = dto.autoSyncEnabled;
    }
    if (dto.autoSyncIntervalMinutes !== undefined) {
      row.autoSyncIntervalMinutes = Math.min(1440, Math.max(5, dto.autoSyncIntervalMinutes));
    }
    if (dto.refreshBeforeSend !== undefined) {
      row.refreshBeforeSend = dto.refreshBeforeSend;
    }
    await this.repo.save(row);
    return this.toDto();
  }

  resolveBranchId(override?: string): string | null {
    const fromRequest = override?.trim();
    if (fromRequest) return fromRequest;
    return null;
  }

  async resolveEffectiveBranchId(override?: string): Promise<string | null> {
    const fromRequest = override?.trim();
    if (fromRequest) return fromRequest;
    const row = await this.get();
    if (row.branchId?.trim()) return row.branchId.trim();
    return this.configService.get<string>('inauzwa.branchId')?.trim() || null;
  }

  async resolveEffectiveVendorId(override?: string): Promise<string | undefined> {
    const fromRequest = override?.trim();
    if (fromRequest) return fromRequest;
    const row = await this.get();
    if (row.vendorId?.trim()) return row.vendorId.trim();
    const env = this.configService.get<string>('inauzwa.vendorId')?.trim();
    return env || undefined;
  }

  async shouldRefreshBeforeSend(requestFlag?: boolean): Promise<boolean> {
    if (requestFlag === false) return false;
    if (requestFlag === true) return true;
    const row = await this.get();
    return row.refreshBeforeSend;
  }

  async recordSyncSuccess(result: InauzwaSyncResult): Promise<void> {
    const row = await this.get();
    row.lastSyncAt = new Date();
    row.lastSyncResultJson = JSON.stringify(result);
    row.lastSyncError = null;
    await this.repo.save(row);
  }

  async recordSyncError(message: string): Promise<void> {
    const row = await this.get();
    row.lastSyncError = message.slice(0, 2000);
    await this.repo.save(row);
  }
}
