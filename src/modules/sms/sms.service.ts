import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsProviderSettings } from './entities/sms-provider-settings.entity';
import { SmsMessageLog } from './entities/sms-message-log.entity';
import {
  SMS_LOW_BALANCE_THRESHOLD,
  SMS_SETTINGS_ID,
  SmsMessageStatus,
  SmsProviderStatus,
} from './sms.enums';
import { encryptAiSecret, decryptAiSecret } from '../../common/utils/ai-crypto.util';
import { MobishastraProvider } from './providers/mobishastra.provider';
import type { SmsProviderCredentials } from './sms-provider.interface';
import { normalizeSmsPhone } from './utils/phone-normalize.util';
import { calculateSmsSegments } from './utils/sms-segments.util';
import type { BulkSmsDto, SendSmsDto, SmsSettingsDto, TestSmsDto } from './dto/sms-settings.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    @InjectRepository(SmsProviderSettings, 'data')
    private readonly settingsRepo: Repository<SmsProviderSettings>,
    @InjectRepository(SmsMessageLog, 'data')
    private readonly logRepo: Repository<SmsMessageLog>,
    private readonly mobishastra: MobishastraProvider,
    private readonly auditService: AuditService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  private async ensureSettings(): Promise<SmsProviderSettings> {
    let settings = await this.settingsRepo.findOne({ where: { id: SMS_SETTINGS_ID } });
    if (!settings) {
      settings = this.settingsRepo.create({
        id: SMS_SETTINGS_ID,
        status: SmsProviderStatus.NOT_CONNECTED,
      });
      await this.settingsRepo.save(settings);
    }
    return settings;
  }

  private toPublicSettings(settings: SmsProviderSettings) {
    return {
      provider: settings.provider,
      isEnabled: settings.isEnabled,
      status: settings.status,
      profileId: settings.profileId,
      passwordMasked: !!settings.passwordEncrypted,
      senderId: settings.senderId,
      countryCode: settings.countryCode,
      priority: settings.priority,
      lastBalance: settings.lastBalance,
      lastTestAt: settings.lastTestAt?.toISOString() ?? null,
      lastError: settings.lastError,
      updatedAt: settings.updatedAt?.toISOString() ?? null,
    };
  }

  getPublicStatus(settings: SmsProviderSettings) {
    const ready =
      settings.isEnabled &&
      settings.status === SmsProviderStatus.CONNECTED &&
      !!settings.passwordEncrypted &&
      !!settings.profileId &&
      !!settings.senderId;
    return {
      connected: ready,
      status: settings.status,
      isEnabled: settings.isEnabled,
      configured: !!(
        settings.passwordEncrypted &&
        settings.profileId &&
        settings.senderId
      ),
      lowBalance:
        settings.lastBalance !== null &&
        settings.lastBalance < SMS_LOW_BALANCE_THRESHOLD,
      lastBalance: settings.lastBalance,
      lastError: settings.lastError,
    };
  }

  async getSettings() {
    const settings = await this.ensureSettings();
    return this.toPublicSettings(settings);
  }

  async getStatus() {
    const settings = await this.ensureSettings();
    return this.getPublicStatus(settings);
  }

  async saveSettings(dto: SmsSettingsDto, apiKeyId: string) {
    const settings = await this.ensureSettings();

    if (dto.profileId !== undefined) settings.profileId = dto.profileId.trim() || null;
    if (dto.senderId !== undefined) settings.senderId = dto.senderId.trim() || null;
    if (dto.countryCode !== undefined) settings.countryCode = dto.countryCode.trim() || 'ALL';
    if (dto.priority !== undefined) settings.priority = dto.priority.trim() || 'High';
    if (dto.password?.trim()) {
      settings.passwordEncrypted = encryptAiSecret(dto.password.trim());
    }
    if (dto.isEnabled !== undefined) {
      settings.isEnabled = dto.isEnabled;
      if (!dto.isEnabled) {
        settings.status = SmsProviderStatus.DISABLED;
      } else if (settings.status === SmsProviderStatus.DISABLED) {
        settings.status = SmsProviderStatus.NOT_CONNECTED;
      }
    }

    if (!settings.passwordEncrypted || !settings.profileId || !settings.senderId) {
      settings.status = SmsProviderStatus.NOT_CONNECTED;
    }

    settings.updatedBy = apiKeyId;
    if (!settings.createdBy) settings.createdBy = apiKeyId;
    await this.settingsRepo.save(settings);

    void this.auditService.logInfo(AuditAction.SMS_CREDENTIALS_SAVED, {
      metadata: { apiKeyId, provider: settings.provider },
    });

    return this.toPublicSettings(settings);
  }

  private getCredentials(settings: SmsProviderSettings): SmsProviderCredentials {
    if (!settings.profileId || !settings.passwordEncrypted || !settings.senderId) {
      throw new BadRequestException('SMS provider credentials not configured');
    }
    return {
      user: settings.profileId,
      password: decryptAiSecret(settings.passwordEncrypted),
      senderId: settings.senderId,
      countryCode: settings.countryCode || 'ALL',
      priority: settings.priority || 'High',
    };
  }

  private assertCanSend(settings: SmsProviderSettings): void {
    if (!settings.isEnabled) {
      throw new BadRequestException('SMS provider is disabled');
    }
    if (
      settings.status !== SmsProviderStatus.CONNECTED &&
      settings.status !== SmsProviderStatus.LOW_BALANCE
    ) {
      throw new BadRequestException(
        `SMS provider is not ready (status: ${settings.status}). Run a test SMS first.`,
      );
    }
  }

  private async updateBalanceStatus(settings: SmsProviderSettings, balance: number | null) {
    if (balance === null) return;
    const prevStatus = settings.status;
    settings.lastBalance = balance;
    if (balance < SMS_LOW_BALANCE_THRESHOLD && settings.status === SmsProviderStatus.CONNECTED) {
      settings.status = SmsProviderStatus.LOW_BALANCE;
    } else if (
      balance >= SMS_LOW_BALANCE_THRESHOLD &&
      settings.status === SmsProviderStatus.LOW_BALANCE
    ) {
      settings.status = SmsProviderStatus.CONNECTED;
    }
    await this.settingsRepo.save(settings);
    if (
      prevStatus !== SmsProviderStatus.LOW_BALANCE &&
      settings.status === SmsProviderStatus.LOW_BALANCE
    ) {
      this.eventsGateway.emitSmsStatusChanged({
        status: 'low_balance',
        balance,
      });
    }
  }

  private emitSmsFailed(error?: string | null): void {
    this.eventsGateway.emitSmsStatusChanged({
      status: 'failed',
      error: error ?? null,
    });
  }

  async checkBalance(apiKeyId: string) {
    const settings = await this.ensureSettings();
    const credentials = this.getCredentials(settings);
    const result = await this.mobishastra.checkBalance(credentials);

    if (result.success && result.balance !== null) {
      await this.updateBalanceStatus(settings, result.balance);
    } else {
      settings.lastError = result.errorMessage ?? 'Balance check failed';
      await this.settingsRepo.save(settings);
    }

    return {
      balance: result.balance,
      rawResponse: result.rawResponse,
      status: settings.status,
      success: result.success,
      error: result.errorMessage ?? null,
    };
  }

  async testSms(dto: TestSmsDto, apiKeyId: string) {
    const settings = await this.ensureSettings();
    settings.status = SmsProviderStatus.TESTING;
    settings.lastError = null;
    await this.settingsRepo.save(settings);

    const phone = normalizeSmsPhone(dto.toPhone);
    if (!phone) throw new BadRequestException('Invalid test phone number');

    const message = dto.message?.trim() || 'OpenWA SMS test message';
    const credentials = this.getCredentials(settings);

    try {
      const result = await this.mobishastra.sendSingle(
        credentials,
        phone.providerFormat,
        message,
      );

      settings.lastTestAt = new Date();
      if (result.success) {
        settings.status = SmsProviderStatus.CONNECTED;
        settings.isEnabled = true;
        settings.lastError = null;
      } else {
        settings.status = SmsProviderStatus.FAILED;
        settings.lastError = result.message;
        this.emitSmsFailed(result.message);
      }
      await this.settingsRepo.save(settings);

      void this.auditService.logInfo(AuditAction.SMS_TEST_SENT, {
        metadata: { apiKeyId, phone: phone.normalized, success: result.success },
      });

      if (!result.success) {
        void this.auditService.logWarn(AuditAction.SMS_FAILED, {
          metadata: { apiKeyId, code: result.code, message: result.message, type: 'test' },
        });
      }

      return {
        success: result.success,
        code: result.code,
        message: result.message,
        status: settings.status,
      };
    } catch (err) {
      settings.status = SmsProviderStatus.FAILED;
      settings.lastError = (err as Error).message;
      await this.settingsRepo.save(settings);
      this.emitSmsFailed((err as Error).message);
      throw new BadRequestException(`Test SMS failed: ${(err as Error).message}`);
    }
  }

  async disable(apiKeyId: string) {
    const settings = await this.ensureSettings();
    settings.isEnabled = false;
    settings.status = SmsProviderStatus.DISABLED;
    settings.updatedBy = apiKeyId;
    await this.settingsRepo.save(settings);

    void this.auditService.logInfo(AuditAction.SMS_DISABLED, {
      metadata: { apiKeyId },
    });
    return this.toPublicSettings(settings);
  }

  async activate(apiKeyId: string) {
    const settings = await this.ensureSettings();
    if (!settings.passwordEncrypted || !settings.profileId || !settings.senderId) {
      throw new BadRequestException('Configure credentials before activating SMS');
    }
    settings.isEnabled = true;
    if (settings.lastTestAt) {
      settings.status = SmsProviderStatus.CONNECTED;
    } else {
      settings.status = SmsProviderStatus.NOT_CONNECTED;
    }
    settings.updatedBy = apiKeyId;
    await this.settingsRepo.save(settings);
    return this.toPublicSettings(settings);
  }

  isReady(): Promise<boolean> {
    return this.getStatus().then(s => s.connected);
  }

  async send(dto: SendSmsDto, apiKey: ApiKey) {
    return this.sendInternal(dto, apiKey.id);
  }

  async sendInternal(dto: SendSmsDto, sentBy: string | null) {
    const settings = await this.ensureSettings();
    this.assertCanSend(settings);

    const message = dto.message?.trim();
    if (!message) throw new BadRequestException('Message cannot be empty');

    const phone = normalizeSmsPhone(dto.toPhone);
    if (!phone) throw new BadRequestException('Invalid phone number');

    const segmentInfo = calculateSmsSegments(message);
    const credentials = this.getCredentials(settings);

    const log = this.logRepo.create({
      provider: settings.provider,
      toPhone: phone.raw,
      normalizedPhone: phone.normalized,
      customerId: dto.customerId ?? null,
      conversationId: dto.conversationId ?? null,
      relatedType: dto.relatedType ?? null,
      relatedId: dto.relatedId ?? null,
      message,
      smsCount: segmentInfo.smsCount || 1,
      status: SmsMessageStatus.QUEUED,
      sentBy: sentBy,
    });
    await this.logRepo.save(log);

    try {
      const result = await this.mobishastra.sendSingle(
        credentials,
        phone.providerFormat,
        message,
      );

      log.status = result.success ? SmsMessageStatus.SENT : SmsMessageStatus.FAILED;
      log.providerResponse = result.rawResponse;
      log.providerMessageId = result.providerMessageId ?? null;
      log.errorCode = result.success ? null : result.code;
      log.errorMessage = result.success ? null : result.message;
      log.sentAt = result.success ? new Date() : null;
      await this.logRepo.save(log);

      if (sentBy) {
        void this.auditService.logInfo(AuditAction.SMS_SENT, {
          metadata: {
            apiKeyId: sentBy,
            logId: log.id,
            phone: phone.normalized,
            success: result.success,
            smsCount: log.smsCount,
          },
        });

        if (!result.success) {
          void this.auditService.logWarn(AuditAction.SMS_FAILED, {
            metadata: { apiKeyId: sentBy, logId: log.id, code: result.code },
          });
          this.emitSmsFailed(result.message);
        }
      }

      if (!result.success) {
        throw new BadRequestException(result.message);
      }

      return {
        id: log.id,
        success: true,
        smsCount: log.smsCount,
        segmentWarning: segmentInfo.warning ?? null,
        status: log.status,
      };
    } catch (err) {
      if (log.status === SmsMessageStatus.QUEUED) {
        log.status = SmsMessageStatus.FAILED;
        log.errorMessage = (err as Error).message;
        await this.logRepo.save(log);
      }
      throw err;
    }
  }

  async bulkSend(dto: BulkSmsDto, apiKey: ApiKey) {
    const settings = await this.ensureSettings();
    this.assertCanSend(settings);

    const message = dto.message?.trim();
    if (!message) throw new BadRequestException('Message cannot be empty');
    if (!dto.recipients?.length) throw new BadRequestException('No recipients provided');

    const segmentInfo = calculateSmsSegments(message);
    const credentials = this.getCredentials(settings);

    const normalizedRecipients: Array<{
      phone: ReturnType<typeof normalizeSmsPhone>;
      customerId?: string;
    }> = [];

    for (const r of dto.recipients) {
      const phone = normalizeSmsPhone(r.phone);
      if (!phone) {
        throw new BadRequestException(`Invalid phone: ${r.phone}`);
      }
      normalizedRecipients.push({ phone, customerId: r.customerId });
    }

    const phones = normalizedRecipients.map(r => r.phone!.providerFormat);

    const logs: SmsMessageLog[] = [];
    for (const r of normalizedRecipients) {
      const log = this.logRepo.create({
        provider: settings.provider,
        toPhone: r.phone!.raw,
        normalizedPhone: r.phone!.normalized,
        customerId: r.customerId ?? null,
        message,
        smsCount: segmentInfo.smsCount || 1,
        status: SmsMessageStatus.QUEUED,
        sentBy: apiKey.id,
        relatedType: 'campaign',
      });
      logs.push(await this.logRepo.save(log));
    }

    try {
      const result = await this.mobishastra.sendBulk(credentials, phones, message);

      const now = result.success ? new Date() : null;
      for (const log of logs) {
        log.status = result.success ? SmsMessageStatus.SENT : SmsMessageStatus.FAILED;
        log.providerResponse = result.rawResponse;
        log.providerMessageId = result.providerMessageId ?? null;
        log.errorCode = result.success ? null : result.code;
        log.errorMessage = result.success ? null : result.message;
        log.sentAt = now;
        await this.logRepo.save(log);
      }

      void this.auditService.logInfo(AuditAction.SMS_BULK_SENT, {
        metadata: {
          apiKeyId: apiKey.id,
          recipientCount: logs.length,
          success: result.success,
          totalSmsCount: logs.length * (segmentInfo.smsCount || 1),
        },
      });

      if (!result.success) {
        throw new BadRequestException(result.message);
      }

      return {
        success: true,
        recipientCount: logs.length,
        smsCountPerRecipient: segmentInfo.smsCount || 1,
        totalSmsCount: logs.length * (segmentInfo.smsCount || 1),
        segmentWarning: segmentInfo.warning ?? null,
        logIds: logs.map(l => l.id),
      };
    } catch (err) {
      for (const log of logs) {
        if (log.status === SmsMessageStatus.QUEUED) {
          log.status = SmsMessageStatus.FAILED;
          log.errorMessage = (err as Error).message;
          await this.logRepo.save(log);
        }
      }
      throw err;
    }
  }

  async getLogs(
    apiKey: ApiKey,
    filters: { status?: string; q?: string; period?: string; sentBy?: string },
  ) {
    const qb = this.logRepo.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');

    if (apiKey.role !== ApiKeyRole.ADMIN) {
      qb.andWhere('log.sentBy = :sentBy', { sentBy: apiKey.id });
    } else if (filters.sentBy === 'me') {
      qb.andWhere('log.sentBy = :sentBy', { sentBy: apiKey.id });
    }

    if (filters.status === 'sent') {
      qb.andWhere('log.status = :st', { st: SmsMessageStatus.SENT });
    } else if (filters.status === 'failed') {
      qb.andWhere('log.status = :st', { st: SmsMessageStatus.FAILED });
    }

    if (filters.period === 'today') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      qb.andWhere('log.createdAt >= :start', { start });
    } else if (filters.period === 'week') {
      const start = new Date();
      start.setDate(start.getDate() - 7);
      qb.andWhere('log.createdAt >= :start', { start });
    }

    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      qb.andWhere(
        '(log.normalizedPhone LIKE :q OR log.toPhone LIKE :q OR log.message LIKE :q OR log.status LIKE :q OR log.customerId LIKE :q)',
        { q },
      );
    }

    const logs = await qb.take(200).getMany();
    return logs.map(l => ({
      id: l.id,
      provider: l.provider,
      toPhone: l.toPhone,
      normalizedPhone: l.normalizedPhone,
      customerId: l.customerId,
      conversationId: l.conversationId,
      relatedType: l.relatedType,
      relatedId: l.relatedId,
      message: l.message,
      messagePreview: l.message.length > 80 ? `${l.message.slice(0, 80)}…` : l.message,
      smsCount: l.smsCount,
      status: l.status,
      providerMessageId: l.providerMessageId,
      providerResponse: l.providerResponse,
      errorCode: l.errorCode,
      errorMessage: l.errorMessage,
      sentBy: l.sentBy,
      sentAt: l.sentAt?.toISOString() ?? null,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  previewSegments(message: string) {
    return calculateSmsSegments(message ?? '');
  }

  /** AI global search — logs only; never returns credentials. */
  async searchForAi(query: string, limit = 10) {
    const q = query.trim();
    if (!q) {
      return { logs: [], settingsLink: null as null | Record<string, unknown> };
    }

    const settings = await this.ensureSettings();
    const settingsLink = this.buildAiSettingsLink(q, settings);

    const like = `%${q}%`;
    const logs = await this.logRepo
      .createQueryBuilder('log')
      .where(
        '(log.normalizedPhone LIKE :like OR log.toPhone LIKE :like OR log.message LIKE :like OR log.status LIKE :like OR log.errorMessage LIKE :like OR log.relatedType LIKE :like)',
        { like },
      )
      .orderBy('log.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 25))
      .getMany();

    return {
      settingsLink,
      logs: logs.map(l => ({
        id: l.id,
        toPhone: l.toPhone,
        normalizedPhone: l.normalizedPhone,
        messagePreview: l.message.length > 120 ? `${l.message.slice(0, 120)}…` : l.message,
        status: l.status,
        smsCount: l.smsCount,
        relatedType: l.relatedType,
        relatedId: l.relatedId,
        errorMessage: l.errorMessage,
        sentAt: l.sentAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  private buildAiSettingsLink(query: string, settings: SmsProviderSettings) {
    const q = query.toLowerCase();
    const smsTerms = ['sms', 'mobishastra', 'text message', 'outgoing sms'];
    if (!smsTerms.some(term => q.includes(term))) return null;
    const status = this.getPublicStatus(settings);
    return {
      title: 'SMS channel settings',
      path: '/channels?channel=sms',
      provider: settings.provider,
      status: status.status,
      configured: status.configured,
      connected: status.connected,
      lastBalance: status.lastBalance,
      note: 'Credentials are never included in search results.',
    };
  }
}
