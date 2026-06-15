import type { StorageChatType } from '../../common/utils/conversation-type.util';

export type MediaKind = 'image' | 'video' | 'document' | 'audio' | 'voice' | 'sticker';

export type MediaStatus =
  | 'not_downloaded'
  | 'downloading'
  | 'downloaded'
  | 'failed'
  | 'deleted';

export interface ChatTypeStorageSettings {
  autoDownloadImages: boolean;
  autoDownloadVideos: boolean;
  autoDownloadDocuments: boolean;
  autoDownloadAudio: boolean;
  autoDownloadVoice: boolean;
  autoDownloadStickers: boolean;
}

export interface GlobalStorageSettings {
  maxAutoDownloadSizeMb: number;
  keepMediaDays: number;
  excludeStarredMediaFromCleanup: boolean;
  allowGroupAutoDownload: boolean;
  manualDownloadOnlyForGroups: boolean;
}

export interface StorageSessionOverride {
  sessionId: string;
  allowGroupAutoDownload?: boolean;
  manualDownloadOnlyForGroups?: boolean;
  autoDownloadImages?: boolean;
  autoDownloadVideos?: boolean;
  autoDownloadDocuments?: boolean;
  autoDownloadAudio?: boolean;
  autoDownloadVoice?: boolean;
  autoDownloadStickers?: boolean;
}

export interface EffectiveStorageSettings extends ChatTypeStorageSettings, GlobalStorageSettings {
  chatType: StorageChatType;
}

export interface StorageSettingsResponse {
  global: GlobalStorageSettings;
  chatTypes: Record<StorageChatType, ChatTypeStorageSettings>;
  sessionOverrides: StorageSessionOverride[];
}

export const STORAGE_CHAT_TYPES: StorageChatType[] = [
  'direct_customer',
  'group',
  'broadcast',
  'internal',
  'system',
  'unknown',
];
