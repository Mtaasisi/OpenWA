import type { ConversationSource } from '../services/api';

/** Standard lead sources — keep aligned with backend ConversationSource enum. */
export const LEAD_SOURCES: ConversationSource[] = [
  'whatsapp',
  'instagram',
  'facebook',
  'tiktok',
  'website',
  'phone_call',
  'walk_in',
  'referral',
  'repeat_customer',
  'google',
  'other',
];

export function leadSourceLabel(source: string, t: (key: string) => string): string {
  const key = `leadSources.${source}`;
  const label = t(key);
  return label === key ? source : label;
}

export function leadSourceIcon(source: string): string {
  switch (source) {
    case 'whatsapp':
      return 'chat';
    case 'instagram':
      return 'photo_camera';
    case 'facebook':
      return 'groups';
    case 'tiktok':
      return 'music_note';
    case 'google':
      return 'search';
    case 'website':
      return 'language';
    case 'referral':
      return 'group_add';
    case 'repeat_customer':
      return 'replay';
    case 'walk_in':
      return 'storefront';
    case 'phone_call':
      return 'call';
    default:
      return 'campaign';
  }
}

export function leadSourceColor(source: string): string {
  switch (source) {
    case 'whatsapp':
      return '#25d366';
    case 'instagram':
      return '#e4405f';
    case 'facebook':
      return '#1877f2';
    case 'tiktok':
      return '#010101';
    case 'google':
      return '#4285f4';
    case 'website':
      return '#6366f1';
    case 'referral':
      return '#f59e0b';
    case 'repeat_customer':
      return '#8b5cf6';
    case 'walk_in':
      return '#14b8a6';
    case 'phone_call':
      return '#64748b';
    default:
      return '#94a3b8';
  }
}
