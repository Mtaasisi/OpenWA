import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pool } from 'pg';
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
  vendorAutoFromLogin: boolean;
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
      vendorAutoFromLogin: !!(row.loginEmail?.trim() && row.vendorId?.trim()),
    };
  }

  async ensureLoginUserProfile(creds: InauzwaResolvedCredentials): Promise<void> {
    const row = await this.get();
    const email = row.loginEmail?.trim();
    if (!email) return;

    const profile = creds.databaseUrl
      ? await this.fetchUserProfileFromDatabase(email, creds.databaseUrl)
      : creds.source === 'supabase' &&
          creds.supabaseUrl &&
          creds.supabaseAnonKey &&
          creds.apiToken
        ? await this.fetchUserProfileFromSupabase(
            email,
            creds.supabaseUrl,
            creds.supabaseAnonKey,
            creds.apiToken,
          )
        : null;

    if (!profile) return;

    let changed = false;
    if (profile.vendorId && row.vendorId !== profile.vendorId) {
      row.vendorId = profile.vendorId;
      changed = true;
    }
    if (profile.branchId && !row.branchId?.trim()) {
      row.branchId = profile.branchId;
      changed = true;
    }
    if (changed) await this.repo.save(row);
  }

  private async fetchUserProfileFromDatabase(
    email: string,
    databaseUrl: string,
  ): Promise<{ vendorId: string | null; branchId: string | null } | null> {
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    });
    try {
      const result = await pool.query<{ vendor_id: string | null; branch_id: string | null }>(
        `SELECT vendor_id, branch_id FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [email],
      );
      if (!result.rows[0]) return null;
      return {
        vendorId: result.rows[0].vendor_id?.trim() || null,
        branchId: result.rows[0].branch_id?.trim() || null,
      };
    } catch {
      return null;
    } finally {
      await pool.end().catch(() => undefined);
    }
  }

  private async fetchUserProfileFromSupabase(
    email: string,
    supabaseUrl: string,
    anonKey: string,
    accessToken: string,
  ): Promise<{ vendorId: string | null; branchId: string | null } | null> {
    try {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=vendor_id,branch_id&limit=1`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        },
      );
      if (!response.ok) return null;
      const rows = (await response.json()) as Array<{
        vendor_id?: string | null;
        branch_id?: string | null;
      }>;
      if (!rows[0]) return null;
      return {
        vendorId: rows[0].vendor_id?.trim() || null,
        branchId: rows[0].branch_id?.trim() || null,
      };
    } catch {
      return null;
    }
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
      syncProducts: row.syncProducts ?? true,
      syncCustomers: row.syncCustomers ?? false,
      syncProformas: row.syncProformas ?? false,
      syncRecentSales: row.syncRecentSales ?? false,
      syncCategories: row.syncCategories ?? false,
      pushSalesToInauzwa: row.pushSalesToInauzwa ?? false,
      businessName: row.businessName ?? null,
      defaultPaymentInstructions: row.defaultPaymentInstructions ?? null,
      defaultBranchPickupInfo: row.defaultBranchPickupInfo ?? null,
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
    if (dto.syncProducts !== undefined) row.syncProducts = dto.syncProducts;
    if (dto.syncCustomers !== undefined) row.syncCustomers = dto.syncCustomers;
    if (dto.syncProformas !== undefined) row.syncProformas = dto.syncProformas;
    if (dto.syncRecentSales !== undefined) row.syncRecentSales = dto.syncRecentSales;
    if (dto.syncCategories !== undefined) row.syncCategories = dto.syncCategories;
    if (dto.pushSalesToInauzwa !== undefined) row.pushSalesToInauzwa = dto.pushSalesToInauzwa;
    if (dto.businessName !== undefined) row.businessName = dto.businessName?.trim() || null;
    if (dto.defaultPaymentInstructions !== undefined) {
      row.defaultPaymentInstructions = dto.defaultPaymentInstructions?.trim() || null;
    }
    if (dto.defaultBranchPickupInfo !== undefined) {
      row.defaultBranchPickupInfo = dto.defaultBranchPickupInfo?.trim() || null;
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
    const creds = await this.resolveCredentials();
    if (row.loginEmail?.trim()) {
      await this.ensureLoginUserProfile(creds);
      const refreshed = await this.get();
      if (refreshed.vendorId?.trim()) return refreshed.vendorId.trim();
    }
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

  async recordSyncBranchContext(branchId: string, vendorId?: string | null): Promise<void> {
    const row = await this.get();
    row.branchId = branchId.trim();
    if (vendorId?.trim()) {
      row.vendorId = vendorId.trim();
    }
    await this.repo.save(row);
  }

  async recordSyncError(message: string): Promise<void> {
    const row = await this.get();
    row.lastSyncError = message.slice(0, 2000);
    await this.repo.save(row);
  }
}
