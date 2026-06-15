import type { ThemeEffects } from '../lib/theme-types';

/** Inbox UI shell variant derived from active theme effects. */
export type InboxVariant = 'classic' | 'interakt' | 'tactical' | 'stitch';

export function inboxVariantFromEffects(effects?: ThemeEffects): InboxVariant {
  if (effects === 'tactical') return 'tactical';
  if (effects === 'stitch') return 'stitch';
  if (effects === 'interakt') return 'interakt';
  return 'classic';
}
