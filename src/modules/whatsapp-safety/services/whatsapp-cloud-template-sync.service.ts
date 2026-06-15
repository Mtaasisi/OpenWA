import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupMessageTemplate } from '../../followup/entities/followup-message-template.entity';
import { WhatsAppTemplateStatus } from '../../followup/followup.enums';
import { WhatsAppSafetySettingsService } from './whatsapp-safety-settings.service';

const GRAPH_API_VERSION = 'v21.0';

interface MetaCloudTemplate {
  name: string;
  status: string;
  language?: string;
}

interface MetaCloudTemplatesResponse {
  data?: MetaCloudTemplate[];
  paging?: { next?: string };
}

export interface WhatsAppTemplateSyncStatus {
  enabled: boolean;
  configured: boolean;
  hasAccessToken: boolean;
  phoneNumberIdConfigured: boolean;
  cloudSendReady: boolean;
  wabaId: string | null;
  lastSyncAt: string | null;
  lastSyncSummary: string | null;
}

export interface WhatsAppTemplateSyncResult {
  matched: number;
  updated: number;
  unchanged: number;
  unmatchedLocal: number;
  unmatchedCloud: number;
  errors: string[];
  syncedAt: string;
}

export interface WhatsAppSafetyTemplateRow {
  id: string;
  name: string;
  whatsappTemplateName: string | null;
  whatsappTemplateStatus: string;
  requiresWhatsappApproval: boolean;
  category: string;
  isActive: boolean;
}

export interface WhatsAppCloudConnectionTestResult {
  ok: boolean;
  configured: boolean;
  hasAccessToken: boolean;
  wabaId: string | null;
  wabaName?: string | null;
  templateCount?: number;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
  error?: string | null;
}

