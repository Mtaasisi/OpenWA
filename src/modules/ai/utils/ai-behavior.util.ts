import type { ChatMessageForAi } from '../../message/message.service';
import { MessageDirection } from '../../message/entities/message.entity';

/** Agreed deterministic customer-facing replies (Boss/friendly/mtaani). */
export const GREETING_ONLY_REPLY = 'Mambo vipi Boss 😊 Karibu Inauzwa.';
export const PRESENCE_ACTIVE_REPLY = 'Ndiyo Boss niko online 😊';
export const PRESENCE_HERE_REPLY = 'Ndiyo Boss niko hapa 😊';
export const PRESENCE_DELAYED_REPLY = 'Nipo Boss, samahani kuchelewa kidogo 😊';
export const GREETING_REPEAT_REPLY = 'Nipo Boss 😊';
export const GREETING_REPEAT_ALT_REPLY = 'Karibu Boss, nikuangalizie nini?';
export const CONTEXT_CLARIFICATION_REPLY =
  'Samahani boss, nikumbushe unahitaji nini ilikuwa?';
export const BRANCH_CITY_ASK_REPLY = 'Boss uko Dar au Arusha?';
export const REPEATED_DISCOUNT_ACK_REPLY =
  'Ngoja nione nini naweza kufanya boss, nitakurudia.';

/** Soft re-confirm saved city then share branch location (no re-ask Dar/Arusha). */
export function buildSoftCityLocationReply(city: string, locationBlock: string): string {
  const label = city.trim();
  const location = locationBlock.trim();
  if (!location) return `Si uko ${label} Boss?`;
  return `Si uko ${label} Boss?\n\n${location}`;
}

export function buildCompatibilityAckReply(modelAnswer: string, productInterest: string | null): string {
  const model = modelAnswer.trim();
  const product = productInterest?.trim() || 'hii';
  const accessory = /\b(charger|chaja|chaji|cable|adapter|earphone|headphone)\b/i.test(product);
  if (accessory) {
    return `Sawa Boss 😊 Kwa ${model}, ${product} inafaa. Unataka bei?`;
  }
  return `Sawa Boss 😊 Kwa ${model}, nitakucheck ${product} inafaa. Sekunde kidogo.`;
}

export function buildOosAlternativesReply(
  query: string,
  alternatives: Array<{ name: string; sellingPrice?: number | null; currency?: string | null }>,
): string {
  const label = query.trim() || 'hii';
  const lines = alternatives.slice(0, 3).map(alt => {
    const price =
      alt.sellingPrice != null && alt.currency
        ? `${alt.currency} ${Number(alt.sellingPrice).toLocaleString('en-US')}`
        : '';
    return price ? `• ${alt.name} — ${price}` : `• ${alt.name}`;
  });
  if (!lines.length) {
    return `Boss nimeangalia ${label} — ngoja nikupe option nzuri karibu nayo.`;
  }
  return `Boss kwa ${label} kuna options hizi sasa:\n${lines.join('\n')}\nUnaweza kuchukua moja ya hizi?`;
}

const HARD_OOS_PHRASE_RE =
  /\b(haipo|hazipo|hakuna|imeisha|not in stock|out of stock|currently unavailable)\b/i;

const FIRST_DISCOUNT_DEFENSE_REPLIES = [
  'Dah boss, hapo nikipunguza sana sipati kitu kabisa 😅 Unajua kwa sasa mizigo imepanda sana gharama, kuipokea nayo imekuwa changamoto, na muda wa kusubiri mzigo umeongezeka. Ndiyo maana bei zimekuwa juu kidogo. Hata hivyo hii bei nimekufanyia vizuri kwa sababu ni stock ya zamani tu.',
  'Dah Boss, hapo nikishusha sana sipati kitu kabisa 😅 Kwa sasa gharama za mzigo zimepanda sana, kuanzia kununua mpaka kuupokea. Ndiyo maana bei zimekuwa tight kidogo. Hii bei nimekufanyia vizuri kwa sababu ni stock ya zamani tu.',
  'Boss hapo bei ni tight sana kwa sasa 😅 Gharama za kuleta mzigo zimepanda na kusubiri mzigo pia imeongezeka. Nimekufanyia vizuri kwa stock ya zamani — sio bei ya kawaida ya sasa.',
];

