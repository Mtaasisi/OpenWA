/** Top-level settings sections in the sidebar. */
export type SettingsSection =
  | 'account'
  | 'appearance'
  | 'inbox'
  | 'ai'
  | 'crm'
  | 'integrations'
  | 'system'
  | 'notifications'
  | 'data'
  | 'about';

export const SETTINGS_SECTION_IDS: SettingsSection[] = [
  'account',
  'appearance',
  'inbox',
  'ai',
  'crm',
  'integrations',
  'system',
  'notifications',
  'data',
  'about',
];

/** Legacy section ids redirected on load. */
export const LEGACY_SECTION_ALIASES: Record<string, SettingsSection> = {
  sessions: 'inbox',
  api: 'system',
};

/** All navigable panel ids (integrations + dev tools). */
export const SETTINGS_PANEL_IDS = [
  'ai',
  'ai-auto-reply',
  'ai-human-behavior',
  'ai-knowledge',
  'ai-branch-profile',
  'ai-learning',
  'ai-memory',
  'ai-tools',
  'ai-usage',
  'ai-learning-cache',
  'products',
  'quick-replies',
  'lead-sources',
  'followup-rules',
  'followup-templates',
  'followup-autopilot',
  'whatsapp-safety',
  'webhooks',
  'plugins',
  'infrastructure',
  'users',
  'api-keys',
  'logs',
  'storage-backup',
  'desktop-app',
  'agent-actions-log',
] as const;

export type SettingsPanelId = (typeof SETTINGS_PANEL_IDS)[number];

/** @deprecated Use SettingsPanelId */
export type SettingsIntegrationId = Exclude<SettingsPanelId, 'logs'>;

/** Sidebar category groups (flat nav). */
export type SettingsSidebarGroup =
  | 'general'
  | 'channels'
  | 'ai'
  | 'crm'
  | 'integrations'
  | 'system'
  | 'privacy';

export type SidebarGroupDef = {
  id: SettingsSidebarGroup;
  labelKey: string;
  adminOnly?: boolean;
};

export const SIDEBAR_GROUPS: SidebarGroupDef[] = [
  { id: 'general', labelKey: 'settings.groups.general' },
  { id: 'channels', labelKey: 'settings.groups.channels' },
  { id: 'ai', labelKey: 'settings.groups.ai' },
  { id: 'crm', labelKey: 'settings.groups.crm' },
  { id: 'integrations', labelKey: 'settings.groups.integrations' },
  { id: 'system', labelKey: 'settings.groups.system', adminOnly: true },
  { id: 'privacy', labelKey: 'settings.groups.privacy' },
];

export type SectionSidebarDef = {
  section: SettingsSection;
  group: SettingsSidebarGroup;
  navIcon: string;
  titleKey: string;
  /** Sidebar label when this section has child panels in the same group. */
  navTitleKey?: string;
  /** Optional in-group subsection label. */
  subgroupLabelKey?: string;
  navOrder: number;
  adminOnly?: boolean;
};

/** Section landing pages shown in the settings sidebar. */
export const SECTION_SIDEBAR_NAV: SectionSidebarDef[] = [
  { section: 'account', group: 'general', navIcon: 'account_circle', titleKey: 'settings.sections.account', navOrder: 0 },
  { section: 'appearance', group: 'general', navIcon: 'palette', titleKey: 'settings.sections.appearance', navOrder: 1 },
  { section: 'about', group: 'general', navIcon: 'info', titleKey: 'settings.sections.about', navOrder: 2 },
  {
    section: 'inbox',
    group: 'channels',
    navIcon: 'inbox',
    titleKey: 'settings.sections.inbox',
    subgroupLabelKey: 'settings.nav.subgroups.inbox',
    navOrder: 0,
  },
  {
    section: 'ai',
    group: 'ai',
    navIcon: 'psychology',
    titleKey: 'settings.sections.ai',
    navTitleKey: 'settings.nav.overview',
    navOrder: 0,
  },
  {
    section: 'crm',
    group: 'crm',
    navIcon: 'groups',
    titleKey: 'settings.sections.crm',
    navTitleKey: 'settings.nav.overview',
    navOrder: 0,
    adminOnly: true,
  },
  {
    section: 'integrations',
    group: 'integrations',
    navIcon: 'hub',
    titleKey: 'settings.sections.integrations',
    navTitleKey: 'settings.nav.overview',
    navOrder: 0,
  },
  {
    section: 'system',
    group: 'system',
    navIcon: 'settings_suggest',
    titleKey: 'settings.sections.system',
    navTitleKey: 'settings.nav.overview',
    navOrder: 0,
    adminOnly: true,
  },
  {
    section: 'notifications',
    group: 'privacy',
    navIcon: 'notification_important',
    titleKey: 'settings.sections.notifications',
    subgroupLabelKey: 'settings.nav.subgroups.alerts',
    navOrder: 0,
  },
  {
    section: 'data',
    group: 'privacy',
    navIcon: 'privacy_tip',
    titleKey: 'settings.sections.data',
    subgroupLabelKey: 'settings.nav.subgroups.privacyData',
    navOrder: 1,
  },
];

