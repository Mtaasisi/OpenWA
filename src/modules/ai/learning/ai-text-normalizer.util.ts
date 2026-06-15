/** Common Swahili slang / shorthand → normalized forms for intent matching. */
const SWAHILI_SLANG_MAP: Record<string, string> = {
  mambo: 'mambo',
  mamb: 'mambo',
  vip: 'vip',
  vipi: 'vip',
  niaje: 'niaje',
  sasa: 'sasa',
  ndio: 'ndio',
  ndiyo: 'ndio',
  sio: 'sio',
  hapana: 'hapana',
  ndo: 'ndo',
  ndioo: 'ndio',
  uko: 'uko',
  upo: 'upo',
  ukoapo: 'uko',
  upoapo: 'upo',
  niko: 'niko',
  nipo: 'nipo',
  bei: 'bei',
  beiigani: 'bei gani',
  shilingi: 'shilingi',
  elfu: 'elfu',
  ipo: 'ipo',
  zipo: 'zipo',
  kuna: 'kuna',
  hamna: 'hamna',
  haipo: 'haipo',
  nataka: 'nataka',
  nahitaji: 'nahitaji',
  naweza: 'naweza',
  tuma: 'tuma',
  nitumie: 'nitumie',
  nitumiee: 'nitumie',
  boss: 'boss',
  bro: 'boss',
  bosi: 'boss',
  mzee: 'boss',
  samahani: 'samahani',
  pole: 'pole',
  asante: 'asante',
  shukrani: 'asante',
  karibu: 'karibu',
  delivery: 'delivery',
  delivary: 'delivery',
  installment: 'installment',
  malipo: 'malipo',
  lipa: 'lipa',
  warranty: 'warranty',
  warranti: 'warranty',
};

/** Product tokens we preserve casing/spacing for during normalization. */
const PRODUCT_TOKEN_RE =
  /\b(iphone|ipad|macbook|imac|airpods|apple watch|samsung|galaxy|pixel|huawei|xiaomi|redmi|oppo|vivo|realme|tecno|infinix|nokia|lenovo|hp|dell|asus|acer|ps5|xbox|nintendo|a\d{4,5})\b/gi;

export interface NormalizeTextOptions {
  /** Extra product names to preserve (e.g. from catalog). */
  preserveProductNames?: string[];
}

function collapseRepeatedLetters(text: string): string {
  return text.replace(/(.)\1{2,}/g, '$1$1');
}

function preserveProductTokens(text: string, products: string[]): string {
  let out = text;
  const tokens = new Set<string>();
  for (const m of text.matchAll(PRODUCT_TOKEN_RE)) {
    if (m[0]) tokens.add(m[0].toLowerCase());
  }
  for (const p of products) {
    const t = p.trim().toLowerCase();
    if (t) tokens.add(t);
  }
  for (const token of tokens) {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, ` __PRODUCT_${token.replace(/\s+/g, '_')}__ `);
  }
  return out;
}

function restoreProductTokens(text: string): string {
  return text.replace(/__PRODUCT_([^_]+(?:_[^_]+)*)__/g, (_, key: string) =>
    key.replace(/_/g, ' '),
  );
}

/**
 * Normalize customer text for learned-intent lookup and unknown-message dedupe.
 * Lowercases, trims, maps Swahili slang, collapses repeated letters, preserves product names.
 */
export function normalizeCustomerText(text: string, options?: NormalizeTextOptions): string {
  const raw = text.trim();
  if (!raw) return '';

  const preserved = preserveProductTokens(raw.toLowerCase(), options?.preserveProductNames ?? []);
  let normalized = preserved
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  normalized = collapseRepeatedLetters(normalized);

  const words = normalized.split(' ').filter(Boolean);
  const mapped = words.map(w => SWAHILI_SLANG_MAP[w] ?? w);
  normalized = restoreProductTokens(mapped.join(' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);

  return normalized;
}

/** Combine multiple burst messages into one normalized block. */
export function normalizeCombinedCustomerText(messages: string[]): string {
  const combined = messages.map(m => m.trim()).filter(Boolean).join('\n');
  return normalizeCustomerText(combined);
}