export function pickFirstDiscountDefenseReply(seed?: string): string {
  if (!FIRST_DISCOUNT_DEFENSE_REPLIES.length) return REPEATED_DISCOUNT_ACK_REPLY;
  if (!seed?.trim()) {
    return FIRST_DISCOUNT_DEFENSE_REPLIES[
      Math.floor(Math.random() * FIRST_DISCOUNT_DEFENSE_REPLIES.length)
    ];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % FIRST_DISCOUNT_DEFENSE_REPLIES.length;
  return FIRST_DISCOUNT_DEFENSE_REPLIES[idx];
}

const SHORT_CONTEXT_RE =
  /^(ipo\??|bei\??|ngapi\??|location\??|wapi\??|kuna\??|available\??)$/i;

const TOPIC_CHANGE_RE = /\bhapana\b/i;

const COMPATIBILITY_QUESTION_RE =
  /(iphone\s*au\s*android|simu\s*yako\s*ni|charger|chaja|compatible|inafaa)/i;

const PHONE_MODEL_ANSWER_RE =
  /\b(iphone\s*\d+|samsung\s*[a-z]?\d+|pixel\s*\d+|redmi\s*\w+|tecno\s*\w+|infinix\s*\w+)\b/i;

export function isShortContextMessage(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (SHORT_CONTEXT_RE.test(t)) return true;
  return t.split(/\s+/).length <= 2 && STOCK_SHORT_RE.test(t);
}

const STOCK_SHORT_RE = /^(ipo|bei|ngapi|kuna)$/i;

export function isTopicChangeMessage(text: string): boolean {
  return TOPIC_CHANGE_RE.test(text.trim());
}

export function isCompatibilityQuestion(text: string): boolean {
  return COMPATIBILITY_QUESTION_RE.test(text);
}

export function isCompatibilityModelAnswer(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 40) return false;
  return PHONE_MODEL_ANSWER_RE.test(t);
}

