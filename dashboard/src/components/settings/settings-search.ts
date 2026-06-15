import type { TFunction } from 'i18next';
import {
  PANEL_REGISTRY,
  ROUTE_SIDEBAR_NAV,
  type SettingsPanelId,
  type SettingsSection,
} from './settings-nav-registry';
import {
  getSettingsFlatNav,
  flatNavItemVisible,
  type FlatNavAccess,
  type FlatNavCategory,
  type FlatNavItem,
} from './settings-flat-nav';

export function normalizeSettingsSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesSettingsSearch(haystack: string, query: string): boolean {
  const q = normalizeSettingsSearchQuery(query);
  if (!q) return true;
  const normalizedHaystack = haystack.toLowerCase();
  return q.split(/\s+/).every(token => token.length > 0 && normalizedHaystack.includes(token));
}

function translateSafe(t: TFunction, key: string): string {
  const value = t(key, { defaultValue: '' });
  return value && value !== key ? value : '';
}

export function translateSettingsSearchKeys(t: TFunction, keys: readonly string[]): string {
  return keys.map(key => translateSafe(t, key)).filter(Boolean).join(' ');
}

const SECTION_DESC_KEYS: Partial<Record<SettingsSection, string>> = {
  ai: 'settings.sections.aiDesc',
  crm: 'settings.sections.crmDesc',
};

/** Hub page labels, toggles, and links — used for sidebar + in-page filtering. */
export const SETTINGS_HUB_SEARCH_KEYS: Partial<Record<SettingsSection, string[]>> = {
  account: [
    'settings.sections.account',
    'settings.account.role',
    'settings.account.name',
    'settings.account.email',
    'settings.account.connection',
    'settings.account.online',
    'settings.account.offline',
    'settings.account.switchUser',
    'common.logout',
  ],
  appearance: [
    'settings.sections.appearance',
    'settings.appearance.themeTitle',
    'settings.appearance.manageThemes',
    'settings.appearance.languageTitle',
  ],
  inbox: [
    'settings.sections.inbox',
    'inbox.filter.all',
    'inbox.filter.unread',
    'inbox.filter.overdue',
    'inbox.filter.ai_active',
    'inbox.filter.assigned_to_me',
    'inbox.filter.needs_reply',
    'inbox.filter.needs_human',
    'inbox.filter.ai_opt_out',
    'inbox.filter.private',
    'inbox.filter.groups',
    'inbox.filter.resolved',
    'settings.inbox.layoutTitle',
    'settings.inbox.defaultView',
    'settings.inbox.defaultViewHint',
    'settings.inbox.defaultSession',
    'settings.inbox.defaultSessionHint',
    'settings.inbox.defaultSessionAuto',
    'settings.inbox.defaultFilter',
    'settings.inbox.defaultFilterHint',
    'settings.inbox.myStaffProfile',
    'settings.inbox.myStaffProfileHint',
    'settings.inbox.myStaffProfileNone',
    'settings.inbox.hideGroupsDefault',
    'settings.inbox.hideGroupsDefaultHint',
    'settings.inbox.showCustomerPanel',
    'settings.inbox.showCustomerPanelHint',
    'settings.inbox.showChatList',
    'settings.inbox.showChatListHint',
    'settings.inbox.appearance.title',
    'settings.inbox.appearance.wallpaper',
    'settings.inbox.appearance.backgroundColor',
    'settings.inbox.appearance.outgoingColor',
    'settings.inbox.productDefaults',
    'products.inbox.inStockOnly',
    'products.inbox.includeImage',
    'products.inbox.includeDevices',
    'products.inbox.refreshBeforeSend',
    'inbox.allAccounts',
    'inbox.oneAccount',
  ],
  ai: [
    'settings.sections.ai',
    'settings.sections.aiDesc',
    'ai.setup.title',
    'ai.setup.hint',
    'ai.setup.statusLabel',
    'ai.setup.items.apiKey',
    'ai.setup.items.enabled',
    'ai.setup.items.autoReply',
    'ai.setup.items.knowledgeIndexed',
    'ai.setup.items.knowledgeFiles',
    'ai.setup.items.branchProfile',
    'ai.setup.items.paymentAccount',
    'settings.ai.workspaceStripTitle',
    'settings.ai.statusLabel',
    'settings.ai.openAssistant',
    'settings.ai.configureAi',
    'settings.ai.openAutoReply',
    'settings.ai.knowledgeStripTitle',
    'ai.knowledge.title',
    'ai.learning.navTitle',
    'ai.branchProfile.navTitle',
    'ai.settings.title',
    'ai.toolsCatalog.title',
    'ai.memory.title',
    'automations.tabs.autoReply',
  ],
  crm: [
    'settings.sections.crm',
    'settings.sections.crmDesc',
    'settings.crm.workspaceStripTitle',
    'settings.crm.openFollowups',
    'settings.crm.openAutomations',
    'settings.crm.configStripTitle',
    'quickReplies.settingsTitle',
    'followups.templates.title',
    'followups.rules.title',
    'followups.autopilot.settingsTitle',
    'leadSources.settings.title',
    'whatsappSafety.title',
  ],
  integrations: [
    'settings.sections.integrations',
    'settings.integrations.workspaceStripTitle',
    'settings.integrations.inauzwaOn',
    'settings.integrations.openCatalog',
    'settings.integrations.configureProducts',
    'nav.webhooks',
    'nav.plugins',
    'settings.infrastructure.title',
    'products.title',
  ],
  system: [
    'settings.sections.system',
    'settings.api.serverTitle',
    'settings.api.autoReconnect',
    'settings.api.debugMode',
    'settings.api.rateLimit',
    'settings.api.devToolsStripTitle',
    'settings.api.openLogs',
    'settings.api.openDocs',
    'settings.api.adminStripTitle',
    'users.title',
    'nav.serviceApiKeys',
    'nav.plugins',
    'settings.desktopApp.nav',
    'nav.logs',
  ],
  notifications: [
    'settings.sections.notifications',
    'settings.notifications.browserSectionTitle',
    'settings.notifications.browserAlerts',
    'settings.notifications.browserAlertsDenied',
    'settings.notifications.browserAlertsHint',
    'settings.notifications.serverSectionTitle',
    'settings.notifications.webhookAlerts',
    'settings.notifications.emailEnabled',
    'settings.notifications.emailHint',
    'settings.notifications.email',
  ],
  data: [
    'settings.sections.data',
    'settings.data.workspaceStripTitle',
    'settings.storageBackup.open',
    'settings.storageBackup.nav',
    'settings.data.openInfrastructure',
    'settings.data.title',
    'settings.data.clearPrefs',
  ],
  about: [
    'settings.sections.about',
    'settings.about.apiUrl',
    'settings.about.production',
    'settings.about.documentation',
    'settings.about.docsDesc',
    'settings.about.supportTitle',
    'settings.about.supportDesc',
    'settings.about.engineHealthy',
    'settings.api.openDocs',
    'common.appName',
    'nav.inbox',
    'settings.desktopApp.title',
  ],
};

