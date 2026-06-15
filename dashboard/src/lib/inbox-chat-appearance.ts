import type { UserPreferences } from './user-preferences';

export type InboxChatWallpaperId = 'default' | 'none' | 'dots' | 'diagonal';

export const INBOX_CHAT_WALLPAPER_IDS: InboxChatWallpaperId[] = [
  'default',
  'none',
  'dots',
  'diagonal',
];

export const DEFAULT_INBOX_CHAT_BG = '#F7F8F6';
export const DEFAULT_INBOX_CHAT_OUTGOING = '#D9FDD3';

export const INBOX_CHAT_BG_PRESETS: readonly { id: string; color: string; labelKey: string }[] = [
  { id: 'default', color: '#F7F8F6', labelKey: 'settings.inbox.appearance.bgDefault' },
  { id: 'whatsapp', color: '#ECE5DD', labelKey: 'settings.inbox.appearance.bgWhatsapp' },
  { id: 'white', color: '#FFFFFF', labelKey: 'settings.inbox.appearance.bgWhite' },
  { id: 'mint', color: '#E8F5F2', labelKey: 'settings.inbox.appearance.bgMint' },
  { id: 'sky', color: '#E3F2FD', labelKey: 'settings.inbox.appearance.bgSky' },
  { id: 'slate', color: '#ECEFF1', labelKey: 'settings.inbox.appearance.bgSlate' },
];

export const INBOX_CHAT_OUTGOING_PRESETS: readonly { id: string; color: string; labelKey: string }[] = [
  { id: 'default', color: '#D9FDD3', labelKey: 'settings.inbox.appearance.outDefault' },
  { id: 'whatsapp', color: '#DCF8C6', labelKey: 'settings.inbox.appearance.outWhatsapp' },
  { id: 'teal', color: '#CCFBF1', labelKey: 'settings.inbox.appearance.outTeal' },
  { id: 'blue', color: '#DBEAFE', labelKey: 'settings.inbox.appearance.outBlue' },
  { id: 'lavender', color: '#EDE9FE', labelKey: 'settings.inbox.appearance.outLavender' },
];

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function parseInboxChatWallpaper(value: unknown): InboxChatWallpaperId {
  if (typeof value === 'string' && INBOX_CHAT_WALLPAPER_IDS.includes(value as InboxChatWallpaperId)) {
    return value as InboxChatWallpaperId;
  }
  return 'default';
}

export function parseInboxChatHexColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && HEX_COLOR.test(value.trim())) {
    return value.trim().toUpperCase();
  }
  return fallback;
}

export function inboxChatAppearanceFromPrefs(
  prefs: Pick<UserPreferences, 'inboxChatWallpaper' | 'inboxChatBackgroundColor' | 'inboxChatOutgoingColor'>,
) {
  return {
    wallpaper: parseInboxChatWallpaper(prefs.inboxChatWallpaper),
    backgroundColor: parseInboxChatHexColor(prefs.inboxChatBackgroundColor, DEFAULT_INBOX_CHAT_BG),
    outgoingColor: parseInboxChatHexColor(prefs.inboxChatOutgoingColor, DEFAULT_INBOX_CHAT_OUTGOING),
  };
}

function wallpaperLayers(id: InboxChatWallpaperId): { image: string; size: string } {
  switch (id) {
    case 'none':
      return { image: 'none', size: 'auto' };
    case 'dots':
      return {
        image:
          'radial-gradient(circle at 1px 1px, rgba(17, 27, 33, 0.07) 1px, transparent 0)',
        size: '18px 18px',
      };
    case 'diagonal':
      return {
        image:
          'repeating-linear-gradient(135deg, rgba(17, 27, 33, 0.04) 0, rgba(17, 27, 33, 0.04) 1px, transparent 1px, transparent 12px)',
        size: 'auto',
      };
    case 'default':
    default:
      return {
        image: "url('/interakt-chat-wallpaper.png')",
        size: '480px auto',
      };
  }
}

function mixOutgoingBorder(outgoing: string): string {
  return `color-mix(in srgb, ${outgoing} 72%, #111B21 28%)`;
}

/** Applies inbox chat wallpaper + colors as CSS variables on :root. */
export function applyInboxChatAppearance(
  prefs: Pick<UserPreferences, 'inboxChatWallpaper' | 'inboxChatBackgroundColor' | 'inboxChatOutgoingColor'>,
): void {
  if (typeof document === 'undefined') return;
  const { wallpaper, backgroundColor, outgoingColor } = inboxChatAppearanceFromPrefs(prefs);
  const layers = wallpaperLayers(wallpaper);
  const root = document.documentElement;

  root.style.setProperty('--inbox-chat-bg-color', backgroundColor);
  root.style.setProperty('--inbox-chat-wallpaper-image', layers.image);
  root.style.setProperty('--inbox-chat-wallpaper-size', layers.size);
  root.style.setProperty('--inakt-chat-bg', backgroundColor);
  root.style.setProperty('--inakt-outgoing-bubble', outgoingColor);
  root.style.setProperty('--inakt-outgoing-border', mixOutgoingBorder(outgoingColor));
  root.style.setProperty('--wa-wa-green-soft', outgoingColor);
}

export function resetInboxChatAppearanceDefaults(): Pick<
  UserPreferences,
  'inboxChatWallpaper' | 'inboxChatBackgroundColor' | 'inboxChatOutgoingColor'
> {
  return {
    inboxChatWallpaper: 'default',
    inboxChatBackgroundColor: DEFAULT_INBOX_CHAT_BG,
    inboxChatOutgoingColor: DEFAULT_INBOX_CHAT_OUTGOING,
  };
}
