/** Active WhatsApp Safety panel tabs (simplified 5-tab layout). */
export type WhatsAppSafetyTabId = 'overview' | 'rules' | 'queue' | 'consent' | 'activity';

/** Legacy tab IDs from URLs, bookmarks, and deep links. */
export type LegacyWhatsAppSafetyTabId =
  | 'policy'
  | 'warmup'
  | 'campaign'
  | 'templates'
  | 'followup'
  | 'ai'
  | 'health'
  | 'audit';

export type WhatsAppSafetyUrlTabId = WhatsAppSafetyTabId | LegacyWhatsAppSafetyTabId;

export const WHATSAPP_SAFETY_TABS: { id: WhatsAppSafetyTabId; labelKey: string }[] = [
  { id: 'overview', labelKey: 'whatsappSafety.tabs.overview' },
  { id: 'rules', labelKey: 'whatsappSafety.tabs.rules' },
  { id: 'queue', labelKey: 'whatsappSafety.tabs.queue' },
  { id: 'consent', labelKey: 'whatsappSafety.tabs.consent' },
  { id: 'activity', labelKey: 'whatsappSafety.tabs.activity' },
];

const LEGACY_TAB_REDIRECT: Record<LegacyWhatsAppSafetyTabId, WhatsAppSafetyTabId> = {
  policy: 'rules',
  followup: 'rules',
  ai: 'rules',
  campaign: 'rules',
  templates: 'rules',
  warmup: 'queue',
  health: 'activity',
  audit: 'activity',
};

export function resolveWhatsAppSafetyTab(
  urlTab: string | null | undefined,
): WhatsAppSafetyTabId {
  if (!urlTab) return 'overview';
  if (WHATSAPP_SAFETY_TABS.some(t => t.id === urlTab)) {
    return urlTab as WhatsAppSafetyTabId;
  }
  const legacy = urlTab as LegacyWhatsAppSafetyTabId;
  if (legacy in LEGACY_TAB_REDIRECT) {
    return LEGACY_TAB_REDIRECT[legacy];
  }
  return 'overview';
}

export function isLegacyWhatsAppSafetyTab(
  urlTab: string | null | undefined,
): urlTab is LegacyWhatsAppSafetyTabId {
  if (!urlTab) return false;
  return urlTab in LEGACY_TAB_REDIRECT;
}
