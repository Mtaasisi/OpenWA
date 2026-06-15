import type { StorageChatType } from '../../../common/utils/conversation-type.util';
import { messageTypeToMediaKind } from '../../../common/utils/conversation-type.util';
import type {
  ChatTypeStorageSettings,
  GlobalStorageSettings,
  MediaKind,
  StorageSessionOverride,
} from '../storage.types';

export const DEFAULT_GLOBAL_SETTINGS: GlobalStorageSettings = {
  maxAutoDownloadSizeMb: 5,
  keepMediaDays: 90,
  excludeStarredMediaFromCleanup: true,
  allowGroupAutoDownload: false,
  manualDownloadOnlyForGroups: true,
};

export function defaultChatTypeSettings(chatType: StorageChatType): ChatTypeStorageSettings {
  switch (chatType) {
    case 'direct_customer':
      return {
        autoDownloadImages: true,
        autoDownloadVideos: false,
        autoDownloadDocuments: false,
        autoDownloadAudio: false,
        autoDownloadVoice: false,
        autoDownloadStickers: false,
      };
    case 'group':
      return {
        autoDownloadImages: false,
        autoDownloadVideos: false,
        autoDownloadDocuments: false,
        autoDownloadAudio: false,
        autoDownloadVoice: false,
        autoDownloadStickers: false,
      };
    default:
      return {
        autoDownloadImages: false,
        autoDownloadVideos: false,
        autoDownloadDocuments: false,
        autoDownloadAudio: false,
        autoDownloadVoice: false,
        autoDownloadStickers: false,
      };
  }
}

export function mergeChatTypeSettings(
  chatType: StorageChatType,
  overrides?: Partial<ChatTypeStorageSettings> | null,
): ChatTypeStorageSettings {
  return { ...defaultChatTypeSettings(chatType), ...(overrides ?? {}) };
}

export function mergeSessionOverride(
  base: ChatTypeStorageSettings & GlobalStorageSettings,
  override?: StorageSessionOverride | null,
): ChatTypeStorageSettings & GlobalStorageSettings {
  if (!override) return base;
  return {
    ...base,
    allowGroupAutoDownload:
      override.allowGroupAutoDownload ?? base.allowGroupAutoDownload,
    manualDownloadOnlyForGroups:
      override.manualDownloadOnlyForGroups ?? base.manualDownloadOnlyForGroups,
    autoDownloadImages: override.autoDownloadImages ?? base.autoDownloadImages,
    autoDownloadVideos: override.autoDownloadVideos ?? base.autoDownloadVideos,
    autoDownloadDocuments:
      override.autoDownloadDocuments ?? base.autoDownloadDocuments,
    autoDownloadAudio: override.autoDownloadAudio ?? base.autoDownloadAudio,
    autoDownloadVoice: override.autoDownloadVoice ?? base.autoDownloadVoice,
    autoDownloadStickers:
      override.autoDownloadStickers ?? base.autoDownloadStickers,
  };
}

function isAutoDownloadEnabledForKind(
  kind: MediaKind,
  settings: ChatTypeStorageSettings,
): boolean {
  switch (kind) {
    case 'image':
      return settings.autoDownloadImages;
    case 'video':
      return settings.autoDownloadVideos;
    case 'document':
      return settings.autoDownloadDocuments;
    case 'audio':
      return settings.autoDownloadAudio;
    case 'voice':
      return settings.autoDownloadVoice;
    case 'sticker':
      return settings.autoDownloadStickers;
    default:
      return false;
  }
}

export interface AutoDownloadInput {
  chatType: StorageChatType;
  messageType: string;
  settings: ChatTypeStorageSettings & GlobalStorageSettings;
  sizeBytes?: number | null;
  fromMe?: boolean;
}

/** Decide whether inbound media should auto-download. Outbound always returns true. */
export function shouldAutoDownloadMedia(input: AutoDownloadInput): boolean {
  if (input.fromMe) return true;

  const kind = messageTypeToMediaKind(input.messageType);
  if (!kind) return false;

  const { chatType, settings } = input;

  if (chatType === 'group') {
    if (settings.manualDownloadOnlyForGroups && !settings.allowGroupAutoDownload) {
      return false;
    }
    if (!settings.allowGroupAutoDownload) {
      return false;
    }
  }

  if (!isAutoDownloadEnabledForKind(kind, settings)) {
    return false;
  }

  if (chatType === 'group' && kind === 'video' && !settings.autoDownloadVideos) {
    return false;
  }

  const maxBytes = settings.maxAutoDownloadSizeMb * 1024 * 1024;
  if (input.sizeBytes != null && input.sizeBytes > maxBytes) {
    return false;
  }

  return true;
}