@Injectable()
export class WhatsAppCloudTemplateSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppCloudTemplateSyncService.name);
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(FollowupMessageTemplate, 'data')
    private readonly templateRepo: Repository<FollowupMessageTemplate>,
    private readonly settingsService: WhatsAppSafetySettingsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const hours = Number(this.config.get('WHATSAPP_CLOUD_SYNC_INTERVAL_HOURS') ?? 0);
    if (hours > 0) {
      const ms = hours * 60 * 60 * 1000;
      this.syncTimer = setInterval(() => void this.syncIfConfigured(), ms);
      this.syncTimer.unref?.();
      this.logger.log(`Scheduled cloud template sync every ${hours}h`);
    }
  }

  onModuleDestroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  async syncIfConfigured(): Promise<WhatsAppTemplateSyncResult | null> {
    try {
      const status = await this.getSyncStatus();
      if (!status.configured) return null;
      return await this.syncFromCloud();
    } catch (err) {
      this.logger.warn(`Scheduled template sync failed: ${String(err)}`);
      return null;
    }
  }

  async getSyncStatus(): Promise<WhatsAppTemplateSyncStatus> {
    const settings = await this.settingsService.getGlobal();
    const token = this.getAccessToken();
    const phoneNumberIdConfigured = Boolean(
      this.config.get<string>('WHATSAPP_CLOUD_PHONE_NUMBER_ID')?.trim(),
    );
    return {
      enabled: settings.whatsappCloudSyncEnabled,
      configured: Boolean(settings.whatsappCloudSyncEnabled && settings.whatsappCloudWabaId && token),
      hasAccessToken: Boolean(token),
      phoneNumberIdConfigured,
      cloudSendReady: Boolean(token && phoneNumberIdConfigured),
      wabaId: settings.whatsappCloudWabaId,
      lastSyncAt: settings.whatsappCloudLastSyncAt?.toISOString() ?? null,
      lastSyncSummary: settings.whatsappCloudLastSyncSummary,
    };
  }

  async testCloudConnection(): Promise<WhatsAppCloudConnectionTestResult> {
    const settings = await this.settingsService.getGlobal();
    const token = this.getAccessToken();
    const wabaId = settings.whatsappCloudWabaId?.trim() || null;
    const base: WhatsAppCloudConnectionTestResult = {
      ok: false,
      configured: Boolean(token && wabaId),
      hasAccessToken: Boolean(token),
      wabaId,
      error: null,
    };

    if (!token) {
      return {
        ...base,
        error: 'WHATSAPP_CLOUD_ACCESS_TOKEN is not configured on the server.',
      };
    }
    if (!wabaId) {
      return {
        ...base,
        error: 'WhatsApp Business Account ID (WABA ID) is required in Settings.',
      };
    }

    try {
      const wabaRes = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}?fields=id,name&access_token=${encodeURIComponent(token)}`,
      );
      if (!wabaRes.ok) {
        const body = await wabaRes.text();
        return {
          ...base,
          error: `WABA lookup failed (${wabaRes.status}): ${body.slice(0, 200)}`,
        };
      }
      const wabaJson = (await wabaRes.json()) as { id?: string; name?: string };
      const templates = await this.fetchAllCloudTemplates(wabaId, token);

      const phoneNumberId = this.config.get<string>('WHATSAPP_CLOUD_PHONE_NUMBER_ID')?.trim();
      let displayPhoneNumber: string | undefined;
      if (phoneNumberId) {
        const phoneRes = await fetch(
          `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name&access_token=${encodeURIComponent(token)}`,
        );
        if (phoneRes.ok) {
          const phoneJson = (await phoneRes.json()) as { display_phone_number?: string };
          displayPhoneNumber = phoneJson.display_phone_number;
        }
      }

      return {
        ...base,
        ok: true,
        configured: true,
        wabaName: wabaJson.name ?? null,
        templateCount: templates.length,
        phoneNumberId: phoneNumberId ?? null,
        displayPhoneNumber: displayPhoneNumber ?? null,
      };
    } catch (err) {
      return { ...base, error: String(err) };
    }
  }

  async listApprovalTemplates(): Promise<WhatsAppSafetyTemplateRow[]> {
    const rows = await this.templateRepo.find({
      where: { requiresWhatsappApproval: true },
      order: { name: 'ASC' },
    });
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      whatsappTemplateName: row.whatsappTemplateName,
      whatsappTemplateStatus: row.whatsappTemplateStatus,
      requiresWhatsappApproval: row.requiresWhatsappApproval,
      category: row.category,
      isActive: row.isActive,
    }));
  }

  async syncFromCloud(): Promise<WhatsAppTemplateSyncResult> {
    const settings = await this.settingsService.getGlobal();
    if (!settings.whatsappCloudSyncEnabled) {
      throw new BadRequestException(
        'WhatsApp Cloud template sync is disabled. Enable it in Settings → WhatsApp Safety.',
      );
    }

    const wabaId = settings.whatsappCloudWabaId?.trim();
    const token = this.getAccessToken();
    if (!wabaId) {
      throw new BadRequestException('WhatsApp Business Account ID (WABA ID) is required.');
    }
    if (!token) {
      throw new BadRequestException(
        'WHATSAPP_CLOUD_ACCESS_TOKEN is not configured on the server.',
      );
    }

    const cloudTemplates = await this.fetchAllCloudTemplates(wabaId, token);
    const localTemplates = await this.templateRepo.find({
      where: { requiresWhatsappApproval: true },
    });

    const cloudByName = new Map<string, MetaCloudTemplate>();
    for (const tpl of cloudTemplates) {
      cloudByName.set(this.normalizeName(tpl.name), tpl);
    }

    let matched = 0;
    let updated = 0;
    let unchanged = 0;
    let unmatchedLocal = 0;
    const errors: string[] = [];
    const matchedCloudNames = new Set<string>();

    for (const local of localTemplates) {
      const metaName = local.whatsappTemplateName?.trim();
      if (!metaName) {
        unmatchedLocal += 1;
        errors.push(`Local template "${local.name}" requires approval but has no WhatsApp template name`);
        continue;
      }

      const cloud = cloudByName.get(this.normalizeName(metaName));
      if (!cloud) {
        unmatchedLocal += 1;
        errors.push(`No Meta template found for "${metaName}" (local: "${local.name}")`);
        continue;
      }

      matched += 1;
      matchedCloudNames.add(this.normalizeName(cloud.name));
      const nextStatus = this.mapMetaStatus(cloud.status);
      if (local.whatsappTemplateStatus !== nextStatus) {
        local.whatsappTemplateStatus = nextStatus;
        await this.templateRepo.save(local);
        updated += 1;
      } else {
        unchanged += 1;
      }
    }

    const unmatchedCloud = cloudTemplates.filter(
      tpl => !matchedCloudNames.has(this.normalizeName(tpl.name)),
    ).length;

    const result: WhatsAppTemplateSyncResult = {
      matched,
      updated,
      unchanged,
      unmatchedLocal,
      unmatchedCloud,
      errors: errors.slice(0, 20),
      syncedAt: new Date().toISOString(),
    };

    const summary = `matched ${matched}, updated ${updated}, unchanged ${unchanged}, unmatched local ${unmatchedLocal}, unmatched cloud ${unmatchedCloud}`;
    await this.settingsService.updateGlobal({
      whatsappCloudLastSyncAt: new Date(),
      whatsappCloudLastSyncSummary: summary,
    });

    this.logger.log(`Cloud template sync complete: ${summary}`);
    return result;
  }

  mapMetaStatus(status: string): WhatsAppTemplateStatus {
    const normalized = status.trim().toUpperCase();
    if (normalized === 'APPROVED') return WhatsAppTemplateStatus.APPROVED;
    if (['REJECTED', 'PAUSED', 'DISABLED'].includes(normalized)) {
      return WhatsAppTemplateStatus.REJECTED;
    }
    return WhatsAppTemplateStatus.PENDING;
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase();
  }

  private getAccessToken(): string | undefined {
    return this.config.get<string>('WHATSAPP_CLOUD_ACCESS_TOKEN')?.trim() || undefined;
  }

  private async fetchAllCloudTemplates(wabaId: string, token: string): Promise<MetaCloudTemplate[]> {
    const fields = 'name,status,language';
    let url: string | undefined =
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(wabaId)}/message_templates?fields=${fields}&limit=100&access_token=${encodeURIComponent(token)}`;

    const templates: MetaCloudTemplate[] = [];
    while (url) {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text();
        throw new BadRequestException(
          `Meta Graph API error (${res.status}): ${body.slice(0, 300)}`,
        );
      }
      const json = (await res.json()) as MetaCloudTemplatesResponse;
      templates.push(...(json.data ?? []));
      url = json.paging?.next;
    }
    return templates;
  }
}
