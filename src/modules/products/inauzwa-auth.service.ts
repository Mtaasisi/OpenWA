import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';
import type { InauzwaSyncPreferencesDto } from './inauzwa-sync-preferences.service';
import type { InauzwaLoginDto, InauzwaSupabaseSessionDto } from './dto/product.dto';

export interface InauzwaLoginResult {
  email: string;
  fullName: string | null;
  branchId: string | null;
  vendorId: string | null;
  authMethod: 'node_api' | 'supabase';
  preferences: InauzwaSyncPreferencesDto;
}

type InauzwaLoginResponse = {
  success?: boolean;
  token?: string;
  user?: {
    email?: string;
    fullName?: string;
    branchId?: string | null;
    vendorId?: string | null;
  };
  error?: string;
  message?: string;
};

type SupabaseTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
  user?: { id?: string; email?: string };
};

type SupabaseUserRow = {
  branch_id?: string | null;
  vendor_id?: string | null;
  full_name?: string | null;
};

export function normalizeInauzwaApiUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) {
    throw new BadRequestException('API URL must start with http:// or https://');
  }
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

function normalizeSupabaseUrl(raw: string): string {
  const url = raw.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(url)) {
    throw new BadRequestException('Supabase URL must start with http:// or https://');
  }
  return url;
}

