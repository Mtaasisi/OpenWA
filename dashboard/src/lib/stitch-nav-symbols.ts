import type { WorkspaceNavKey } from './workspace-nav';

/** Material Symbols used in the Stitch sidebar (may differ from default workspace symbols). */
export const STITCH_NAV_SYMBOLS: Partial<Record<WorkspaceNavKey, string>> = {
  dashboard: 'grid_view',
  inbox: 'mail',
  customers: 'group',
  aiAssistant: 'smart_toy',
  products: 'inventory_2',
  pipeline: 'account_tree',
  quotes: 'request_quote',
  followups: 'history',
  templates: 'description',
  content: 'article',
  settings: 'settings',
};

/** Label keys for Stitch sidebar — matches Patient Support Dashboard mockup copy. */
export const STITCH_NAV_LABEL_KEYS: Partial<Record<WorkspaceNavKey, string>> = {
  customers: 'nav.clients',
};

export function stitchNavSymbol(key: WorkspaceNavKey, fallback: string): string {
  return STITCH_NAV_SYMBOLS[key] ?? fallback;
}

export function stitchNavLabelKey(key: WorkspaceNavKey, fallback: string): string {
  return STITCH_NAV_LABEL_KEYS[key] ?? fallback;
}
