import {
  PANEL_REGISTRY,
  ROUTE_SIDEBAR_NAV,
  SECTION_SIDEBAR_NAV,
  SIDEBAR_GROUPS,
  panelAllowsAccess,
  SETTINGS_PANEL_IDS,
  type SettingsPanelId,
  type SettingsSection,
  type SettingsSidebarGroup,
} from './settings-nav-registry';

export type FlatNavTarget =
  | { kind: 'section'; id: SettingsSection }
  | { kind: 'panel'; id: SettingsPanelId }
  | { kind: 'route'; path: string };

export type FlatNavTier = 'overview' | 'detail';

export type FlatNavItem = {
  id: string;
  icon: string;
  titleKey: string;
  target: FlatNavTarget;
  tier?: FlatNavTier;
  subgroupLabelKey?: string;
  adminOnly?: boolean;
  quickReplyManage?: boolean;
  followupTemplateManage?: boolean;
  filledWhenActive?: boolean;
};

export type FlatNavCategory = {
  labelKey: string;
  adminOnly?: boolean;
  items: FlatNavItem[];
};

type FlatNavSortable = FlatNavItem & { navOrder: number };

function flatNavItemId(panelId: SettingsPanelId): string {
  return panelId === 'ai' ? 'ai-config' : panelId;
}

function panelFlatNavItem(panelId: SettingsPanelId): FlatNavSortable {
  const panel = PANEL_REGISTRY[panelId];
  return {
    id: flatNavItemId(panelId),
    icon: panel.sidebarNavIcon ?? panel.navIcon,
    titleKey: panel.navTitleKey ?? panel.titleKey,
    target: { kind: 'panel', id: panelId },
    tier: 'detail',
    subgroupLabelKey: panel.subgroupLabelKey,
    filledWhenActive: panel.filledWhenActive,
    navOrder: panel.sidebarNavOrder ?? panel.sidebarOrder,
  };
}

function itemsForSidebarGroup(groupId: SettingsSidebarGroup): FlatNavSortable[] {
  const items: FlatNavSortable[] = [];

  for (const section of SECTION_SIDEBAR_NAV) {
    if (section.group !== groupId) continue;
    items.push({
      id: section.section,
      icon: section.navIcon,
      titleKey: section.navTitleKey ?? section.titleKey,
      target: { kind: 'section', id: section.section },
      tier: section.navTitleKey ? 'overview' : undefined,
      subgroupLabelKey: section.subgroupLabelKey,
      adminOnly: section.adminOnly,
      navOrder: section.navOrder,
    });
  }

  for (const route of ROUTE_SIDEBAR_NAV) {
    if (route.group !== groupId) continue;
    items.push({
      id: route.id,
      icon: route.navIcon,
      titleKey: route.titleKey,
      target: { kind: 'route', path: route.path },
      tier: 'detail',
      subgroupLabelKey: route.subgroupLabelKey,
      adminOnly: route.adminOnly,
      navOrder: route.navOrder,
    });
  }

  for (const panelId of SETTINGS_PANEL_IDS) {
    const panel = PANEL_REGISTRY[panelId];
    if (panel.sidebarGroup !== groupId) continue;
    items.push(panelFlatNavItem(panelId));
  }

  return items.sort((a, b) => a.navOrder - b.navOrder);
}

/** Build sidebar categories from the settings nav registry (single source of truth). */
export function buildSettingsFlatNav(): FlatNavCategory[] {
  return SIDEBAR_GROUPS.map(group => ({
    labelKey: group.labelKey,
    adminOnly: group.adminOnly,
    items: itemsForSidebarGroup(group.id).map(({ navOrder: _navOrder, ...item }) => item),
  }));
}

let flatNavCache: FlatNavCategory[] | undefined;

/** Lazy-built flat nav (avoids circular import TDZ with settings-nav-registry). */
export function getSettingsFlatNav(): FlatNavCategory[] {
  if (!flatNavCache) {
    flatNavCache = buildSettingsFlatNav();
  }
  return flatNavCache;
}

export function isFlatNavItemActive(
  item: FlatNavItem,
  activeSection: SettingsSection,
  activePanel: SettingsPanelId | null,
): boolean {
  if (item.target.kind === 'panel') return activePanel === item.target.id;
  if (item.target.kind === 'section') {
    return activeSection === item.target.id && !activePanel;
  }
  return false;
}

export type FlatNavAccess = {
  isAdmin: boolean;
  canManageQuickReplies: boolean;
  canManageMessageTemplates: boolean;
  canViewAiCost: boolean;
  canManageAiCost: boolean;
};

export function flatNavItemVisible(item: FlatNavItem, access: FlatNavAccess): boolean {
  if (item.target.kind === 'panel') {
    return panelAllowsAccess(item.target.id, access);
  }
  if (item.adminOnly && !access.isAdmin) return false;
  if (item.quickReplyManage && !access.canManageQuickReplies) return false;
  if (item.followupTemplateManage && !access.canManageMessageTemplates) return false;
  return true;
}
