import { describe, expect, it } from 'vitest';
import {
  PANEL_CATEGORY_MAP,
  resolveCategoryForPanel,
  findItemForPanel,
  buildSettingsSearchIndex,
  searchSettingsIndex,
} from './settings-categories-registry';
import {
  resolveSettingsParams,
  settingsPanelHref,
  canonicalizeSettingsSearchParams,
} from './settings-routing';
import type { SettingsPanelId } from './settings-nav-registry';

describe('settings categories registry', () => {
  it('maps legacy panel ids to new categories', () => {
    expect(PANEL_CATEGORY_MAP['whatsapp-safety']).toBe('safety');
    expect(PANEL_CATEGORY_MAP.products).toBe('business');
    expect(PANEL_CATEGORY_MAP.webhooks).toBe('system');
    expect(PANEL_CATEGORY_MAP['storage-backup']).toBe('system');
    expect(PANEL_CATEGORY_MAP['ai-human-behavior']).toBe('ai');
  });

  it('resolves panel deep links with category param', () => {
    expect(settingsPanelHref('whatsapp-safety')).toContain('category=safety');
    expect(settingsPanelHref('whatsapp-safety')).toContain('panel=whatsapp-safety');
    expect(settingsPanelHref('products')).toContain('category=business');
    expect(settingsPanelHref('ai-knowledge')).toContain('category=ai');
  });

  it('finds items for panels', () => {
    const hit = findItemForPanel('ai-human-behavior');
    expect(hit?.category.id).toBe('ai');
    expect(hit?.item.id).toBe('human-behavior');
  });

  it('search index includes typing alias on unified AI replies item', () => {
    const index = buildSettingsSearchIndex();
    const replies = index.find(e => e.panelId === 'ai-auto-reply');
    expect(replies?.keywords).toContain('typing');
  });

  it('canonicalizes legacy human behavior panel to unified AI replies', () => {
    const params = canonicalizeSettingsSearchParams(
      new URLSearchParams('category=ai&panel=ai-human-behavior'),
    );
    expect(params.get('panel')).toBe('ai-auto-reply');
  });

  it('canonicalizes legacy section urls', () => {
    const params = canonicalizeSettingsSearchParams(
      new URLSearchParams('section=integrations&panel=whatsapp-safety'),
    );
    expect(params.get('category')).toBe('safety');
    expect(params.get('panel')).toBe('whatsapp-safety');
  });

  it('keeps category-only urls on the hub without auto-selecting an item', () => {
    const params = canonicalizeSettingsSearchParams(new URLSearchParams('category=ai'));
    expect(params.get('category')).toBe('ai');
    expect(params.get('item')).toBeNull();
    expect(params.get('panel')).toBeNull();
  });

  it('resolves ai-config alias', () => {
    const resolved = resolveSettingsParams(new URLSearchParams('panel=ai-config'));
    expect(resolved.panel).toBe('ai');
    expect(resolved.category).toBe('ai');
  });

  it('maps all panel ids to categories', () => {
    const ids = Object.keys(PANEL_CATEGORY_MAP) as SettingsPanelId[];
    for (const id of ids) {
      expect(resolveCategoryForPanel(id)).toBe(PANEL_CATEGORY_MAP[id]);
    }
  });
});

describe('settings search', () => {
  const access = { isAdmin: true, canManageQuickReplies: true, canManageMessageTemplates: true, canViewAiCost: true, canManageAiCost: true };
  const t = (key: string) => key;

  it('finds webhook in system category', () => {
    const results = searchSettingsIndex('webhook', access, t);
    expect(results.some(r => r.item.id === 'webhooks')).toBe(true);
  });

  it('finds typing in unified AI replies item', () => {
    const results = searchSettingsIndex('typing', access, t);
    expect(results.some(r => r.item.id === 'ai-auto-reply')).toBe(true);
  });
});
