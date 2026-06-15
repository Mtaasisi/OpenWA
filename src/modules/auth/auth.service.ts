import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { ApiKey, ApiKeyRole, ApiKeyType } from './entities/api-key.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
import { createLogger } from '../../common/services/logger.service';
import {
  assertNotDevAdminKeyInProduction,
  DEV_ADMIN_KEY,
  isProductionEnv,
  maskApiKeyForLogs,
} from '../../common/utils/production-security.util';

const API_KEY_FILE = join(process.cwd(), 'data', '.api-key');

type ValidateApiKeyOptions = {
  /** When false, skip per-request usage counter writes (WebSocket auth, cached reads). */
  trackUsage?: boolean;
};

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = createLogger('AuthService');
  private readonly validationCache = new Map<string, { apiKey: ApiKey; expiresAt: number }>();
  private readonly pendingUsage = new Map<string, { count: number; lastUsedAt: Date }>();
  private usageFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly VALIDATION_CACHE_MS = 60_000;
  private static readonly USAGE_FLUSH_MS = 5_000;

  constructor(
    @InjectRepository(ApiKey, 'main')
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async onModuleInit(): Promise<void> {
    // Seed a default API key if none exist
    const count = await this.apiKeyRepository.count();
    let displayKey: string;
    let isNewKey = false;

    if (count === 0) {
      displayKey = this.resolveInitialAdminKey();
      assertNotDevAdminKeyInProduction(displayKey);

      await this.seedApiKey(displayKey, 'Default Admin Key', ApiKeyRole.ADMIN);
      isNewKey = true;

      // Save raw key to file for startup script to read
      try {
        writeFileSync(API_KEY_FILE, displayKey, 'utf-8');
      } catch (err) {
        this.logger.warn('Could not save API key file', { error: String(err) });
      }
    } else {
      // Read saved API key from file if exists
      if (existsSync(API_KEY_FILE)) {
        try {
          displayKey = readFileSync(API_KEY_FILE, 'utf-8').trim();
        } catch (error) {
          this.logger.warn(`Failed to read API key file: ${API_KEY_FILE}`, { error: String(error) });
          displayKey = '(check dashboard for keys)';
        }
      } else {
        displayKey = '(check dashboard for keys)';
      }
    }

    // Always show the welcome banner on startup
    const apiBaseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 2785}`;
    const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:${process.env.DASHBOARD_PORT || 2886}`;

    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
    this.logger.log('  🟢 Welcome to OpenWA - WhatsApp API Gateway');
    this.logger.log('');
    this.logger.log(`  📊 Dashboard: ${dashboardUrl}`);
    this.logger.log(`  📚 API Docs:  ${apiBaseUrl}/api/docs`);
    this.logger.log('');
    if (isNewKey) {
      this.logger.log('  🔑 API Key (newly created):');
    } else {
      this.logger.log('  🔑 API Key:');
    }
    if (isProductionEnv()) {
      this.logger.log(`     ${maskApiKeyForLogs(displayKey!)} (full key saved to data/.api-key on first boot)`);
    } else {
      this.logger.log(`     ${displayKey}`);
    }
    this.logger.log('');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('');
  }

  private resolveInitialAdminKey(): string {
    const master = process.env.API_MASTER_KEY?.trim();
    if (master) {
      if (isProductionEnv() && master === DEV_ADMIN_KEY) {
        throw new InternalServerErrorException(
          'API_MASTER_KEY cannot be dev-admin-key in production',
        );
      }
      return master;
    }
    if (isProductionEnv()) {
      return `owa_k1_${randomBytes(32).toString('hex')}`;
    }
    return DEV_ADMIN_KEY;
  }

  private async seedApiKey(rawKey: string, name: string, role: ApiKeyRole): Promise<ApiKey> {
    assertNotDevAdminKeyInProduction(rawKey);
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      name,
      keyHash,
      keyPrefix,
      role,
      type: ApiKeyType.SERVICE,
    });

    return this.apiKeyRepository.save(apiKey);
  }

  async createApiKey(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKey; rawKey: string }> {
    // Generate secure random key: owa_k1_<32 bytes hex>
    const rawKey = `owa_k1_${randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = this.apiKeyRepository.create({
      name: dto.name,
      keyHash,
      keyPrefix,
      role: dto.role || ApiKeyRole.OPERATOR,
      type: ApiKeyType.SERVICE,
      allowedIps: dto.allowedIps || null,
      allowedSessions: dto.allowedSessions || null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    const saved = await this.apiKeyRepository.save(apiKey);
    this.logger.log(`API key created: ${saved.name}`, {
      keyId: saved.id,
      role: saved.role,
      action: 'api_key_created',
    });

    return { apiKey: saved, rawKey };
  }

  /** All active keys (service + user-linked) for staff/inbox assignee resolution. */
  async findAll(): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** Service/integration keys only (admin API key management). */
  async findAllServiceKeys(): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { type: ApiKeyType.SERVICE },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }
    if (apiKey.type === ApiKeyType.USER) {
      throw new NotFoundException(`API key with id '${id}' not found`);
    }
    return apiKey;
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey> {
    const apiKey = await this.findOne(id);

    if (dto.name) apiKey.name = dto.name;
    if (dto.role) apiKey.role = dto.role;
    if (dto.allowedIps !== undefined) apiKey.allowedIps = dto.allowedIps;
    if (dto.allowedSessions !== undefined) apiKey.allowedSessions = dto.allowedSessions;
    if (dto.expiresAt !== undefined) apiKey.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return this.apiKeyRepository.save(apiKey);
  }

  async delete(id: string): Promise<void> {
    const apiKey = await this.findOne(id);
    await this.apiKeyRepository.remove(apiKey);
    this.logger.log(`API key deleted: ${apiKey.name}`, {
      keyId: id,
      action: 'api_key_deleted',
    });
  }

  async revoke(id: string): Promise<ApiKey> {
    const apiKey = await this.findOne(id);
    apiKey.isActive = false;
    this.validationCache.clear();
    return this.apiKeyRepository.save(apiKey);
  }

  async validateApiKey(
    rawKey: string,
    clientIp?: string,
    sessionId?: string,
    options: ValidateApiKeyOptions = {},
  ): Promise<ApiKey> {
    const trackUsage = options.trackUsage !== false;
    if (isProductionEnv() && rawKey === DEV_ADMIN_KEY) {
      throw new UnauthorizedException('Invalid API key');
    }

    const keyHash = this.hashKey(rawKey);
    const cached = this.validationCache.get(keyHash);
    if (cached && cached.expiresAt > Date.now()) {
      this.assertKeyAccess(cached.apiKey, clientIp, sessionId);
      if (trackUsage) this.queueUsageUpdate(cached.apiKey.id);
      return cached.apiKey;
    }

    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    this.assertKeyAccess(apiKey, clientIp, sessionId);

    this.validationCache.set(keyHash, {
      apiKey,
      expiresAt: Date.now() + AuthService.VALIDATION_CACHE_MS,
    });

    if (trackUsage) {
      this.queueUsageUpdate(apiKey.id);
    }

    return apiKey;
  }

  private assertKeyAccess(apiKey: ApiKey, clientIp?: string, sessionId?: string): void {
    if (!apiKey.isActive) {
      throw new UnauthorizedException('API key is revoked');
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    if (apiKey.allowedIps && apiKey.allowedIps.length > 0 && clientIp) {
      if (!this.isIpAllowed(clientIp, apiKey.allowedIps)) {
        this.logger.warn(`IP not allowed: ${clientIp}`, {
          keyId: apiKey.id,
          action: 'ip_rejected',
        });
        throw new UnauthorizedException('IP address not allowed');
      }
    }

    if (apiKey.allowedSessions && apiKey.allowedSessions.length > 0 && sessionId) {
      if (!apiKey.allowedSessions.includes(sessionId)) {
        throw new UnauthorizedException('API key not authorized for this session');
      }
    }
  }

  private queueUsageUpdate(keyId: string): void {
    const entry = this.pendingUsage.get(keyId) ?? { count: 0, lastUsedAt: new Date() };
    entry.count += 1;
    entry.lastUsedAt = new Date();
    this.pendingUsage.set(keyId, entry);
    if (!this.usageFlushTimer) {
      this.usageFlushTimer = setTimeout(() => {
        void this.flushUsageUpdates();
      }, AuthService.USAGE_FLUSH_MS);
    }
  }

  private async flushUsageUpdates(): Promise<void> {
    this.usageFlushTimer = null;
    const batch = [...this.pendingUsage.entries()];
    this.pendingUsage.clear();
    for (const [keyId, usage] of batch) {
      try {
        await this.apiKeyRepository.increment({ id: keyId }, 'usageCount', usage.count);
        await this.apiKeyRepository.update(keyId, { lastUsedAt: usage.lastUsedAt });
      } catch (err) {
        this.logger.warn('Failed to flush API key usage stats', {
          keyId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  private isIpAllowed(clientIp: string, allowedIps: string[]): boolean {
    // Phase 3 Security Audit: Support both exact match and CIDR notation
    for (const entry of allowedIps) {
      if (entry.includes('/')) {
        // CIDR notation (e.g., "10.0.0.0/24")
        if (this.ipInCidr(clientIp, entry)) {
          return true;
        }
      } else {
        // Exact match
        if (clientIp === entry) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if an IPv4 address is within a CIDR range
   * @param ip - Client IP address (e.g., "192.168.1.100")
   * @param cidr - CIDR notation (e.g., "192.168.1.0/24")
   */
  private ipInCidr(ip: string, cidr: string): boolean {
    try {
      const [range, bitsStr] = cidr.split('/');
      const bits = parseInt(bitsStr, 10);

      if (isNaN(bits) || bits < 0 || bits > 32) {
        return false;
      }

      const mask = ~(2 ** (32 - bits) - 1);
      const ipNum = this.ipToNumber(ip);
      const rangeNum = this.ipToNumber(range);

      return (ipNum & mask) === (rangeNum & mask);
    } catch (error) {
      this.logger.warn(`Invalid CIDR format: ${cidr}`, { error: String(error) });
      return false;
    }
  }

  /**
   * Convert IPv4 address string to 32-bit number
   */
  private ipToNumber(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) return 0;

    return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean {
    const roleHierarchy: Record<ApiKeyRole, number> = {
      [ApiKeyRole.VIEWER]: 1,
      [ApiKeyRole.OPERATOR]: 2,
      [ApiKeyRole.ADMIN]: 3,
    };

    return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
  }
}
