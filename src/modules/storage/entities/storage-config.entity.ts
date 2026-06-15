import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';
import type { StorageChatType } from '../../../common/utils/conversation-type.util';
import type { ChatTypeStorageSettings, GlobalStorageSettings } from '../storage.types';
import { DEFAULT_GLOBAL_SETTINGS, defaultChatTypeSettings } from '../utils/storage-policy.util';

export const STORAGE_CONFIG_ID = 'default';

@Entity('storage_config')
export class StorageConfig {
  @PrimaryColumn({ default: STORAGE_CONFIG_ID })
  id: string;

  @Column({ type: 'simple-json', nullable: true })
  globalSettings: GlobalStorageSettings | null;

  @Column({ type: 'simple-json', nullable: true })
  chatTypeSettings: Partial<Record<StorageChatType, ChatTypeStorageSettings>> | null;

  @UpdateDateColumn()
  updatedAt: Date;
}

export function buildDefaultStorageConfig(): {
  globalSettings: GlobalStorageSettings;
  chatTypeSettings: Record<StorageChatType, ChatTypeStorageSettings>;
} {
  return {
    globalSettings: { ...DEFAULT_GLOBAL_SETTINGS },
    chatTypeSettings: {
      direct_customer: defaultChatTypeSettings('direct_customer'),
      group: defaultChatTypeSettings('group'),
      broadcast: defaultChatTypeSettings('broadcast'),
      internal: defaultChatTypeSettings('internal'),
      system: defaultChatTypeSettings('system'),
      unknown: defaultChatTypeSettings('unknown'),
    },
  };
}