/** Per-card haystacks for hub sections (sidebar search also indexes these). */
export const SETTINGS_HUB_CARD_KEYS: Partial<
  Record<SettingsSection, readonly (readonly string[])[]>
> = {
  account: [
    [
      'settings.account.role',
      'settings.account.name',
      'settings.account.email',
      'settings.account.connection',
      'settings.account.online',
      'settings.account.offline',
      'settings.account.switchUser',
      'common.logout',
    ],
  ],
  appearance: [
    ['settings.appearance.themeTitle', 'settings.appearance.manageThemes', 'nav.themes'],
    ['settings.appearance.languageTitle'],
  ],
  inbox: [
    [
      'settings.inbox.layoutTitle',
      'settings.inbox.defaultView',
      'settings.inbox.defaultSession',
      'settings.inbox.defaultFilter',
      'settings.inbox.myStaffProfile',
      'settings.inbox.hideGroupsDefault',
      'settings.inbox.showCustomerPanel',
      'settings.inbox.showChatList',
      'inbox.allAccounts',
      'inbox.oneAccount',
    ],
    [
      'settings.inbox.productDefaults',
      'products.inbox.inStockOnly',
      'products.inbox.includeImage',
      'products.inbox.includeDevices',
      'products.inbox.refreshBeforeSend',
    ],
    [
      'settings.inbox.appearance.title',
      'settings.inbox.appearance.wallpaper',
      'settings.inbox.appearance.backgroundColor',
      'settings.inbox.appearance.outgoingColor',
      'settings.inbox.appearance.reset',
    ],
  ],
  ai: [
    [
      'ai.setup.title',
      'ai.setup.hint',
      'ai.setup.statusLabel',
      'ai.setup.items.apiKey',
      'ai.setup.items.enabled',
      'ai.setup.items.autoReply',
      'ai.setup.items.knowledgeIndexed',
      'ai.setup.items.knowledgeFiles',
      'ai.setup.items.branchProfile',
      'ai.setup.items.paymentAccount',
    ],
    [
      'settings.ai.workspaceStripTitle',
      'settings.ai.statusLabel',
      'settings.ai.openAssistant',
      'settings.ai.configureAi',
      'settings.ai.openAutoReply',
    ],
    [
      'settings.ai.knowledgeStripTitle',
      'ai.knowledge.title',
      'ai.learning.navTitle',
      'ai.branchProfile.navTitle',
    ],
  ],
  crm: [
    [
      'settings.crm.workspaceStripTitle',
      'settings.crm.openFollowups',
      'settings.crm.openAutomations',
      'nav.followups',
      'nav.automations',
    ],
    [
      'settings.crm.configStripTitle',
      'quickReplies.settingsTitle',
      'followups.templates.title',
      'leadSources.settings.title',
      'whatsappSafety.title',
    ],
  ],
  integrations: [
    [
      'settings.integrations.workspaceStripTitle',
      'settings.integrations.inauzwaOn',
      'settings.integrations.openCatalog',
      'settings.integrations.configureProducts',
      'products.title',
    ],
    ['nav.webhooks', 'webhooks.title'],
  ],
  system: [
    [
      'settings.api.serverTitle',
      'settings.api.autoReconnect',
      'settings.api.debugMode',
      'settings.api.rateLimit',
      'settings.readOnlyHint',
    ],
    [
      'settings.api.devToolsStripTitle',
      'settings.api.openLogs',
      'settings.api.openDocs',
      'nav.logs',
    ],
    [
      'settings.api.adminStripTitle',
      'users.title',
      'nav.serviceApiKeys',
      'nav.plugins',
      'settings.desktopApp.nav',
    ],
  ],
  notifications: [
    [
      'settings.notifications.browserSectionTitle',
      'settings.notifications.browserAlerts',
      'settings.notifications.browserAlertsDenied',
      'settings.notifications.browserAlertsHint',
    ],
    [
      'settings.notifications.serverSectionTitle',
      'settings.notifications.webhookAlerts',
      'settings.notifications.emailEnabled',
      'settings.notifications.emailHint',
      'settings.notifications.email',
    ],
  ],
  data: [
    [
      'settings.data.workspaceStripTitle',
      'settings.storageBackup.open',
      'settings.storageBackup.nav',
      'settings.data.openInfrastructure',
      'settings.infrastructure.title',
    ],
    ['settings.data.title', 'settings.data.clearPrefs'],
  ],
  about: [
    ['common.appName', 'settings.about.apiUrl', 'settings.about.production', 'nav.inbox'],
    ['settings.api.openDocs', 'settings.about.documentation', 'settings.about.docsDesc'],
    ['settings.about.supportTitle', 'settings.about.supportDesc'],
  ],
};

