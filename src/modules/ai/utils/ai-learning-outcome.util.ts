import { AiLearningOutcome } from '../ai-learning.enums';

const POSITIVE_RE =
  /\b(asante|thanks|thank you|sawa|poa|nzuri|good|perfect|nimeelewa|safi)\b|👍|🙏/i;
const PURCHASE_RE =
  /\b(nataka kununua|nitumie namba|nataka kuchukua|ready to pay|nataka kulipa|nipe namba)\b/i;
const CORRECTION_RE =
  /\b(sio hiyo|not correct|wrong|bado|hujanijibu|ulikuwa|sio ivi|hapana sio)\b/i;
const ANGRY_RE = /\b(bad|mbaya|fuck|stupid|waste|scam|mdomo)\b/i;

export function detectLearningOutcome(text: string): AiLearningOutcome | null {
  const t = text.trim();
  if (!t || t.length < 2) return AiLearningOutcome.CUSTOMER_IGNORED;
  if (ANGRY_RE.test(t)) return AiLearningOutcome.POOR_PERFORMANCE;
  if (CORRECTION_RE.test(t)) return AiLearningOutcome.STAFF_CORRECTED_LATER;
  if (PURCHASE_RE.test(t)) return AiLearningOutcome.CUSTOMER_BOUGHT;
  if (POSITIVE_RE.test(t)) return AiLearningOutcome.CUSTOMER_REPLIED_POSITIVELY;
  return null;
}

export function bumpSuccessRate(current: number | null, outcome: AiLearningOutcome): number {
  const base = current ?? 0.5;
  switch (outcome) {
    case AiLearningOutcome.CUSTOMER_REPLIED_POSITIVELY:
    case AiLearningOutcome.CUSTOMER_BOUGHT:
      return Math.min(1, base + 0.05);
    case AiLearningOutcome.POOR_PERFORMANCE:
    case AiLearningOutcome.STAFF_CORRECTED_LATER:
      return Math.max(0, base - 0.1);
    case AiLearningOutcome.CUSTOMER_IGNORED:
      return Math.max(0, base - 0.02);
    default:
      return base;
  }
}