export type RouteSidebarDef = {
  id: string;
  group: SettingsSidebarGroup;
  navIcon: string;
  titleKey: string;
  path: string;
  subgroupLabelKey?: string;
  navOrder: number;
  adminOnly?: boolean;
};

/** External workspace routes linked from the settings sidebar. */
export const ROUTE_SIDEBAR_NAV: RouteSidebarDef[] = [
  {
    id: 'whatsapp-channel',
    group: 'channels',
    navIcon: 'chat',
    titleKey: 'channels.whatsapp',
    path: '/channels?channel=whatsapp',
    subgroupLabelKey: 'settings.nav.subgroups.connections',
    navOrder: 1,
  },
  {
    id: 'sms-channel',
    group: 'channels',
    navIcon: 'sms',
    titleKey: 'channels.smsSetupTitle',
    path: '/channels?channel=sms',
    subgroupLabelKey: 'settings.nav.subgroups.connections',
    navOrder: 2,
  },
  {
    id: 'followup-rules',
    group: 'crm',
    navIcon: 'rule',
    titleKey: 'followups.rules.title',
    path: '/automations?tab=rules',
    subgroupLabelKey: 'settings.nav.subgroups.followupAutomation',
    navOrder: 2,
    adminOnly: true,
  },
  {
    id: 'followup-autopilot',
    group: 'crm',
    navIcon: 'auto_mode',
    titleKey: 'followups.autopilot.settingsTitle',
    path: '/automations?tab=autopilot',
    subgroupLabelKey: 'settings.nav.subgroups.followupAutomation',
    navOrder: 4,
    adminOnly: true,
  },
  {
    id: 'ai-auto-reply',
    group: 'ai',
    navIcon: 'forum',
    titleKey: 'automations.tabs.autoReply',
    path: '/automations?tab=autoReply',
    subgroupLabelKey: 'settings.nav.subgroups.aiCore',
    navOrder: 2,
    adminOnly: true,
  },
];

export type PanelDef = {
  id: SettingsPanelId;
  section: SettingsSection;
  titleKey: string;
  /** Material Symbol name for hub cards and sidebar. */
  navIcon: string;
  /** Optional sidebar-only icon (e.g. AI config uses tune vs psychology on hub). */
  sidebarNavIcon?: string;
  /** Optional sidebar label override. */
  navTitleKey?: string;
  /** Optional in-group subsection label. */
  subgroupLabelKey?: string;
  /** Sidebar category; omit to hide from flat nav. */
  sidebarGroup?: SettingsSidebarGroup;
  /** Order within the sidebar category. */
  sidebarNavOrder?: number;
  adminOnly?: boolean;
  /** Requires quick-reply manage permission */
  quickReplyManage?: boolean;
  /** Requires follow-up message template manage permission */
  followupTemplateManage?: boolean;
  /** Requires ai.cost.view permission */
  aiCostView?: boolean;
  /** Requires ai.cost.manage permission */
  aiCostManage?: boolean;
  filledWhenActive?: boolean;
  /** Hub card sort order within section. */
  sidebarOrder: number;
};

