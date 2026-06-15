import type { SettingsCategoryId } from './settings-types';
import {
  LEGACY_SECTION_TO_CATEGORY,
  findCategory,
  resolveCategoryForPanel,
} from './settings-categories-registry';
import {
  LEGACY_SECTION_ALIASES,
  SETTINGS_SECTION_IDS,
  parseSettingsPanelId,
  resolvePanelSection,
  type SettingsPanelId,
  type SettingsSection,
} from './settings-nav-registry';

export type CanonicalSettingsParams = {
  category: SettingsCategoryId | null;
  item: string | null;
  /** @deprecated Kept for backward compatibility with inline panels keyed by section. */
  section: SettingsSection;
  panel: SettingsPanelId | null;
};

function parseCategoryId(value: string | null): SettingsCategoryId | null {
  if (!value) return null;
  const ids: SettingsCategoryId[] = [
    'profile',
    'chats',
    'ai',
    'business',
    'safety',
    'system',
    'help',
  ];
  return ids.includes(value as SettingsCategoryId) ? (value as SettingsCategoryId) : null;
}

export function sectionToCategory(section: SettingsSection): SettingsCategoryId {
  return LEGACY_SECTION_TO_CATEGORY[section] ?? 'profile';
}

export function categoryToLegacySection(category: SettingsCategoryId): SettingsSection {
  const map: Record<SettingsCategoryId, SettingsSection> = {
    profile: 'account',
    chats: 'inbox',
    ai: 'ai',
    business: 'crm',
    safety: 'notifications',
    system: 'system',
    help: 'about',
  };
  return map[category];
}

/** Normalize legacy ?section=&integration=&tool= into canonical category+item+panel. */
export function resolveSettingsParams(searchParams: URLSearchParams): CanonicalSettingsParams {
  let sectionRaw = searchParams.get('section');
  if (sectionRaw && LEGACY_SECTION_ALIASES[sectionRaw]) {
    sectionRaw = LEGACY_SECTION_ALIASES[sectionRaw];
  }

  const legacyIntegration = parseSettingsPanelId(searchParams.get('integration'));
  const legacyTool = parseSettingsPanelId(searchParams.get('tool'));
  let panelParam = parseSettingsPanelId(searchParams.get('panel'));
  if (!panelParam && searchParams.get('panel') === 'ai-config') {
    panelParam = 'ai';
  }
  if (panelParam === 'ai-human-behavior') {
    panelParam = 'ai-auto-reply';
  }

  const panel = panelParam ?? legacyIntegration ?? legacyTool;
  const categoryParam = parseCategoryId(searchParams.get('category'));
  const itemParam = searchParams.get('item');

  if (panel) {
    const category = resolveCategoryForPanel(panel);
    return {
      category,
      item: itemParam,
      section: resolvePanelSection(panel),
      panel,
    };
  }

  if (categoryParam) {
    return {
      category: categoryParam,
      item: itemParam,
      section: categoryToLegacySection(categoryParam),
      panel: null,
    };
  }

  if (sectionRaw && SETTINGS_SECTION_IDS.includes(sectionRaw as SettingsSection)) {
    const section = sectionRaw as SettingsSection;
    return {
      category: sectionToCategory(section),
      item: itemParam,
      section,
      panel: null,
    };
  }

  return {
    category: null,
    item: null,
    section: 'account',
    panel: null,
  };
}

export function buildSettingsCategoryParams(
  category: SettingsCategoryId,
  item: string | null,
  panel: SettingsPanelId | null,
  extra?: Record<string, string>,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set('category', category);
  if (item) next.set('item', item);
  if (panel) next.set('panel', panel);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) next.set(k, v);
  }
  return next;
}

/** Build canonical URL search params (drops legacy keys). */
export function buildSettingsSearchParams(
  categoryOrSection: SettingsCategoryId | SettingsSection,
  panel: SettingsPanelId | null,
  extra?: Record<string, string>,
  item?: string | null,
): URLSearchParams {
  const category = (
    ['profile', 'chats', 'ai', 'business', 'safety', 'system', 'help'] as const
  ).includes(categoryOrSection as SettingsCategoryId)
    ? (categoryOrSection as SettingsCategoryId)
    : sectionToCategory(categoryOrSection as SettingsSection);

  return buildSettingsCategoryParams(category, item ?? null, panel, extra);
}

export function settingsPanelHref(
  panel: SettingsPanelId,
  extra?: Record<string, string>,
): string {
  if (panel === 'followup-rules') return '/automations?tab=rules';
  if (panel === 'followup-autopilot') return '/automations?tab=autopilot';
  const category = resolveCategoryForPanel(panel);
  const params = buildSettingsCategoryParams(category, null, panel, extra);
  return `/settings?${params.toString()}`;
}

export function settingsCategoryHref(
  category: SettingsCategoryId,
  item?: string | null,
  extra?: Record<string, string>,
): string {
  const params = buildSettingsCategoryParams(category, item ?? null, null, extra);
  return `/settings?${params.toString()}`;
}

/** @deprecated Use settingsCategoryHref */
export function settingsSectionHref(
  section: SettingsSection,
  extra?: Record<string, string>,
): string {
  const category = sectionToCategory(section);
  const params = buildSettingsCategoryParams(category, null, null, extra);
  return `/settings?${params.toString()}`;
}

export function needsSettingsUrlCanonicalization(searchParams: URLSearchParams): boolean {
  if (
    searchParams.has('integration') ||
    searchParams.has('tool') ||
    searchParams.get('section') === 'sessions' ||
    searchParams.get('section') === 'api'
  ) {
    return true;
  }
  if (searchParams.has('section') && !searchParams.has('category')) return true;
  if (searchParams.get('panel') === 'ai-config') return true;
  if (searchParams.get('panel') === 'ai-human-behavior') return true;
  const panel = parseSettingsPanelId(searchParams.get('panel'));
  if (panel) {
    const category = parseCategoryId(searchParams.get('category'));
    const expected = resolveCategoryForPanel(panel);
    if (category && category !== expected) return true;
    if (!category) return true;
  }
  return false;
}

export function canonicalizeSettingsSearchParams(
  searchParams: URLSearchParams,
): URLSearchParams {
  const resolved = resolveSettingsParams(searchParams);
  const extra: Record<string, string> = {};
  const moved = searchParams.get('moved');
  const waTab = searchParams.get('waTab');
  if (moved) extra.moved = moved;
  if (waTab) extra.waTab = waTab;

  if (!resolved.category && !resolved.panel) {
    const home = new URLSearchParams();
    if (moved) home.set('moved', moved);
    return home;
  }

  return buildSettingsCategoryParams(
    resolved.category ?? findCategory('profile').id,
    resolved.item,
    resolved.panel,
    Object.keys(extra).length ? extra : undefined,
  );
}

import { resolveWhatsAppSafetyTab, type WhatsAppSafetyUrlTabId } from './whatsapp-safety/whatsapp-safety-tab-ids';

export type { WhatsAppSafetyTabId } from './whatsapp-safety/whatsapp-safety-tab-ids';

export function whatsappSafetyTabHref(tab: WhatsAppSafetyUrlTabId): string {
  const resolved = resolveWhatsAppSafetyTab(tab);
  return settingsPanelHref(
    'whatsapp-safety',
    resolved === 'overview' ? undefined : { waTab: resolved },
  );
}
