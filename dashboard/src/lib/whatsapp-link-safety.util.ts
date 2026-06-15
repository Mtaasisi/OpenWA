import type {
  WhatsAppLinkPreflightItem,
  WhatsAppLinkPreflightResult,
  WhatsAppSafetySettings,
} from '../services/api';
import { channelsUrl } from './channel-routes';
import { settingsPanelHref } from '../components/settings/settings-nav-registry';

export function groupLinkPreflightItems(data: WhatsAppLinkPreflightResult) {
  return {
    required: data.items.filter(i => i.severity === 'required'),
    recommended: data.items.filter(i => i.severity === 'recommended'),
    manual: data.items.filter(i => i.severity === 'manual'),
  };
}

export function linkPreflightFixHref(
  item: WhatsAppLinkPreflightItem,
  sessionId: string,
): string | null {
  if (!item.fixTarget) return null;
  if (item.fixTarget === 'whatsapp-safety') {
    const tab = item.fixField === 'warmupEnabled' ? 'queue' : 'rules';
    return settingsPanelHref('whatsapp-safety', { waTab: tab });
  }
  if (item.fixTarget === 'plugins') return settingsPanelHref('plugins');
  if (item.fixTarget === 'session-proxy' || item.fixTarget === 'session-engine') {
    return channelsUrl({ channel: 'whatsapp', sessionFocus: sessionId });
  }
  return null;
}

export function linkPreflightQuickFixValue(item: WhatsAppLinkPreflightItem): boolean | null {
  if (
    item.id === 'campaignsOff' ||
    item.id === 'followupAutoOff'
  ) {
    return false;
  }
  if (
    item.id === 'outside24hTemplate' ||
    item.id === 'safetyGuard' ||
    item.id === 'warmup' ||
    item.id === 'startupSafeMode' ||
    item.id === 'aiSafety'
  ) {
    return true;
  }
  return null;
}

export function canLinkPreflightQuickFix(item: WhatsAppLinkPreflightItem): boolean {
  return (
    (Boolean(item.fixField) && item.fixTarget === 'whatsapp-safety' && !item.ok) ||
    (item.id === 'lightStartupSync' && !item.ok)
  );
}

export type LinkPreflightToggleBinding =
  | { kind: 'field'; field: keyof WhatsAppSafetySettings; inverted: boolean }
  | { kind: 'heavyStartup' };

/** Checklist passes when these are off — toggle ON = safer / meets the label. */
const INVERTED_TOGGLE_ITEMS = new Set([
  'campaignsOff',
  'followupAutoOff',
  'lightStartupSync',
]);

const TOGGLE_FIELD_BY_ITEM: Partial<Record<string, keyof WhatsAppSafetySettings>> = {
  safetyGuard: 'globalEnabled',
  warmup: 'warmupEnabled',
  startupSafeMode: 'startupSafeModeEnabled',
  aiSafety: 'aiSafetyEnabled',
  campaignsOff: 'campaignsEnabled',
  followupAutoOff: 'followupAutoSendEnabled',
  outside24hTemplate: 'outside24hRequiresTemplate',
};

export function getLinkPreflightToggleBinding(
  item: WhatsAppLinkPreflightItem,
): LinkPreflightToggleBinding | null {
  if (item.fixTarget !== 'whatsapp-safety') return null;
  if (item.id === 'lightStartupSync') return { kind: 'heavyStartup' };
  const field = item.fixField as keyof WhatsAppSafetySettings | undefined;
  if (!field) return null;
  if (TOGGLE_FIELD_BY_ITEM[item.id] === field || item.fixField) {
    return {
      kind: 'field',
      field: (TOGGLE_FIELD_BY_ITEM[item.id] ?? field) as keyof WhatsAppSafetySettings,
      inverted: INVERTED_TOGGLE_ITEMS.has(item.id),
    };
  }
  return null;
}

export function readLinkPreflightToggleValue(
  binding: LinkPreflightToggleBinding,
  settings: WhatsAppSafetySettings,
): boolean {
  if (binding.kind === 'heavyStartup') {
    const heavy = Boolean(
      settings.autoDownloadMediaOnStartup || settings.fetchGroupInfoOnStartup,
    );
    return !heavy;
  }
  const raw = Boolean(settings[binding.field]);
  return binding.inverted ? !raw : raw;
}

export function buildLinkPreflightTogglePatch(
  binding: LinkPreflightToggleBinding,
  checked: boolean,
): Partial<WhatsAppSafetySettings> {
  if (binding.kind === 'heavyStartup') {
    const heavy = !checked;
    return { autoDownloadMediaOnStartup: heavy, fetchGroupInfoOnStartup: heavy };
  }
  const value = binding.inverted ? !checked : checked;
  return { [binding.field]: value } as Partial<WhatsAppSafetySettings>;
}

export function countLinkPreflightIssues(data: WhatsAppLinkPreflightResult): number {
  return data.items.filter(i => i.severity !== 'manual' && !i.ok).length;
}

const LINK_SAFETY_AUTO_FIX_FIELDS: Record<string, Record<string, boolean>> = {
  safetyGuard: { globalEnabled: true },
  warmup: { warmupEnabled: true },
  startupSafeMode: { startupSafeModeEnabled: true },
  aiSafety: { aiSafetyEnabled: true },
  campaignsOff: { campaignsEnabled: false },
  followupAutoOff: { followupAutoSendEnabled: false },
  outside24hTemplate: { outside24hRequiresTemplate: true },
  lightStartupSync: { autoDownloadMediaOnStartup: false, fetchGroupInfoOnStartup: false },
};

export function buildLinkSafetyAutoFixPatch(
  items: WhatsAppLinkPreflightItem[],
): Record<string, boolean> {
  const patch: Record<string, boolean> = {};
  for (const item of items) {
    if (item.ok || item.severity === 'manual') continue;
    const fields = LINK_SAFETY_AUTO_FIX_FIELDS[item.id];
    if (!fields) continue;
    Object.assign(patch, fields);
  }
  return patch;
}

export function countAutoFixableLinkSafetyIssues(items: WhatsAppLinkPreflightItem[]): number {
  return items.filter(
    item => !item.ok && item.severity !== 'manual' && Boolean(LINK_SAFETY_AUTO_FIX_FIELDS[item.id]),
  ).length;
}