@Injectable()
export class InauzwaAuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly preferences: InauzwaSyncPreferencesService,
  ) {}

  resolveDefaultApiUrl(override?: string): string | null {
    const fromRequest = override?.trim();
    if (fromRequest) return normalizeInauzwaApiUrl(fromRequest);
    const env = this.configService.get<string>('inauzwa.apiUrl')?.trim();
    return env ? normalizeInauzwaApiUrl(env) : null;
  }

  resolveSupabaseConfig(override?: { url?: string; anonKey?: string }): {
    url: string;
    anonKey: string;
  } | null {
    const urlRaw =
      override?.url?.trim() ||
      this.configService.get<string>('inauzwa.supabaseUrl')?.trim() ||
      '';
    const anonKey =
      override?.anonKey?.trim() ||
      this.configService.get<string>('inauzwa.supabaseAnonKey')?.trim() ||
      '';
    if (!urlRaw || !anonKey) return null;
    return { url: normalizeSupabaseUrl(urlRaw), anonKey };
  }

  async login(dto: InauzwaLoginDto): Promise<InauzwaLoginResult> {
    const email = dto.email.trim().toLowerCase();
    if (!email || !dto.password) {
      throw new BadRequestException('Email and password are required');
    }

    const apiUrl = dto.apiUrl?.trim() ? normalizeInauzwaApiUrl(dto.apiUrl) : this.resolveDefaultApiUrl();
    const supabase = this.resolveSupabaseConfig({
      url: dto.supabaseUrl,
      anonKey: dto.supabaseAnonKey ?? undefined,
    });

    let nodeError: string | null = null;
    if (apiUrl) {
      try {
        return await this.loginViaNodeApi(apiUrl, email, dto.password);
      } catch (err) {
        nodeError = err instanceof Error ? err.message : String(err);
      }
    }

    if (supabase) {
      try {
        return await this.loginViaSupabase(supabase.url, supabase.anonKey, email, dto.password, apiUrl);
      } catch (err) {
        const supabaseError = err instanceof Error ? err.message : String(err);
        if (nodeError) {
          throw new BadRequestException(
            `INAUZWA login failed. API: ${nodeError}. Supabase: ${supabaseError}`,
          );
        }
        throw new BadRequestException(supabaseError);
      }
    }

    if (nodeError) {
      throw new BadRequestException(
        `${nodeError} Add INAUZWA_SUPABASE_URL and INAUZWA_SUPABASE_ANON_KEY to OpenWA .env for Supabase login (same as the INAUZWA app).`,
      );
    }

    throw new BadRequestException(
      'INAUZWA is not configured for login. Set INAUZWA_API_URL or INAUZWA_SUPABASE_URL + INAUZWA_SUPABASE_ANON_KEY in OpenWA .env, or enter them in the form.',
    );
  }

  /** Save a Supabase session established in the browser (when the API server cannot reach Supabase). */
  async completeSupabaseSession(dto: InauzwaSupabaseSessionDto): Promise<InauzwaLoginResult> {
    const email = dto.email.trim().toLowerCase();
    const supabaseUrl = normalizeSupabaseUrl(dto.supabaseUrl);
    const anonKey = dto.supabaseAnonKey.trim();
    const accessToken = dto.accessToken.trim();
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    const apiUrlFallback = dto.apiUrl?.trim()
      ? normalizeInauzwaApiUrl(dto.apiUrl)
      : this.resolveDefaultApiUrl();

    const branchId = dto.branchId?.trim() || null;
    const vendorId = dto.vendorId?.trim() || null;
    const fullName = dto.fullName?.trim() || null;

    await this.preferences.update({
      databaseUrl: null,
      apiUrl: apiUrlFallback,
      apiToken: accessToken,
      loginEmail: email,
      branchId: branchId ?? undefined,
      vendorId: vendorId ?? undefined,
      useSupabaseAuth: true,
      supabaseUrl,
      supabaseAnonKey: anonKey,
      clearConnection: false,
    });

    return this.buildLoginResult(email, fullName, 'supabase');
  }

  private async loginViaNodeApi(
    apiUrl: string,
    email: string,
    password: string,
  ): Promise<InauzwaLoginResult> {
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Could not reach INAUZWA API at ${apiUrl}: ${msg}`);
    }

    let body: InauzwaLoginResponse = {};
    try {
      body = (await response.json()) as InauzwaLoginResponse;
    } catch {
      body = {};
    }

    if (!response.ok || !body.token) {
      const detail = body.message || body.error || `HTTP ${response.status}`;
      throw new BadRequestException(detail);
    }

    const verify = await fetch(`${apiUrl}/products?limit=1&offset=0`, {
      headers: { Authorization: `Bearer ${body.token}`, Accept: 'application/json' },
    });
    if (!verify.ok) {
      throw new BadRequestException(
        `Signed in, but product access failed (HTTP ${verify.status}). Ensure your INAUZWA user has a branch assigned.`,
      );
    }

    const branchId = body.user?.branchId?.trim() || null;
    const vendorId = body.user?.vendorId?.trim() || null;

    await this.preferences.update({
      databaseUrl: null,
      apiUrl,
      apiToken: body.token,
      loginEmail: email,
      branchId: branchId ?? undefined,
      vendorId: vendorId ?? undefined,
      useSupabaseAuth: false,
      supabaseUrl: null,
      supabaseAnonKey: undefined,
      clearConnection: false,
    });

    return this.buildLoginResult(email, body.user?.fullName?.trim() || null, 'node_api');
  }

  private async loginViaSupabase(
    supabaseUrl: string,
    anonKey: string,
    email: string,
    password: string,
    apiUrlFallback: string | null,
  ): Promise<InauzwaLoginResult> {
    let tokenResponse: Response;
    try {
      tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: anonKey,
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`Could not reach Supabase at ${supabaseUrl}: ${msg}`);
    }

    let tokenBody: SupabaseTokenResponse = {};
    try {
      tokenBody = (await tokenResponse.json()) as SupabaseTokenResponse;
    } catch {
      tokenBody = {};
    }

    if (!tokenResponse.ok || !tokenBody.access_token) {
      const detail =
        tokenBody.error_description ||
        tokenBody.error ||
        `Supabase auth failed (HTTP ${tokenResponse.status})`;
      throw new BadRequestException(detail);
    }

    const accessToken = tokenBody.access_token;
    const userId = tokenBody.user?.id;
    let branchId: string | null = null;
    let vendorId: string | null = null;
    let fullName: string | null = null;

    if (userId) {
      const profileRes = await fetch(
        `${supabaseUrl}/rest/v1/users?id=eq.${encodeURIComponent(userId)}&select=branch_id,vendor_id,full_name&limit=1`,
        {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
          },
        },
      );
      if (profileRes.ok) {
        const rows = (await profileRes.json()) as SupabaseUserRow[];
        if (rows[0]) {
          branchId = rows[0].branch_id?.trim() || null;
          vendorId = rows[0].vendor_id?.trim() || null;
          fullName = rows[0].full_name?.trim() || null;
        }
      }
    }

    const productProbe = branchId
      ? `${supabaseUrl}/rest/v1/lats_products?branch_id=eq.${encodeURIComponent(branchId)}&select=id&limit=1`
      : `${supabaseUrl}/rest/v1/lats_products?select=id&limit=1`;
    const verify = await fetch(productProbe, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!verify.ok) {
      throw new BadRequestException(
        `Signed in to Supabase, but inventory access failed (HTTP ${verify.status}). Check RLS policies or assign a branch to your user.`,
      );
    }

    await this.preferences.update({
      databaseUrl: null,
      apiUrl: apiUrlFallback,
      apiToken: accessToken,
      loginEmail: email,
      branchId: branchId ?? undefined,
      vendorId: vendorId ?? undefined,
      useSupabaseAuth: true,
      supabaseUrl,
      supabaseAnonKey: anonKey,
      clearConnection: false,
    });

    return this.buildLoginResult(email, fullName, 'supabase');
  }

  private async buildLoginResult(
    email: string,
    fullName: string | null,
    authMethod: 'node_api' | 'supabase',
  ): Promise<InauzwaLoginResult> {
    const creds = await this.preferences.resolveCredentials();
    await this.preferences.ensureLoginUserProfile(creds);
    const preferences = await this.preferences.toDto();
    return {
      email,
      fullName,
      branchId: preferences.branchId,
      vendorId: preferences.vendorId,
      authMethod,
      preferences,
    };
  }
}
