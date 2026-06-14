export type ExtractedProfileFields = {
  deliveryPreference?: string;
  paymentPreference?: string;
  budgetRange?: string;
  customerUseCase?: string;
  confirmedCity?: string;
  wantedProduct?: string;
  gender?: string;
  location?: string;
  country?: string;
};

const DELIVERY_PICKUP_RE = /\b(dukan|pickup|nitafata|store|shop)\b/i;
const DELIVERY_HOME_RE = /\b(delivery|nitumie|home|nyumbani|deliver)\b/i;
const CASH_RE = /\b(cash|pesa\s+tayari|lipa\s+cash)\b/i;
const INSTALLMENT_RE = /\b(installment|malipo\s+kidogo|polepole|mwezi)\b/i;
const BUDGET_LOW_RE = /\b(nafuu|cheap|budget|bei\s+chini|low)\b/i;
const BUDGET_HIGH_RE = /\b(kali|premium|best|juu|high\s+end)\b/i;
const USE_SCHOOL_RE = /\b(shule|school|student)\b/i;
const USE_WORK_RE = /\b(kazi|office|work)\b/i;
const USE_BUSINESS_RE = /\b(biashara|business|shop)\b/i;

export function extractProfileFieldsSilently(message: string): ExtractedProfileFields {
  const text = message.trim();
  if (!text) return {};
  const out: ExtractedProfileFields = {};

  if (DELIVERY_PICKUP_RE.test(text)) out.deliveryPreference = 'pickup';
  else if (DELIVERY_HOME_RE.test(text)) out.deliveryPreference = 'delivery';

  if (CASH_RE.test(text)) out.paymentPreference = 'cash';
  else if (INSTALLMENT_RE.test(text)) out.paymentPreference = 'installment';

  if (BUDGET_LOW_RE.test(text)) out.budgetRange = 'low';
  else if (BUDGET_HIGH_RE.test(text)) out.budgetRange = 'high';
  else if (/\bmedium\b/i.test(text)) out.budgetRange = 'medium';

  if (USE_SCHOOL_RE.test(text)) out.customerUseCase = 'school';
  else if (USE_WORK_RE.test(text)) out.customerUseCase = 'work';
  else if (USE_BUSINESS_RE.test(text)) out.customerUseCase = 'business';
  else if (/\b(kawaida|personal|home)\b/i.test(text)) out.customerUseCase = 'personal';

  if (/\bdar\b/i.test(text)) out.confirmedCity = 'Dar';
  else if (/\barusha\b/i.test(text)) out.confirmedCity = 'Arusha';

  if (/\b(i am|i'm)\s+(a\s+)?(male|man|boy)\b/i.test(text)) out.gender = 'Male';
  else if (/\b(i am|i'm)\s+(a\s+)?(female|woman|girl)\b/i.test(text)) out.gender = 'Female';
  else if (/\bgender[:\s]+(male|female|man|woman)\b/i.test(text)) {
    const g = text.match(/\bgender[:\s]+(male|female|man|woman)\b/i)?.[1]?.toLowerCase();
    if (g === 'male' || g === 'man') out.gender = 'Male';
    if (g === 'female' || g === 'woman') out.gender = 'Female';
  }

  const locationMatch = text.match(
    /\b(?:i(?:'m| am)\s+in|i\s+live\s+in|located\s+in|from)\s+([A-Za-z][A-Za-z\s.'-]{1,40})(?:,\s*(US|USA|U\.S\.A?\.?|UK|United States))?\b/i,
  );
  if (locationMatch) {
    const place = locationMatch[1]?.trim();
    const countryToken = locationMatch[2]?.trim();
    if (place) {
      out.location = place;
      if (countryToken) {
        out.country = countryToken.replace(/\./g, '').toUpperCase() === 'USA' ? 'US' : countryToken;
      }
    }
  } else {
    const cityCountry = text.match(/\b([A-Za-z][A-Za-z\s.'-]{1,40}),\s*(US|USA|UK|United States)\b/i);
    if (cityCountry) {
      out.location = cityCountry[1]?.trim();
      const countryToken = cityCountry[2]?.trim();
      if (countryToken) {
        out.country = countryToken.replace(/\./g, '').toUpperCase() === 'USA' ? 'US' : countryToken;
      }
    }
  }

  return out;
}
