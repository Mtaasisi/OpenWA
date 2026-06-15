import { ConversationSource } from '../followup.enums';

/** Canonical lead source values — keep in sync with ConversationSource enum. */
export const LEAD_SOURCE_VALUES: ConversationSource[] = [
  ConversationSource.WHATSAPP,
  ConversationSource.INSTAGRAM,
  ConversationSource.FACEBOOK,
  ConversationSource.TIKTOK,
  ConversationSource.WEBSITE,
  ConversationSource.PHONE_CALL,
  ConversationSource.WALK_IN,
  ConversationSource.REFERRAL,
  ConversationSource.REPEAT_CUSTOMER,
  ConversationSource.GOOGLE,
  ConversationSource.OTHER,
];

const VALID = new Set<string>(LEAD_SOURCE_VALUES);

/** Map legacy / unknown DB values to a standard source. */
export function normalizeLeadSource(raw: string | null | undefined): ConversationSource {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return ConversationSource.OTHER;
  if (VALID.has(v)) return v as ConversationSource;
  if (v === 'wa' || v === 'whatsapp_business') return ConversationSource.WHATSAPP;
  if (v === 'fb' || v === 'meta') return ConversationSource.FACEBOOK;
  if (v === 'ig') return ConversationSource.INSTAGRAM;
  if (v === 'web' || v === 'online') return ConversationSource.WEBSITE;
  if (v === 'phone' || v === 'call') return ConversationSource.PHONE_CALL;
  if (v === 'walkin' || v === 'walk-in') return ConversationSource.WALK_IN;
  if (v === 'repeat' || v === 'returning') return ConversationSource.REPEAT_CUSTOMER;
  if (v === 'gmb' || v === 'google_maps' || v === 'google_ads') return ConversationSource.GOOGLE;
  return ConversationSource.OTHER;
}

export function isValidLeadSource(value: string): value is ConversationSource {
  return VALID.has(value);
}
