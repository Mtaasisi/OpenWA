import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { inferStorageChatType } from '../../common/utils/conversation-type.util';
import {
  StorageConfig,
  STORAGE_CONFIG_ID,
  buildDefaultStorageConfig,
} from './entities/storage-config.entity';
import { StorageSessionOverride } from './entities/storage-session-override.entity';
import type {
  EffectiveStorageSettings,
  GlobalStorageSettings,
  StorageSessionOverride as StorageSessionOverrideDto,
  StorageSettingsResponse,
  ChatTypeStorageSettings,
} from './storage.types';
import {
  DEFAULT_GLOBAL_SETTINGS,
  mergeChatTypeSettings,
  mergeSessionOverride,
} from './utils/storage-policy.util';
import type { StorageChatType } from '../../common/utils/conversation-type.util';

@Injectable()
export class StorageSettingsService {
  constructor(
    @InjectRepository(StorageConfig, 'data')
    private readonly configRepo: Repository<StorageConfig>,
    @InjectRepository(StorageSessionOverride, 'data')
    private readonly sessionOverrideRepo: Repository<StorageSessionOverride>,
  ) {}

  async ensureConfig(): Promise<StorageConfig> {
    let row = await this.configRepo.findOne({ where: { id: STORAGE_CONFIG_ID } });
    if (!row) {
      const defaults = buildDefaultStorageConfig();
      row = this.configRepo.create({
        id: STORAGE_CONFIG_ID,
        globalSettings: defaults.globalSettings,
        chatTypeSettings: defaults.chatTypeSettings,
      });
      await this.configRepo.save(row);
    }
    return row;
  }

  async getSettings(): Promise<StorageSettingsResponse> {
    const row = await this.ensureConfig();
    const defaults = buildDefaultStorageConfig();
    const global: GlobalStorageSettings = {
      ...DEFAULT_GLOBAL_SETTINGS,
      ...(row.globalSettings ?? {}),
    };

    const chatTypes = { ...defaults.chatTypeSettings };
    for (const key of Object.keys(chatTypes) as StorageChatType[]) {
      chatTypes[key] = mergeChatTypeSettings(key, row.chatTypeSettings?.[key]);
    }

    const overrides = await this.sessionOverrideRepo.find();
    const sessionOverrides: StorageSessionOverrideDto[] = overrides.map(o => ({
      sessionId: o.sessionId,
      allowGroupAutoDownload: o.allowGroupAutoDownload,
      manualDownloadOnlyForGroups: o.manualDownloadOnlyForGroups,
      autoDownloadImages: o.autoDownloadImages ?? undefined,
      autoDownloadVideos: o.autoDownloadVideos ?? undefined,
      autoDownloadDocuments: o.autoDownloadDocuments ?? undefined,
      autoDownloadAudio: o.autoDownloadAudio ?? undefined,
      autoDownloadVoice: o.autoDownloadVoice ?? undefined,
      autoDownloadStickers: o.autoDownloadStickers ?? undefined,
    }));

    return { global, chatTypes: chatTypes as Record<StorageChatType, ChatTypeStorageSettings>, sessionOverrides };
  }

  async saveSettings(payload: Partial<StorageSettingsResponse>): Promise<StorageSettingsResponse> {
    const row = await this.ensureConfig();
    if (payload.global) {
      row.globalSettings = { ...(row.globalSettings ?? DEFAULT_GLOBAL_SETTINGS), ...payload.global };
    }
    if (payload.chatTypes) {
      row.chatTypeSettings = {
        ...(row.chatTypeSettings ?? {}),
        ...payload.chatTypes,
      };
    }
    await this.configRepo.save(row);

    if (payload.sessionOverrides) {
      for (const override of payload.sessionOverrides) {
        await this.sessionOverrideRepo.save(
          this.sessionOverrideRepo.create({
            sessionId: override.sessionId,
            allowGroupAutoDownload: override.allowGroupAutoDownload ?? false,
            manualDownloadOnlyForGroups: override.manualDownloadOnlyForGroups ?? true,
            autoDownloadImages: override.autoDownloadImages ?? null,
            autoDownloadVideos: override.autoDownloadVideos ?? null,
            autoDownloadDocuments: override.autoDownloadDocuments ?? null,
            autoDownloadAudio: override.autoDownloadAudio ?? null,
            autoDownloadVoice: override.autoDownloadVoice ?? null,
            autoDownloadStickers: override.autoDownloadStickers ?? null,
          }),
        );
      }
    }

    return this.getSettings();
  }

  async getEffectiveSettings(
    sessionId: string,
    chatId: string,
  ): Promise<EffectiveStorageSettings> {
    const settings = await this.getSettings();
    const chatType = inferStorageChatType(chatId);
    const chatTypeSettings = settings.chatTypes[chatType] ?? settings.chatTypes.unknown;

    let merged: EffectiveStorageSettings = {
      ...settings.global,
      ...chatTypeSettings,
      chatType,
    };

    const sessionOverride = settings.sessionOverrides.find(o => o.sessionId === sessionId);
    if (sessionOverride) {
      merged = { ...merged, ...mergeSessionOverride(merged, sessionOverride), chatType };
    }

    return merged;
  }
}
