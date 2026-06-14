/**
 * Detect when a customer is actually asking to buy/find a product vs chatting
 * (social media comments, introductions, thanks, etc.).
 */

const PRODUCT_LIKE_RE =
  /\b(iphone|macbook|mac\s*book|samsung|hp|dell|lenovo|charger|chaji|chaja|laptop|simu|phone|tablet|airpods|watch|maembe|mango|ipad|ps\d|xbox|tv|speaker|earbuds|bag|backpack)\b/i;

/** Customer naming themselves — not a product request. */
const SELF_INTRO_RE =
  /\b(naitwa|jina\s+langu|my\s+name\s+is|ninaitwa|this\s+is)\b/i;

/** Saw a post / social mention — not necessarily asking to buy. */
const SOCIAL_MEDIA_RE =
  /\b(instagram|insta|facebook|fb|tiktok|whatsapp\s+status|status\s+yako|channel\s+yako|page\s+yako|reel|video\s+yako)\b/i;

const POST_OBSERVATION_RE =
  /\b(nimeona|nmeona|naona|nimewahi\s+ona|nili\s*ona|umeona|umeona|umesikia)\b.*\b(post|posted|umepost|umeweka|umeshare|share|sharing)\b/i;

const POST_VERB_RE = /\b(umepost|umeweka|umeshare|you\s+posted|posted\s+on|post\s+ya|post\s+yako)\b/i;

const EXPLICIT_PURCHASE_RE =
  /\b(nataka|nahitaji|naweza\s+pata|nichukua|nachukua|nipe|nitumie|bei\s+ya|bei\s+gani|unauza|uko\s+na|una\s+\S|do\s+you\s+have|price\s+of|pricing)\b/i;

const PURCHASE_WITH_PRODUCT_RE =
  /\b(uko\s+na|nataka|naweza\s+pata|una|unauza|bei\s+ya|do\s+you\s+have)\s+\S+/i;

const STOCK_AVAILABILITY_RE =
  /\b(ipo\??|zipo|kuna\??|available|stock|out\s+of\s+stock|hazipo|hakuna)\b/i;

export function isSelfIntroduction(text: string): boolean {
  return SELF_INTRO_RE.test(text.trim());
}

/** Customer commenting on posts/social — route to AI, not inventory fast path. */
export function isSocialOrObservationalMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isSelfIntroduction(t)) return true;
  if (SOCIAL_MEDIA_RE.test(t) && !EXPLICIT_PURCHASE_RE.test(t)) return true;
  if (POST_OBSERVATION_RE.test(t)) return true;
  if (POST_VERB_RE.test(t) && !EXPLICIT_PURCHASE_RE.test(t)) return true;
  if (
    /\b(nimeona|nmeona|naona)\b/i.test(t) &&
    !EXPLICIT_PURCHASE_RE.test(t) &&
    !PURCHASE_WITH_PRODUCT_RE.test(t)
  ) {
    return true;
  }
  return false;
}

/** True only when the customer is clearly asking about buying, price, or stock. */
export function hasExplicitProductPurchaseIntent(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (isSocialOrObservationalMessage(t)) return false;

  if (PURCHASE_WITH_PRODUCT_RE.test(t)) return true;
  if (EXPLICIT_PURCHASE_RE.test(t) && PRODUCT_LIKE_RE.test(t)) return true;
  if (/\bnataka\b/i.test(t) && (PRODUCT_LIKE_RE.test(t) || STOCK_AVAILABILITY_RE.test(t))) {
    return true;
  }
  if (PRODUCT_LIKE_RE.test(t) && STOCK_AVAILABILITY_RE.test(t)) return true;
  if (PRODUCT_LIKE_RE.test(t) && /\b(bei|price)\b/i.test(t)) return true;

  const words = t.split(/\s+/);
  if (PRODUCT_LIKE_RE.test(t) && words.length <= 3 && !/\b(nimeona|nmeona|post|umepost)\b/i.test(t)) {
    return true;
  }

  return false;
}

export function extractExplicitProductSearchQuery(text: string): string | null {
  const t = text.trim();
  if (!hasExplicitProductPurchaseIntent(t)) return null;

  const stripped = t
    .replace(/^(uko\s+na|una|unauza|nataka|naweza\s+pata|do\s+you\s+have|bei\s+ya)\s+/i, '')
    .replace(/[?.!]+$/g, '')
    .trim();
  if (stripped.length >= 2 && PRODUCT_LIKE_RE.test(stripped)) {
    const match = stripped.match(PRODUCT_LIKE_RE);
    if (match) return match[0].trim().slice(0, 120);
    return stripped.slice(0, 120);
  }
  const match = t.match(PRODUCT_LIKE_RE);
  return match ? match[0].trim().slice(0, 120) : stripped.length >= 2 ? stripped.slice(0, 120) : null;
}