export const PANEL_REGISTRY: Record<SettingsPanelId, PanelDef> = {
  ai: {
    id: 'ai',
    section: 'ai',
    titleKey: 'ai.settings.title',
    navTitleKey: 'settings.ai.configureAi',
    navIcon: 'psychology',
    sidebarNavIcon: 'tune',
    subgroupLabelKey: 'settings.nav.subgroups.aiCore',
    sidebarGroup: 'ai',
    sidebarNavOrder: 1,
    adminOnly: true,
    sidebarOrder: 1,
  },
  'ai-auto-reply': {
    id: 'ai-auto-reply',
    section: 'ai',
    titleKey: 'automations.tabs.autoReply',
    navIcon: 'forum',
    subgroupLabelKey: 'settings.nav.subgroups.aiCore',
    sidebarGroup: 'ai',
    sidebarNavOrder: 2,
    adminOnly: true,
    sidebarOrder: 1,
  },
  'ai-human-behavior': {
    id: 'ai-human-behavior',
    section: 'ai',
    titleKey: 'ai.settings.humanBehaviorTitle',
    navIcon: 'schedule',
    subgroupLabelKey: 'settings.nav.subgroups.aiCore',
    sidebarGroup: 'ai',
    sidebarNavOrder: 2,
    adminOnly: true,
    sidebarOrder: 1,
  },
  'ai-tools': {
    id: 'ai-tools',
    section: 'ai',
    titleKey: 'ai.toolsCatalog.title',
    navIcon: 'smart_toy',
    subgroupLabelKey: 'settings.nav.subgroups.aiCore',
    sidebarGroup: 'ai',
    sidebarNavOrder: 3,
    sidebarOrder: 2,
  },
  'ai-usage': {
    id: 'ai-usage',
    section: 'ai',
    titleKey: 'ai.usage.title',
    navTitleKey: 'ai.usage.navTitle',
    navIcon: 'payments',
    subgroupLabelKey: 'settings.nav.subgroups.aiCore',
    sidebarGroup: 'ai',
    sidebarNavOrder: 2,
    aiCostView: true,
    sidebarOrder: 1,
  },
  'ai-learning-cache': {
    id: 'ai-learning-cache',
    section: 'ai',
    titleKey: 'ai.learningCache.title',
    navTitleKey: 'ai.learningCache.navTitle',
    navIcon: 'school',
    subgroupLabelKey: 'settings.nav.subgroups.aiKnowledge',
    sidebarGroup: 'ai',
    sidebarNavOrder: 5,
    aiCostView: true,
    adminOnly: true,
    sidebarOrder: 4,
  },
  'ai-knowledge': {
    id: 'ai-knowledge',
    section: 'ai',
    titleKey: 'ai.knowledge.title',
    navIcon: 'menu_book',
    subgroupLabelKey: 'settings.nav.subgroups.aiKnowledge',
    sidebarGroup: 'ai',
    sidebarNavOrder: 4,
    adminOnly: true,
    sidebarOrder: 3,
  },
  'ai-memory': {
    id: 'ai-memory',
    section: 'ai',
    titleKey: 'ai.memory.title',
    navIcon: 'memory',
    subgroupLabelKey: 'settings.nav.subgroups.aiKnowledge',
    sidebarGroup: 'ai',
    sidebarNavOrder: 5,
    adminOnly: true,
    sidebarOrder: 4,
  },
  'ai-learning': {
    id: 'ai-learning',
    section: 'ai',
    titleKey: 'ai.learning.title',
    navTitleKey: 'ai.learning.navTitle',
    navIcon: 'trending_up',
    subgroupLabelKey: 'settings.nav.subgroups.aiKnowledge',
    sidebarGroup: 'ai',
    sidebarNavOrder: 6,
    adminOnly: true,
    sidebarOrder: 5,
  },
  'ai-branch-profile': {
    id: 'ai-branch-profile',
    section: 'ai',
    titleKey: 'ai.branchProfile.title',
    navTitleKey: 'ai.branchProfile.navTitle',
    navIcon: 'account_tree',
    subgroupLabelKey: 'settings.nav.subgroups.aiProfile',
    sidebarGroup: 'ai',
    sidebarNavOrder: 7,
    adminOnly: true,
    sidebarOrder: 6,
  },
  'quick-replies': {
    id: 'quick-replies',
    section: 'inbox',
    titleKey: 'quickReplies.settingsTitle',
    navIcon: 'quick_phrases',
    subgroupLabelKey: 'settings.nav.subgroups.connections',
    sidebarGroup: 'channels',
    sidebarNavOrder: 3,
    quickReplyManage: true,
    sidebarOrder: 1,
  },
  'lead-sources': {
    id: 'lead-sources',
    section: 'crm',
    titleKey: 'leadSources.settings.title',
    navIcon: 'track_changes',
    subgroupLabelKey: 'settings.nav.subgroups.leadAttribution',
    sidebarGroup: 'crm',
    sidebarNavOrder: 1,
    adminOnly: true,
    sidebarOrder: 1,
  },
  'followup-rules': {
    id: 'followup-rules',
    section: 'crm',
    titleKey: 'followups.rules.title',
    navIcon: 'rule',
    adminOnly: true,
    sidebarOrder: 2,
  },
  'followup-templates': {
    id: 'followup-templates',
    section: 'crm',
    titleKey: 'followups.templates.title',
    navIcon: 'chat_bubble',
    subgroupLabelKey: 'settings.nav.subgroups.followupAutomation',
    sidebarGroup: 'crm',
    sidebarNavOrder: 3,
    followupTemplateManage: true,
    sidebarOrder: 3,
  },
  'followup-autopilot': {
    id: 'followup-autopilot',
    section: 'crm',
    titleKey: 'followups.autopilot.settingsTitle',
    navIcon: 'auto_mode',
    adminOnly: true,
    sidebarOrder: 4,
  },
  'whatsapp-safety': {
    id: 'whatsapp-safety',
    section: 'integrations',
    titleKey: 'whatsappSafety.title',
    navIcon: 'security_update_good',
    subgroupLabelKey: 'settings.nav.subgroups.catalogIntegrations',
    sidebarGroup: 'integrations',
    sidebarNavOrder: 2,
    adminOnly: true,
    sidebarOrder: 2,
  },
  products: {
    id: 'products',
    section: 'integrations',
    titleKey: 'settings.integrations.productsTitle',
    navTitleKey: 'settings.integrations.productsNav',
    navIcon: 'inventory_2',
    subgroupLabelKey: 'settings.nav.subgroups.catalogIntegrations',
    sidebarGroup: 'integrations',
    sidebarNavOrder: 1,
    sidebarOrder: 1,
  },
  webhooks: {
    id: 'webhooks',
    section: 'integrations',
    titleKey: 'nav.webhooks',
    navIcon: 'webhook',
    subgroupLabelKey: 'settings.nav.subgroups.platformConnectors',
    sidebarGroup: 'integrations',
    sidebarNavOrder: 3,
    adminOnly: true,
    sidebarOrder: 3,
  },
  plugins: {
    id: 'plugins',
    section: 'integrations',
    titleKey: 'nav.plugins',
    navIcon: 'extension',
    subgroupLabelKey: 'settings.nav.subgroups.platformConnectors',
    sidebarGroup: 'integrations',
    sidebarNavOrder: 4,
    adminOnly: true,
    filledWhenActive: true,
    sidebarOrder: 4,
  },
  infrastructure: {
    id: 'infrastructure',
    section: 'integrations',
    titleKey: 'nav.infrastructure',
    navIcon: 'dns',
    subgroupLabelKey: 'settings.nav.subgroups.platformConnectors',
    sidebarGroup: 'integrations',
    sidebarNavOrder: 5,
    adminOnly: true,
    sidebarOrder: 5,
  },
  users: {
    id: 'users',
    section: 'system',
    titleKey: 'nav.users',
    navIcon: 'badge',
    subgroupLabelKey: 'settings.nav.subgroups.access',
    sidebarGroup: 'system',
    sidebarNavOrder: 1,
    adminOnly: true,
    sidebarOrder: 0,
  },
  'api-keys': {
    id: 'api-keys',
    section: 'system',
    titleKey: 'nav.serviceApiKeys',
    navIcon: 'key',
    subgroupLabelKey: 'settings.nav.subgroups.access',
    sidebarGroup: 'system',
    sidebarNavOrder: 2,
    adminOnly: true,
    sidebarOrder: 1,
  },
  logs: {
    id: 'logs',
    section: 'system',
    titleKey: 'nav.logs',
    navIcon: 'history',
    subgroupLabelKey: 'settings.nav.subgroups.developerTools',
    sidebarGroup: 'system',
    sidebarNavOrder: 3,
    adminOnly: true,
    sidebarOrder: 2,
  },
  'storage-backup': {
    id: 'storage-backup',
    section: 'data',
    titleKey: 'settings.storageBackup.pageTitle',
    navTitleKey: 'settings.storageBackup.nav',
    navIcon: 'cloud_sync',
    subgroupLabelKey: 'settings.nav.subgroups.privacyData',
    sidebarGroup: 'privacy',
    sidebarNavOrder: 2,
    adminOnly: true,
    sidebarOrder: 0,
  },
  'desktop-app': {
    id: 'desktop-app',
    section: 'about',
    titleKey: 'settings.desktopApp.title',
    navTitleKey: 'settings.desktopApp.nav',
    navIcon: 'computer',
    sidebarGroup: 'general',
    sidebarNavOrder: 3,
    adminOnly: true,
    sidebarOrder: 2,
  },
  'agent-actions-log': {
    id: 'agent-actions-log',
    section: 'system',
    titleKey: 'settings.agentActions.nav',
    navIcon: 'smart_toy',
    subgroupLabelKey: 'settings.nav.subgroups.developerTools',
    sidebarGroup: 'system',
    sidebarNavOrder: 4,
    adminOnly: true,
    sidebarOrder: 3,
  },
};

