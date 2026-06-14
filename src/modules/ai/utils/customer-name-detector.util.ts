/** Words that must never be saved as customer names. */
export const NAME_BLOCKLIST = new Set(
  [
    'macbook',
    'iphone',
    'ipad',
    'laptop',
    'charger',
    'cable',
    'chaja',
    'airpods',
    'tv',
    'dar',
    'arusha',
    'mwenge',
    'kariakoo',
    'delivery',
    'pickup',
    'nitafata',
    'cash',
    'installment',
    'payment',
    'malipo',
    'leo',
    'kesho',
    'jioni',
    'ndiyo',
    'ndio',
    'hapana',
    'sawa',
    'ok',
    'okay',
    'yes',
    'no',
    'hello',
    'test',
    'admin',
    'bei',
    'ngapi',
    'ipo',
    'kuna',
    'wapi',
    'boss',
    'mambo',
    'habari',
    'salama',
    'karibu',
    'asante',
    'thanks',
  ].map(s => s.toLowerCase()),
);

/** Common nouns/products/locations that need confirmation before saving as a name. */
export const SUSPICIOUS_NAME_WORDS = new Set(
  [
    'mchele',
    'wali',
    'chakula',
    'simu',
    'iphone',
    'macbook',
    'laptop',
    'charger',
    'cable',
    'airpods',
    'tv',
    'dar',
    'arusha',
    'mwenge',
    'kariakoo',
    'boss',
    'admin',
    'test',
    'hello',
    'yes',
    'no',
    'ndio',
    'hapana',
    'sawa',
    'payment',
    'delivery',
    'pickup',
    'cash',
    'installment',
  ].map(s => s.toLowerCase()),
);

const INTRO_PATTERNS: Array<{ re: RegExp; group: number }> = [
  { re: /(?:naitwa|jina\s+langu\s+ni?)\s+([A-Za-z\u00C0-\u024F]{2,30})/i, group: 1 },
  { re: /(?:mimi\s+ni?|ni\s+)([A-Za-z\u00C0-\u024F]{2,30})(?:\s+sio|\s*$)/i, group: 1 },
  { re: /(?:my\s+name\s+is|this\s+is|i\s*am|i'm)\s+([A-Za-z\u00C0-\u024F]{2,30})/i, group: 1 },
];

const NAME_QUESTION_RE =
  /(?:jina\s+gani|kwa\s+jina\s+gani|nikutambue\s+kwa\s+jina|nikutengenezee\s+(?:quote|order)|nikuwekee\s+order|delivery\s+iwe\s+kwa\s+jina|receipt\s+kwa\s+jina|nitakujulisha)/i;

const QUESTION_RE = /\?|bei\s+gani|ngapi|ipo\s*\?|available/i;

export type NameDetectionResult = {
  name: string;
  confidence: number;
  source: 'intro_phrase' | 'after_name_question' | 'single_token';
  suspicious?: boolean;
};

function normalizeToken(raw: string): string {
  return raw.trim().replace(/^[,.\s]+|[,.\s]+$/g, '');
}

function isBlocklisted(name: string): boolean {
  const lower = name.toLowerCase();
  if (NAME_BLOCKLIST.has(lower)) return true;
  if (/^\d+$/.test(lower)) return true;
  if (lower.length < 2 || lower.length > 30) return true;
  if (!/[a-zA-Z\u00C0-\u024F]/.test(name)) return true;
  if (/iphone|macbook|samsung|pixel|redmi|tecno|infinix|laptop|charger|airpods/i.test(name)) {
    return true;
  }
  return false;
}

export function isSuspiciousName(name: string): boolean {
  const lower = name.trim().toLowerCase();
  if (!lower) return true;
  if (SUSPICIOUS_NAME_WORDS.has(lower)) return true;
  if (/^[\p{Emoji}\p{Symbol}\p{Punctuation}\s]+$/u.test(name)) return true;
  if (/\b(charger|cable|laptop|iphone|macbook|payment|delivery|pickup|installment)\b/i.test(name)) {
    return true;
  }
  if (/\b(dar|arusha|mwenge|kariakoo)\b/i.test(name)) return true;
  return false;
}

export function formatNameConfirmationQuestion(name: string): string {
  return `Nikutambue kama ${capitalizeName(name)} Boss?`;
}

export function aiAskedForName(previousAiMessage: string | null | undefined): boolean {
  if (!previousAiMessage?.trim()) return false;
  return NAME_QUESTION_RE.test(previousAiMessage);
}

export function extractNameSafely(
  message: string,
  previousAiMessage: string | null | undefined,
): NameDetectionResult | null {
  const text = message.trim();
  if (!text || text.length > 80) return null;

  for (const { re, group } of INTRO_PATTERNS) {
    const m = text.match(re);
    if (m?.[group]) {
      const name = normalizeToken(m[group]);
      const suspicious = isSuspiciousName(name);
      if (!isBlocklisted(name) || suspicious) {
        if (isBlocklisted(name) && suspicious) {
          return {
            name: capitalizeName(name),
            confidence: 0.55,
            source: 'intro_phrase',
            suspicious: true,
          };
        }
        if (!isBlocklisted(name)) {
          return {
            name: capitalizeName(name),
            confidence: suspicious ? 0.55 : 0.95,
            source: 'intro_phrase',
            suspicious,
          };
        }
      }
    }
  }

  if (aiAskedForName(previousAiMessage)) {
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length <= 2 && !QUESTION_RE.test(text)) {
      const candidate = normalizeToken(tokens[0]);
      if (!isBlocklisted(candidate)) {
        const suspicious = isSuspiciousName(candidate);
        return {
          name: capitalizeName(candidate),
          confidence: suspicious ? 0.55 : 0.92,
          source: 'after_name_question',
          suspicious,
        };
      }
    }
  }

  return null;
}

export function capitalizeName(name: string): string {
  return name
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatNameSaveReply(template: string, name: string): string {
  return template.replace(/\{name\}/gi, name);
}

export function isAffirmative(text: string): boolean {
  return /^(ndiyo|ndio|yes|yeah|yep|sawa|ok|okay|sure|nimekubali|tafadhali|please)\b/i.test(
    text.trim(),
  );
}

export function isNegative(text: string): boolean {
  return /^(hapana|no|la|sitaki|usijulishe)\b/i.test(text.trim());
}

export function customerRejectedAlternative(text: string): boolean {
  return /\b(hapana|sitaki|sio\s+hiyo|nataka\s+hiyo\s+hiyo|exact|tu\s*$|only)\b/i.test(text);
}
