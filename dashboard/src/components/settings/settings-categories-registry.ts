import type { TFunction } from 'i18next';
import type { SettingsPanelId, SettingsSection } from './settings-nav-registry';
import {
  PANEL_REGISTRY,
  type SettingsPanelAccess,
} from './settings-nav-registry';
import { matchesSettingsSearch, translateSettingsSearchKeys } from './settings-search';
import type {
  SettingsCategory,
  SettingsCategoryId,
  SettingsItem,
  SettingsNavAccess,
  SettingsSearchIndexEntry,
} from './settings-types';

export const LEGACY_SECTION_TO_CATEGORY: Record<SettingsSection, SettingsCategoryId> = {
  account: 'profile',
  appearance: 'profile',
  about: 'help',
  inbox: 'chats',
  ai: 'ai',
  crm: 'business',
  integrations: 'business',
  notifications: 'safety',
  data: 'system',
  system: 'system',
};

/** Panel id → category (canonical navigation grouping). */
export const PANEL_CATEGORY_MAP: Record<SettingsPanelId, SettingsCategoryId> = {
  ai: 'ai',
  'ai-tools': 'ai',
  'ai-usage': 'ai',
  'ai-knowledge': 'ai',
  'ai-memory': 'ai',
  'ai-learning': 'ai',
  'ai-learning-cache': 'ai',
  'ai-branch-profile': 'ai',
  'ai-auto-reply': 'ai',
  'ai-human-behavior': 'ai',
  'quick-replies': 'chats',
  products: 'business',
  'lead-sources': 'business',
  'followup-rules': 'business',
  'followup-templates': 'business',
  'followup-autopilot': 'business',
  'whatsapp-safety': 'safety',
  webhooks: 'system',
  plugins: 'system',
  infrastructure: 'system',
  users: 'system',
  'api-keys': 'system',
  logs: 'system',
  'storage-backup': 'system',
  'desktop-app': 'system',
  'agent-actions-log': 'system',
};

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'profile',
    titleKey: 'settings.categories.profile.title',
    descriptionKey: 'settings.categories.profile.description',
    icon: 'person',
    items: [
      {
        id: 'edit-profile',
        titleKey: 'settings.items.editProfile.title',
        descriptionKey: 'settings.items.editProfile.description',
        icon: 'person',
        keywords: ['account', 'name', 'email', 'role', 'profile'],
        kind: { kind: 'inline', inlineId: 'edit-profile' },
      },
      {
        id: 'business-profile',
        titleKey: 'settings.items.businessProfile.title',
        descriptionKey: 'settings.items.businessProfile.description',
        icon: 'store',
        keywords: ['business', 'company', 'general'],
        permission: 'admin',
        kind: { kind: 'inline', inlineId: 'business-profile' },
      },
      {
        id: 'branches',
        titleKey: 'settings.items.branches.title',
        descriptionKey: 'settings.items.branches.description',
        icon: 'account_tree',
        keywords: ['branch', 'branches', 'location'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai-branch-profile' },
      },
      {
        id: 'account-preferences',
        titleKey: 'settings.items.accountPreferences.title',
        descriptionKey: 'settings.items.accountPreferences.description',
        icon: 'tune',
        keywords: ['password', 'security', 'theme', 'language', 'appearance'],
        kind: { kind: 'inline', inlineId: 'account-preferences' },
      },
      {
        id: 'password-security',
        titleKey: 'settings.items.passwordSecurity.title',
        descriptionKey: 'settings.items.passwordSecurity.description',
        icon: 'lock',
        keywords: ['password', 'security', 'login'],
        kind: { kind: 'inline', inlineId: 'password-security' },
      },
      {
        id: 'appearance',
        titleKey: 'settings.sections.appearance',
        descriptionKey: 'settings.items.appearance.description',
        icon: 'palette',
        keywords: ['theme', 'language', 'dark', 'light', 'appearance'],
        kind: { kind: 'inline', inlineId: 'appearance' },
      },
      {
        id: 'sessions',
        titleKey: 'settings.items.sessions.title',
        descriptionKey: 'settings.items.sessions.description',
        icon: 'devices',
        keywords: ['sessions', 'login', 'devices'],
        kind: { kind: 'inline', inlineId: 'sessions' },
      },
      {
        id: 'about',
        titleKey: 'settings.sections.about',
        descriptionKey: 'settings.items.about.description',
        icon: 'info',
        keywords: ['about', 'version', 'docs'],
        kind: { kind: 'inline', inlineId: 'about' },
      },
      {
        id: 'logout',
        titleKey: 'common.logout',
        icon: 'logout',
        keywords: ['logout', 'sign out'],
        isDanger: true,
        kind: { kind: 'inline', inlineId: 'logout' },
      },
    ],
  },
  {
    id: 'chats',
    titleKey: 'settings.categories.chats.title',
    descriptionKey: 'settings.categories.chats.description',
    icon: 'chat_bubble',
    items: [
      {
        id: 'inbox-preferences',
        titleKey: 'settings.items.inboxPreferences.title',
        descriptionKey: 'settings.items.inboxPreferences.description',
        icon: 'inbox',
        keywords: ['inbox', 'layout', 'filters', 'default view', 'wallpaper'],
        kind: { kind: 'inline', inlineId: 'inbox-preferences' },
      },
      {
        id: 'whatsapp-accounts',
        titleKey: 'settings.items.whatsappAccounts.title',
        descriptionKey: 'settings.items.whatsappAccounts.description',
        icon: 'chat',
        keywords: ['whatsapp', 'qr', 'session', 'accounts', 'channel'],
        kind: { kind: 'inline', inlineId: 'whatsapp-accounts' },
      },
      {
        id: 'sms-channel',
        titleKey: 'channels.smsSetupTitle',
        descriptionKey: 'settings.items.smsChannel.description',
        icon: 'sms',
        keywords: ['sms', 'mobishastra', 'text'],
        kind: { kind: 'inline', inlineId: 'sms-channel' },
      },
      {
        id: 'quick-replies',
        titleKey: 'quickReplies.settingsTitle',
        descriptionKey: 'settings.items.quickReplies.description',
        icon: 'quick_phrases',
        keywords: ['quick replies', 'canned', 'templates'],
        permission: 'quickReplyManage',
        kind: { kind: 'panel', panelId: 'quick-replies' },
      },
      {
        id: 'chat-export',
        titleKey: 'settings.items.chatExport.title',
        descriptionKey: 'settings.items.chatExport.description',
        icon: 'upload_file',
        keywords: ['export', 'import', 'chat', 'csv', 'whatsapp export'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai-learning' },
      },
      {
        id: 'default-filters',
        titleKey: 'settings.items.defaultFilters.title',
        descriptionKey: 'settings.items.defaultFilters.description',
        icon: 'filter_list',
        keywords: ['filters', 'default filter', 'inbox filter'],
        kind: { kind: 'inline', inlineId: 'inbox-preferences' },
      },
    ],
  },
  {
    id: 'ai',
    titleKey: 'settings.categories.ai.title',
    descriptionKey: 'settings.categories.ai.description',
    icon: 'smart_toy',
    items: [
      {
        id: 'ai-overview',
        titleKey: 'settings.items.aiOverview.title',
        descriptionKey: 'settings.items.aiOverview.description',
        icon: 'dashboard',
        keywords: ['ai', 'overview', 'setup', 'checklist'],
        hiddenFromHub: true,
        kind: { kind: 'inline', inlineId: 'ai-overview' },
      },
      {
        id: 'ai-auto-reply',
        titleKey: 'settings.items.aiReplies.title',
        descriptionKey: 'settings.items.aiReplies.description',
        icon: 'forum',
        keywords: [
          'auto reply',
          'automation',
          'auto-reply',
          'typing',
          'human',
          'behavior',
          'timing',
          'burst',
          'presence',
          'fast',
          'delay',
          'cooldown',
          'profiling',
          'progressive',
          'customer profile',
        ],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai-auto-reply' },
      },
      {
        id: 'human-behavior',
        titleKey: 'ai.settings.humanBehaviorTitle',
        descriptionKey: 'ai.settings.humanBehaviorDesc',
        icon: 'schedule',
        keywords: ['typing', 'human', 'behavior', 'timing'],
        permission: 'admin',
        hiddenFromHub: true,
        kind: { kind: 'panel', panelId: 'ai-human-behavior' },
      },
      {
        id: 'ai-knowledge',
        titleKey: 'ai.knowledge.title',
        descriptionKey: 'settings.items.knowledge.description',
        icon: 'menu_book',
        keywords: ['knowledge', 'rag', 'index', 'documents'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai-knowledge' },
      },
      {
        id: 'ai-learning',
        titleKey: 'ai.learning.title',
        descriptionKey: 'settings.items.learning.description',
        icon: 'trending_up',
        keywords: ['learning', 'demand', 'product demand'],
        permission: 'admin',
        hiddenFromHub: true,
        kind: { kind: 'panel', panelId: 'ai-learning' },
      },
      {
        id: 'ai-memory',
        titleKey: 'ai.memory.title',
        descriptionKey: 'settings.items.memory.description',
        icon: 'memory',
        keywords: ['memory', 'vector', 'chunks'],
        permission: 'admin',
        hiddenFromHub: true,
        kind: { kind: 'panel', panelId: 'ai-memory' },
      },
      {
        id: 'branch-payment-tools',
        titleKey: 'settings.items.branchPayment.title',
        descriptionKey: 'settings.items.branchPayment.description',
        icon: 'payments',
        keywords: ['branch', 'payment', 'installment', 'mpesa'],
        permission: 'admin',
        hiddenFromHub: true,
        kind: { kind: 'panel', panelId: 'ai-branch-profile' },
      },
      {
        id: 'ai-tools',
        titleKey: 'ai.toolsCatalog.title',
        descriptionKey: 'settings.items.aiTools.description',
        icon: 'smart_toy',
        keywords: ['tools', 'provider', 'model', 'api', 'ai config', 'ai-config'],
        isAdvanced: true,
        hiddenFromHub: true,
        kind: { kind: 'panel', panelId: 'ai-tools' },
      },
      {
        id: 'ai-provider',
        titleKey: 'settings.ai.configureAi',
        descriptionKey: 'settings.items.aiProvider.description',
        icon: 'tune',
        keywords: ['provider', 'openai', 'gemini', 'api key', 'instructions'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai' },
      },
      {
        id: 'ai-usage',
        titleKey: 'ai.usage.title',
        descriptionKey: 'ai.usage.integrationHint',
        icon: 'payments',
        keywords: ['usage', 'cost', 'budget', 'spend', 'tokens'],
        permission: 'aiCostView',
        kind: { kind: 'panel', panelId: 'ai-usage' },
      },
    ],
  },
  {
    id: 'business',
    titleKey: 'settings.categories.business.title',
    descriptionKey: 'settings.categories.business.description',
    icon: 'business_center',
    permission: 'admin',
    items: [
      {
        id: 'products',
        titleKey: 'settings.integrations.productsTitle',
        descriptionKey: 'settings.items.products.description',
        icon: 'inventory_2',
        keywords: ['products', 'catalog', 'inauzwa'],
        kind: { kind: 'panel', panelId: 'products' },
      },
      {
        id: 'product-send-rules',
        titleKey: 'settings.items.productSendRules.title',
        descriptionKey: 'settings.items.productSendRules.description',
        icon: 'send',
        keywords: ['product send', 'catalog send', 'in stock'],
        kind: { kind: 'inline', inlineId: 'product-send-rules' },
      },
      {
        id: 'lead-sources',
        titleKey: 'leadSources.settings.title',
        descriptionKey: 'settings.items.leadSources.description',
        icon: 'track_changes',
        keywords: ['lead', 'source', 'attribution'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'lead-sources' },
      },
      {
        id: 'followup-rules',
        titleKey: 'followups.rules.title',
        descriptionKey: 'settings.items.followupRules.description',
        icon: 'rule',
        keywords: ['follow-up', 'followup', 'rules'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'followup-rules' },
      },
      {
        id: 'followup-templates',
        titleKey: 'followups.templates.title',
        descriptionKey: 'settings.items.followupTemplates.description',
        icon: 'chat_bubble',
        keywords: ['follow-up', 'templates', 'message templates'],
        permission: 'followupTemplateManage',
        kind: { kind: 'panel', panelId: 'followup-templates' },
      },
      {
        id: 'followup-autopilot',
        titleKey: 'followups.autopilot.settingsTitle',
        descriptionKey: 'settings.items.followupAutopilot.description',
        icon: 'auto_mode',
        keywords: ['autopilot', 'follow-up automation'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'followup-autopilot' },
      },
      {
        id: 'payment-accounts',
        titleKey: 'settings.items.paymentAccounts.title',
        descriptionKey: 'settings.items.paymentAccounts.description',
        icon: 'account_balance',
        keywords: ['payment', 'mpesa', 'bank'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai-branch-profile' },
      },
      {
        id: 'installment-rules',
        titleKey: 'settings.items.installmentRules.title',
        descriptionKey: 'settings.items.installmentRules.description',
        icon: 'credit_score',
        keywords: ['installment', 'payment plan'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'ai-branch-profile' },
      },
    ],
  },
  {
    id: 'safety',
    titleKey: 'settings.categories.safety.title',
    descriptionKey: 'settings.categories.safety.description',
    icon: 'notifications_active',
    items: [
      {
        id: 'notifications',
        titleKey: 'settings.sections.notifications',
        descriptionKey: 'settings.items.notifications.description',
        icon: 'notifications',
        keywords: ['notifications', 'alerts', 'browser'],
        kind: { kind: 'inline', inlineId: 'notifications' },
      },
      {
        id: 'whatsapp-safety',
        titleKey: 'whatsappSafety.title',
        descriptionKey: 'settings.items.whatsappSafety.description',
        icon: 'security_update_good',
        keywords: ['whatsapp', 'safety', 'warmup', 'rate limit', 'approval', 'blocked', 'campaign', 'audit'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'whatsapp-safety' },
      },
      {
        id: 'opt-out-keywords',
        titleKey: 'settings.items.optOutKeywords.title',
        descriptionKey: 'settings.items.optOutKeywords.description',
        icon: 'block',
        keywords: ['opt-out', 'opt out', 'stop', 'unsubscribe', 'consent'],
        permission: 'admin',
        kind: { kind: 'safetyTab', tab: 'consent' },
      },
      {
        id: 'send-queue',
        titleKey: 'settings.items.sendQueue.title',
        descriptionKey: 'settings.items.sendQueue.description',
        icon: 'queue',
        keywords: ['queue', 'send queue', 'spacing', 'warmup', 'warm-up'],
        permission: 'admin',
        kind: { kind: 'safetyTab', tab: 'queue' },
      },
    ],
  },
  {
    id: 'system',
    titleKey: 'settings.categories.system.title',
    descriptionKey: 'settings.categories.system.description',
    icon: 'settings_suggest',
    permission: 'admin',
    items: [
      {
        id: 'users',
        titleKey: 'nav.users',
        descriptionKey: 'settings.items.users.description',
        icon: 'badge',
        keywords: ['users', 'roles', 'team'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'users' },
      },
      {
        id: 'api-keys',
        titleKey: 'nav.serviceApiKeys',
        descriptionKey: 'settings.items.apiKeys.description',
        icon: 'key',
        keywords: ['api keys', 'token', 'service'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'api-keys' },
      },
      {
        id: 'webhooks',
        titleKey: 'nav.webhooks',
        descriptionKey: 'settings.items.webhooks.description',
        icon: 'webhook',
        keywords: ['webhook', 'hooks'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'webhooks' },
      },
      {
        id: 'plugins',
        titleKey: 'nav.plugins',
        descriptionKey: 'settings.items.plugins.description',
        icon: 'extension',
        keywords: ['plugins', 'extensions'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'plugins' },
      },
      {
        id: 'infrastructure',
        titleKey: 'nav.infrastructure',
        descriptionKey: 'settings.items.infrastructure.description',
        icon: 'dns',
        keywords: ['infrastructure', 'server', 'neon', 'database'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'infrastructure' },
      },
      {
        id: 'logs',
        titleKey: 'nav.logs',
        descriptionKey: 'settings.items.logs.description',
        icon: 'history',
        keywords: ['logs', 'debug', 'history'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'logs' },
      },
      {
        id: 'storage-backup',
        titleKey: 'settings.storageBackup.nav',
        descriptionKey: 'settings.items.storageBackup.description',
        icon: 'cloud_sync',
        keywords: ['backup', 'storage', 'restore'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'storage-backup' },
      },
      {
        id: 'database',
        titleKey: 'settings.items.database.title',
        descriptionKey: 'settings.items.database.description',
        icon: 'database',
        keywords: ['database', 'neon', 'postgres', 'sqlite'],
        permission: 'admin',
        kind: { kind: 'inline', inlineId: 'database' },
      },
      {
        id: 'desktop-app',
        titleKey: 'settings.desktopApp.nav',
        descriptionKey: 'settings.items.desktopApp.description',
        icon: 'computer',
        keywords: ['desktop', 'electron', 'app'],
        permission: 'admin',
        kind: { kind: 'panel', panelId: 'desktop-app' },
      },
      {
        id: 'status-bar',
        titleKey: 'shell.statusBar.settings.title',
        descriptionKey: 'shell.statusBar.settings.description',
        icon: 'monitoring',
        keywords: ['status', 'health', 'bar', 'monitoring'],
        permission: 'admin',
        kind: { kind: 'inline', inlineId: 'status-bar' },
      },
      {
        id: 'agent-actions-log',
        titleKey: 'settings.agentActions.nav',
        descriptionKey: 'settings.agentActions.description',
        icon: 'smart_toy',
        keywords: ['agent', 'actions', 'automation', 'ai operator'],
        permission: 'admin',
        isAdvanced: true,
        kind: { kind: 'panel', panelId: 'agent-actions-log' },
      },
      {
        id: 'developer-tools',
        titleKey: 'settings.items.developerTools.title',
        descriptionKey: 'settings.items.developerTools.description',
        icon: 'terminal',
        keywords: ['developer', 'api docs', 'message tester'],
        permission: 'admin',
        isAdvanced: true,
        kind: { kind: 'inline', inlineId: 'developer-tools' },
      },
    ],
  },
  {
    id: 'help',
    titleKey: 'settings.categories.help.title',
    descriptionKey: 'settings.categories.help.description',
    icon: 'help',
    items: [
      {
        id: 'help-center',
        titleKey: 'settings.items.helpCenter.title',
        descriptionKey: 'settings.items.helpCenter.description',
        icon: 'menu_book',
        keywords: ['help', 'docs', 'documentation'],
        kind: { kind: 'inline', inlineId: 'help-center' },
      },
      {
        id: 'contact-support',
        titleKey: 'settings.items.contactSupport.title',
        descriptionKey: 'settings.items.contactSupport.description',
        icon: 'support_agent',
        keywords: ['support', 'contact', 'help'],
        kind: { kind: 'inline', inlineId: 'contact-support' },
      },
      {
        id: 'app-version',
        titleKey: 'settings.items.appVersion.title',
        descriptionKey: 'settings.items.appVersion.description',
        icon: 'info',
        keywords: ['version', 'release'],
        kind: { kind: 'inline', inlineId: 'app-version' },
      },
      {
        id: 'diagnostics',
        titleKey: 'settings.items.diagnostics.title',
        descriptionKey: 'settings.items.diagnostics.description',
        icon: 'stethoscope',
        keywords: ['diagnostics', 'health', 'debug'],
        permission: 'admin',
        kind: { kind: 'inline', inlineId: 'diagnostics' },
      },
      {
        id: 'export-debug',
        titleKey: 'settings.items.exportDebug.title',
        descriptionKey: 'settings.items.exportDebug.description',
        icon: 'bug_report',
        keywords: ['debug report', 'export', 'logs'],
        permission: 'admin',
        kind: { kind: 'inline', inlineId: 'export-debug' },
      },
    ],
  },
];

export function findCategory(id: SettingsCategoryId): SettingsCategory {
  return SETTINGS_CATEGORIES.find(c => c.id === id) ?? SETTINGS_CATEGORIES[0];
}

export function findCategoryItem(
  categoryId: SettingsCategoryId,
  itemId: string,
): SettingsItem | undefined {
  return findCategory(categoryId).items.find(i => i.id === itemId);
}

export function resolveCategoryForPanel(panelId: SettingsPanelId): SettingsCategoryId {
  const mapped = PANEL_CATEGORY_MAP[panelId];
  if (mapped) return mapped;
  const section = PANEL_REGISTRY[panelId]?.section;
  if (section) return LEGACY_SECTION_TO_CATEGORY[section] ?? 'profile';
  return 'profile';
}

export function itemAllowsAccess(item: SettingsItem, access: SettingsNavAccess): boolean {
  if (!item.permission) return true;
  if (item.permission === 'admin') return access.isAdmin;
  if (item.permission === 'quickReplyManage') return access.canManageQuickReplies;
  if (item.permission === 'followupTemplateManage') return access.canManageMessageTemplates;
  if (item.permission === 'aiCostView') return access.canViewAiCost;
  if (item.permission === 'aiCostManage') return access.canManageAiCost;
  return true;
}

export function categoryAllowsAccess(
  category: SettingsCategory,
  access: SettingsNavAccess,
): boolean {
  if (category.permission === 'admin' && !access.isAdmin) return false;
  if (category.id === 'business') {
    return (
      access.isAdmin ||
      access.canManageMessageTemplates ||
      category.items.some(i => itemAllowsAccess(i, access))
    );
  }
  return category.items.some(i => itemAllowsAccess(i, access));
}

export function visibleCategoryItems(
  category: SettingsCategory,
  access: SettingsNavAccess,
): SettingsItem[] {
  return category.items.filter(i => itemAllowsAccess(i, access));
}

export function panelAccessFromNav(access: SettingsNavAccess): SettingsPanelAccess {
  return {
    isAdmin: access.isAdmin,
    canManageQuickReplies: access.canManageQuickReplies,
    canManageMessageTemplates: access.canManageMessageTemplates,
    canViewAiCost: access.canViewAiCost,
    canManageAiCost: access.canManageAiCost,
  };
}

export function itemResolvesToPanel(item: SettingsItem): SettingsPanelId | null {
  if (item.kind.kind === 'panel') return item.kind.panelId;
  if (item.kind.kind === 'safetyTab') return 'whatsapp-safety';
  return null;
}

export function buildSettingsSearchIndex(): SettingsSearchIndexEntry[] {
  const entries: SettingsSearchIndexEntry[] = [];
  for (const category of SETTINGS_CATEGORIES) {
    for (const item of category.items) {
      if (item.hiddenFromHub) continue;
      const panelId = itemResolvesToPanel(item);
      entries.push({
        id: `${category.id}-${item.id}`,
        titleKey: item.titleKey,
        categoryId: category.id,
        categoryTitleKey: category.titleKey,
        itemId: item.id,
        keywords: item.keywords ?? [],
        panelId: panelId ?? undefined,
        route: item.kind.kind === 'route' ? item.kind.path : undefined,
        inlineId: item.kind.kind === 'inline' ? item.kind.inlineId : undefined,
      });
    }
    entries.push({
      id: `category-${category.id}`,
      titleKey: category.titleKey,
      categoryId: category.id,
      categoryTitleKey: category.titleKey,
      itemId: '',
      keywords: [],
    });
  }
  return entries;
}

export function searchSettingsIndex(
  query: string,
  access: SettingsNavAccess,
  t: TFunction,
): Array<{ category: SettingsCategory; item: SettingsItem }> {
  const q = query.trim();
  if (!q) return [];

  const results: Array<{ category: SettingsCategory; item: SettingsItem }> = [];
  const seen = new Set<string>();

  for (const category of SETTINGS_CATEGORIES) {
    if (!categoryAllowsAccess(category, access)) continue;
    for (const item of category.items) {
      if (!itemAllowsAccess(item, access)) continue;
      const haystack = [
        t(category.titleKey),
        t(category.descriptionKey),
        t(item.titleKey),
        item.descriptionKey ? t(item.descriptionKey) : '',
        ...(item.keywords ?? []),
        item.kind.kind === 'panel' ? t(PANEL_REGISTRY[item.kind.panelId].titleKey) : '',
      ].join(' ');
      if (!matchesSettingsSearch(haystack, q)) continue;
      const key = `${category.id}:${item.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ category, item });
    }
  }
  return results;
}

export function findItemForPanel(panelId: SettingsPanelId): {
  category: SettingsCategory;
  item: SettingsItem;
} | null {
  const categoryId = resolveCategoryForPanel(panelId);
  const category = findCategory(categoryId);
  const item =
    category.items.find(
      i => i.kind.kind === 'panel' && i.kind.panelId === panelId,
    ) ??
    category.items.find(i => itemResolvesToPanel(i) === panelId);
  if (!item) return null;
  return { category, item };
}

export function defaultItemForCategory(categoryId: SettingsCategoryId): SettingsItem {
  const category = findCategory(categoryId);
  return category.items.find(i => !i.isDanger) ?? category.items[0];
}

/** Legacy panel id aliases for search / redirects. */
export const PANEL_ID_ALIASES: Record<string, SettingsPanelId> = {
  'ai-config': 'ai',
  inauzwa: 'products',
};

export function resolvePanelIdFromParam(value: string | null): SettingsPanelId | null {
  if (!value) return null;
  if (value in PANEL_ID_ALIASES) return PANEL_ID_ALIASES[value];
  if (value === 'message-tester') return null;
  const ids = Object.keys(PANEL_CATEGORY_MAP) as SettingsPanelId[];
  return ids.includes(value as SettingsPanelId) ? (value as SettingsPanelId) : null;
}

export function buildSearchHaystackForEntry(
  entry: SettingsSearchIndexEntry,
  t: TFunction,
): string {
  return translateSettingsSearchKeys(t, [
    entry.categoryTitleKey,
    entry.titleKey,
    ...entry.keywords,
  ]);
}