/** Sidebar section → panel sub-links (sorted). */
export function panelsForSection(section: SettingsSection): PanelDef[] {
  return Object.values(PANEL_REGISTRY)
    .filter(p => p.section === section)
    .sort((a, b) => a.sidebarOrder - b.sidebarOrder);
}

export function parseSettingsPanelId(value: string | null): SettingsPanelId | null {
  if (!value) return null;
  if (value === 'message-tester') return null;
  if (value === 'inauzwa') return 'products';
  return SETTINGS_PANEL_IDS.includes(value as SettingsPanelId)
    ? (value as SettingsPanelId)
    : null;
}

export function panelTitleKey(id: SettingsPanelId): string {
  return PANEL_REGISTRY[id].titleKey;
}

export function panelMaterialIcon(id: SettingsPanelId, forSidebar = false): string {
  const panel = PANEL_REGISTRY[id];
  if (forSidebar && panel.sidebarNavIcon) return panel.sidebarNavIcon;
  return panel.navIcon;
}

export function panelRequiresAdmin(id: SettingsPanelId): boolean {
  return PANEL_REGISTRY[id].adminOnly === true;
}

export type SettingsPanelAccess = {
  isAdmin: boolean;
  canManageQuickReplies: boolean;
  canManageMessageTemplates: boolean;
  canViewAiCost: boolean;
  canManageAiCost: boolean;
};

