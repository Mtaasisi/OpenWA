import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from '../message/entities/message.entity';
import { inferStorageChatType, messageTypeToMediaKind } from '../../common/utils/conversation-type.util';
import { StorageSettingsService } from './storage-settings.service';
import { shouldAutoDownloadMedia } from './utils/storage-policy.util';
import type { MediaStatus } from './storage.types';

export interface MessageMediaMeta {
  mimetype?: string;
  filename?: string;
  hasData?: boolean;
  storagePath?: string;
  hasMedia?: boolean;
  mediaStatus?: MediaStatus;
  sizeBytes?: number;
  starred?: boolean;
}

@Injectable()
export class StoragePolicyService {
  constructor(private readonly settingsService: StorageSettingsService) {}

  async shouldAutoDownload(message: Message): Promise<boolean> {
    const meta = (message.metadata as { media?: MessageMediaMeta } | null)?.media;
    if (meta?.storagePath) return true;

    const settings = await this.settingsService.getEffectiveSettings(
      message.sessionId,
      message.chatId,
    );

    return shouldAutoDownloadMedia({
      chatType: inferStorageChatType(message.chatId),
      messageType: message.type,
      settings,
      sizeBytes: meta?.sizeBytes,
      fromMe: message.direction === 'outgoing',
    });
  }

  getMediaMeta(message: Message): MessageMediaMeta | null {
    return (message.metadata as { media?: MessageMediaMeta } | null)?.media ?? null;
  }

  classifyMediaKind(message: Message): string | null {
    return messageTypeToMediaKind(message.type);
  }
}
