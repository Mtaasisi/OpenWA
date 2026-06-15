export interface ContentSafetyResult {
  safe: boolean;
  flags: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

const SHORT_LINK_RE = /\b(bit\.ly|tinyurl|t\.co|goo\.gl|rb\.gy|shorturl)\b/i;
const ALL_CAPS_RE = /^[A-Z0-9\s!?.]{20,}$/;
const EMOJI_HEAVY_RE = /(\p{Extended_Pictographic})/gu;

export function analyzeMessageContent(body: string | undefined | null): ContentSafetyResult {
  const text = (body ?? '').trim();
  const flags: string[] = [];
  if (!text) return { safe: true, flags, riskLevel: 'low' };

  if (ALL_CAPS_RE.test(text)) flags.push('all_caps_marketing');
  if (SHORT_LINK_RE.test(text)) flags.push('suspicious_short_link');
  const emojiCount = (text.match(EMOJI_HEAVY_RE) ?? []).length;
  if (emojiCount > 8) flags.push('too_many_emojis');
  if ((text.match(/https?:\/\//gi) ?? []).length > 3) flags.push('too_many_links');
  if (/\b(free|win|winner|100%|guaranteed)\b/i.test(text) && emojiCount > 2) {
    flags.push('promotional_spam_pattern');
  }

  const riskLevel =
    flags.includes('promotional_spam_pattern') || flags.includes('suspicious_short_link')
      ? 'high'
      : flags.length >= 2
        ? 'medium'
        : flags.length === 1
          ? 'medium'
          : 'low';

  return {
    safe: riskLevel !== 'high',
    flags,
    riskLevel,
  };
}

export function isDuplicateBulkBody(body: string, recentBodies: string[]): boolean {
  const normalized = body.trim().toLowerCase();
  return recentBodies.some(b => b.trim().toLowerCase() === normalized);
}