export function panelAllowsAccess(id: SettingsPanelId, access: SettingsPanelAccess): boolean {
  const def = PANEL_REGISTRY[id];
  if (def.adminOnly && !access.isAdmin) return false;
  if (def.quickReplyManage && !access.canManageQuickReplies) return false;
  if (def.followupTemplateManage && !access.canManageMessageTemplates) return false;
  if (def.aiCostView && !access.canViewAiCost) return false;
  if (def.aiCostManage && !access.canManageAiCost) return false;
  return true;
}

export function resolvePanelSection(id: SettingsPanelId): SettingsSection {
  return PANEL_REGISTRY[id].section;
}

export type { WhatsAppSafetyTabId } from './whatsapp-safety/whatsapp-safety-tab-ids';

export {
  buildSettingsCategoryParams,
  buildSettingsSearchParams,
  canonicalizeSettingsSearchParams,
  categoryToLegacySection,
  needsSettingsUrlCanonicalization,
  resolveSettingsParams,
  sectionToCategory,
  settingsCategoryHref,
  settingsPanelHref,
  settingsSectionHref,
  whatsappSafetyTabHref,
  type CanonicalSettingsParams,
} from './settings-routing';

/** @deprecated */
export function parseSettingsIntegrationId(value: string | null): SettingsIntegrationId | null {
  const id = parseSettingsPanelId(value);
  if (!id || id === 'logs') return null;
  return id;
}

/** @deprecated */
export function integrationTitleKey(id: SettingsIntegrationId): string {
  return panelTitleKey(id);
}

/** @deprecated */
export function integrationRequiresAdmin(id: SettingsIntegrationId): boolean {
  return panelRequiresAdmin(id);
}

/** @deprecated */
export const SETTINGS_INTEGRATION_IDS = SETTINGS_PANEL_IDS.filter(
  (id): id is SettingsIntegrationId => id !== 'logs',
);

/** @deprecated */
export type SettingsApiToolId = 'logs';

/** @deprecated */
export function parseSettingsApiToolId(value: string | null): SettingsApiToolId | null {
  const id = parseSettingsPanelId(value);
  if (id === 'logs') return id;
  return null;
}

/** @deprecated */
export function apiToolTitleKey(id: SettingsApiToolId): string {
  return panelTitleKey(id);
}