const PANEL_EXTRA_SEARCH_KEYS: Partial<Record<SettingsPanelId, string[]>> = {
  ai: ['ai.settings.title', 'ai.settings.provider', 'ai.settings.model', 'ai.settings.apiKey'],
  'ai-knowledge': ['ai.knowledge.title', 'ai.knowledge.upload', 'ai.knowledge.faq'],
  'ai-memory': ['ai.memory.title'],
  'ai-learning': ['ai.learning.title', 'ai.learning.navTitle', 'ai.learning.productDemand'],
  'ai-learning-cache': ['ai.learningCache.title', 'ai.learningCache.navTitle'],
  'ai-branch-profile': ['ai.branchProfile.title', 'ai.branchProfile.navTitle'],
  'ai-tools': ['ai.toolsCatalog.title'],
  'quick-replies': ['quickReplies.settingsTitle', 'quickReplies.title'],
  'lead-sources': ['leadSources.settings.title'],
  'followup-templates': ['followups.templates.title'],
  products: ['products.title', 'settings.integrations.configureProducts'],
  'whatsapp-safety': ['whatsappSafety.title'],
  webhooks: ['nav.webhooks', 'webhooks.title'],
  plugins: ['nav.plugins', 'plugins.title', 'plugins.search'],
  infrastructure: ['settings.infrastructure.title'],
  users: ['users.title', 'nav.users'],
  'api-keys': ['nav.serviceApiKeys', 'apiKeys.title'],
  logs: ['nav.logs', 'logs.title'],
  'storage-backup': ['settings.storageBackup.pageTitle', 'settings.storageBackup.nav'],
  'desktop-app': ['settings.desktopApp.title', 'settings.desktopApp.nav'],
};