export function parseAiNotes(raw: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function serializeAiNotes(notes: Record<string, unknown>): string {
  return JSON.stringify(notes);
}

/** Strip internal inventory fields from search_products tool JSON — never expose to customer text. */
export function redactStockForCustomer<T extends Record<string, unknown>>(row: T): T {
  const copy = { ...row } as Record<string, unknown>;
  delete copy.quantity;
  delete copy.totalStock;
  delete copy.variantCount;
  delete copy.inStock;
  delete copy.allowInstallmentWhenOutOfStock;
  if (Array.isArray(copy.variants)) {
    copy.variants = (copy.variants as Record<string, unknown>[]).map(v => {
      const vv = { ...v };
      delete vv.quantity;
      delete vv.inStock;
      delete vv.allowInstallmentWhenOutOfStock;
      return vv;
    });
  }
  return copy as T;
}

const INTERNAL_REASONING_RE =
  /\b(let me wait|it looks like|as an ai|chain of thought|previous message was|from me \(the assistant\)|i am the assistant|the assistant)\b/i;

const STOCK_COUNT_LINE_RE =
  /\b(\d+\s+in\s+stock|stock\s+\d+|stock\s+\d+\s+total|\d+\s+unit(s)?\s+available|out of stock|currently out of stock|unavailable)\b/i;

const STOCK_COUNT_INLINE_RE =
  /\b\d+\s+in\s+stock\b|\bstock\s+\d+(\s+total)?\b|\b\d+\s+unit(s)?\s+available\b|—\s*out of stock\b|\bout of stock\s*[|—]/gi;

/** True when model output looks like internal reasoning — must not be sent to customers. */
export function isInternalReasoningLeak(text: string): boolean {
  return INTERNAL_REASONING_RE.test(text.trim());
}

/** Remove stock/OOS phrases models sometimes copy from tool data. */
export function sanitizeCustomerAiReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept = lines.filter(line => !STOCK_COUNT_LINE_RE.test(line) && !HARD_OOS_PHRASE_RE.test(line));
  let out = kept.join('\n').replace(STOCK_COUNT_INLINE_RE, '').replace(/\s{2,}/g, ' ').trim();
  const sentences = out.split(/(?<=[.!?])\s+/).filter(s => !HARD_OOS_PHRASE_RE.test(s));
  out = sentences.join(' ').trim();
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

function messageTimeMs(m: ChatMessageForAi): number {
  if (m.timestamp != null) return m.timestamp * 1000;
  return m.createdAt.getTime();
}

/** True when AI already sent the full welcome greeting recently. */
export function hasRecentFullGreeting(
  messages: ChatMessageForAi[],
  cooldownMinutes: number,
): boolean {
  if (cooldownMinutes <= 0) return false;
  const cutoff = Date.now() - cooldownMinutes * 60 * 1000;
  const greetingNeedle = GREETING_ONLY_REPLY.slice(0, 20).toLowerCase();
  return messages.some(m => {
    if (m.direction !== MessageDirection.OUTGOING) return false;
    const body = (m.body ?? '').toLowerCase();
    if (!body.includes('karibu inauzwa') && !body.includes(greetingNeedle)) return false;
    return messageTimeMs(m) >= cutoff;
  });
}

export function isConversationActive(messages: ChatMessageForAi[]): boolean {
  const cutoff = Date.now() - 5 * 60 * 1000;
  return messages.some(m => m.body?.trim() && messageTimeMs(m) >= cutoff);
}

export function shouldSendFullGreeting(params: {
  incomingText: string;
  isPureGreeting: boolean;
  messages: ChatMessageForAi[];
  greetingCooldownMinutes: number;
}): boolean {
  if (!params.isPureGreeting) return false;
  if (hasRecentFullGreeting(params.messages, params.greetingCooldownMinutes)) return false;
  if (isConversationActive(params.messages)) return false;
  const hadProductNeed = params.messages.some(
    m =>
      m.direction === MessageDirection.INCOMING &&
      /\b(iphone|macbook|laptop|charger|chaji|chaja|bei|simu|product|nataka)\b/i.test(m.body ?? ''),
  );
  if (hadProductNeed) return false;
  return true;
}

export function pickRepeatedGreetingReply(messages: ChatMessageForAi[]): string {
  const hadProductIntent = messages.some(
    m =>
      m.direction === MessageDirection.INCOMING &&
      /\b(iphone|macbook|laptop|charger|bei|ipo|simu|product)\b/i.test(m.body ?? ''),
  );
  return hadProductIntent ? GREETING_REPEAT_ALT_REPLY : GREETING_REPEAT_REPLY;
}

export function pickBurstQuotedMessageId(
  messages: Array<{ id?: string }>,
  replyToLatest = true,
): string | null {
  if (!messages.length) return null;
  const target = replyToLatest ? messages[messages.length - 1] : messages[0];
  return target?.id?.trim() || null;
}

export function pickPresenceReply(params: {
  incomingText: string;
  messages: ChatMessageForAi[];
  customerWaitingAfterDelay?: boolean;
}): string {
  const t = params.incomingText.toLowerCase();
  if (params.customerWaitingAfterDelay) return PRESENCE_DELAYED_REPLY;
  if (/\b(hapo|there|live)\b/.test(t)) return PRESENCE_HERE_REPLY;
  if (/\b(hello|hi)\??\s*$/i.test(params.incomingText.trim())) {
    if (isConversationActive(params.messages)) return GREETING_REPEAT_REPLY;
    return hasRecentFullGreeting(params.messages, 240)
      ? GREETING_REPEAT_REPLY
      : PRESENCE_ACTIVE_REPLY;
  }
  return PRESENCE_ACTIVE_REPLY;
}

export function mapCityToBranchId(
  city: string,
  profiles: Array<{ branchId: string; branchName?: string | null }>,
): string | null {
  const c = city.toLowerCase();
  const match = profiles.find(p => {
    const name = (p.branchName ?? '').toLowerCase();
    if (c === 'dar' && (name.includes('dar') || name.includes('dsm'))) return true;
    if (c === 'arusha' && name.includes('arusha')) return true;
    return name.includes(c);
  });
  return match?.branchId ?? profiles[0]?.branchId ?? null;
}
