import type { SettingsPanelId, WhatsAppSafetyTabId } from './settings-nav-registry';

export type SettingsCategoryId =
  | 'profile'
  | 'chats'
  | 'ai'
  | 'business'
  | 'safety'
  | 'system'
  | 'help';

export const SETTINGS_CATEGORY_IDS: SettingsCategoryId[] = [
  'profile',
  'chats',
  'ai',
  'business',
  'safety',
  'system',
  'help',
];

export type SettingsItemPermission =
  | 'admin'
  | 'quickReplyManage'
  | 'followupTemplateManage'
  | 'aiCostView'
  | 'aiCostManage';

export type SettingsItemKind =
  | { kind: 'panel'; panelId: SettingsPanelId }
  | { kind: 'inline'; inlineId: string }
  | { kind: 'route'; path: string }
  | { kind: 'safetyTab'; tab: WhatsAppSafetyTabId };

export type SettingsItem = {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  icon: string;
  keywords?: string[];
  permission?: SettingsItemPermission;
  isAdvanced?: boolean;
  /** Omit from category hub lists; panel/search aliases may still work. */
  hiddenFromHub?: boolean;
  isDanger?: boolean;
  kind: SettingsItemKind;
};

export type SettingsCategory = {
  id: SettingsCategoryId;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  permission?: 'admin';
  items: SettingsItem[];
};

export type SettingsSearchIndexEntry = {
  id: string;
  titleKey: string;
  categoryId: SettingsCategoryId;
  categoryTitleKey: string;
  itemId: string;
  keywords: string[];
  panelId?: SettingsPanelId;
  route?: string;
  inlineId?: string;
};

export type SettingsNavAccess = {
  isAdmin: boolean;
  canManageQuickReplies: boolean;
  canManageMessageTemplates: boolean;
  canViewAiCost: boolean;
  canManageAiCost: boolean;
};