const ROUTE_EXTRA_SEARCH_KEYS: Record<string, string[]> = {
  'whatsapp-channel': ['channels.whatsapp', 'nav.channels', 'channels.title'],
  'sms-channel': ['channels.smsSetupTitle', 'channels.sms', 'MobiShastra', 'nav.channels'],
  'followup-rules': ['followups.rules.title', 'nav.automations'],
  'followup-autopilot': ['followups.autopilot.settingsTitle', 'nav.automations'],
};

function sectionTitleKey(section: SettingsSection): string {
  return `settings.sections.${section}`;
}

export function buildFlatNavItemHaystack(
  item: FlatNavItem,
  categoryLabelKey: string,
  t: TFunction,
): string {
  const keys = new Set<string>([categoryLabelKey, item.titleKey]);
  if (item.subgroupLabelKey) keys.add(item.subgroupLabelKey);

  if (item.target.kind === 'section') {
    keys.add(sectionTitleKey(item.target.id));
    const desc = SECTION_DESC_KEYS[item.target.id];
    if (desc) keys.add(desc);
    for (const key of SETTINGS_HUB_SEARCH_KEYS[item.target.id] ?? []) keys.add(key);
    for (const cardKeys of SETTINGS_HUB_CARD_KEYS[item.target.id] ?? []) {
      for (const key of cardKeys) keys.add(key);
    }
  }

  if (item.target.kind === 'panel') {
    const panel = PANEL_REGISTRY[item.target.id];
    keys.add(panel.titleKey);
    if (panel.navTitleKey) keys.add(panel.navTitleKey);
    keys.add(sectionTitleKey(panel.section));
    const desc = SECTION_DESC_KEYS[panel.section];
    if (desc) keys.add(desc);
    if (panel.subgroupLabelKey) keys.add(panel.subgroupLabelKey);
    for (const key of SETTINGS_HUB_SEARCH_KEYS[panel.section] ?? []) keys.add(key);
    for (const cardKeys of SETTINGS_HUB_CARD_KEYS[panel.section] ?? []) {
      for (const key of cardKeys) keys.add(key);
    }
    for (const key of PANEL_EXTRA_SEARCH_KEYS[item.target.id] ?? []) keys.add(key);
  }

  if (item.target.kind === 'route') {
    const route = ROUTE_SIDEBAR_NAV.find(entry => entry.id === item.id);
    if (route?.subgroupLabelKey) keys.add(route.subgroupLabelKey);
    for (const key of ROUTE_EXTRA_SEARCH_KEYS[item.id] ?? []) keys.add(key);
  }

  return translateSettingsSearchKeys(t, [...keys]);
}

export function filterSettingsNavCategories(
  query: string,
  access: FlatNavAccess,
  isAdmin: boolean,
  t: TFunction,
): Array<{ category: FlatNavCategory; visibleItems: FlatNavItem[] }> {
  return getSettingsFlatNav().filter(category => !category.adminOnly || isAdmin)
    .map(category => {
      const items = category.items.filter(item => flatNavItemVisible(item, access));
      const visibleItems = items.filter(item =>
        matchesSettingsSearch(buildFlatNavItemHaystack(item, category.labelKey, t), query),
      );
      return visibleItems.length > 0 ? { category, visibleItems } : null;
    })
    .filter((entry): entry is { category: FlatNavCategory; visibleItems: FlatNavItem[] } => entry !== null);
}

export function matchesSettingsSearchKeys(
  query: string,
  keys: readonly string[],
  t: TFunction,
): boolean {
  return matchesSettingsSearch(translateSettingsSearchKeys(t, keys), query);
}
