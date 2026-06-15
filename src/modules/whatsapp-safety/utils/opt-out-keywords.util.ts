/** Unified opt-out keyword detection for WhatsApp safety (AI + follow-up + marketing). */

const OPT_OUT_PATTERNS: RegExp[] = [
  /^\s*(stop|unsubscribe|opt\s*out|cancel|block|enough|no\s+more)\s*$/i,
  /^\s*(no\s+)?bot\s*$/i,
  /^\s*human\s+(please|agent|only)?\s*$/i,
  /^\s*(real\s+)?person\s+(please)?\s*$/i,
  /^\s*talk\s+to\s+(a\s+)?(human|person|agent)\s*$/i,
  /^\s*don'?t\s+(use\s+)?ai\b/i,
  /^\s*no\s+ai\b/i,
  /^\s*stop\s+(the\s+)?(ai|bot|auto)\b/i,
  /\bstop\s+replying\b/i,
  /\bdo\s+not\s+(reply|respond|contact)\s/i,
  /^\s*simama\s*$/i,
  /^\s*mtu\s+(halisi|kweli)\s*$/i,
  /^\s*hauntaki\s+bot/i,
  /\b(sitaki|acha|usiendelee|usinitumie)\b/i,
  /\bunsubscribe\b/i,
];

export const OPT_OUT_KEYWORDS = [
  'stop',
  'acha',
  'sitaki',
  'usinitumie',
  'usiendelee',
  'unsubscribe',
  'cancel',
  'block',
  'enough',
  'no more',
];

export function detectOptOutKeyword(message: string, extraKeywords: string[] = []): boolean {
  const text = message.trim();
  if (!text || text.length > 300) return false;
  if (text.toLowerCase() === 'no') return true;

  if (OPT_OUT_PATTERNS.some(p => p.test(text))) return true;

  const lower = text.toLowerCase();
  const allKeywords = [...OPT_OUT_KEYWORDS, ...extraKeywords]
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);
  return allKeywords.some(kw => lower === kw || lower.includes(kw));
}

/** @deprecated Use detectOptOutKeyword — kept for backward compat with AI util */
export function detectCustomerAiOptOut(message: string, extraKeywords?: string[]): boolean {
  return detectOptOutKeyword(message, extraKeywords);
}

/** @deprecated Use detectOptOutKeyword — kept for backward compat with follow-up util */
export function isOptOutMessage(text: string, extraKeywords?: string[]): boolean {
  return detectOptOutKeyword(text, extraKeywords);
}
