import type { AiLearningSettings } from '../entities/ai-learning-settings.entity';

export type ConfidenceBand = 'high' | 'medium' | 'low';

export interface ConfidenceInput {
  ragMatchScore?: number;
  knowledgeMatchScore?: number;
  isRiskyIntent?: boolean;
  hasProductAmbiguity?: boolean;
  agentSelfReportedLow?: boolean;
}

export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 512);
}

export function computeConfidenceScore(input: ConfidenceInput): number {
  let score = 0.55;
  if (input.knowledgeMatchScore != null) score = Math.max(score, input.knowledgeMatchScore);
  if (input.ragMatchScore != null) score = score * 0.4 + input.ragMatchScore * 0.6;
  if (input.isRiskyIntent) score -= 0.25;
  if (input.hasProductAmbiguity) score -= 0.15;
  if (input.agentSelfReportedLow) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

export function classifyConfidenceBand(
  score: number,
  settings: Pick<AiLearningSettings, 'highConfidenceThreshold' | 'mediumConfidenceThreshold'>,
): ConfidenceBand {
  if (score >= settings.highConfidenceThreshold) return 'high';
  if (score >= settings.mediumConfidenceThreshold) return 'medium';
  return 'low';
}

export function questionSimilarity(a: string, b: string): number {
  const na = normalizeQuestion(a);
  const nb = normalizeQuestion(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const wa = new Set(na.split(' ').filter(w => w.length > 2));
  const wb = new Set(nb.split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  const base = overlap / Math.max(wa.size, wb.size);
  const smaller = wa.size <= wb.size ? wa : wb;
  const larger = wa.size <= wb.size ? wb : wa;
  let contained = 0;
  for (const w of smaller) if (larger.has(w)) contained++;
  if (contained === smaller.size && smaller.size > 0) {
    return Math.max(base, 0.72);
  }
  return base;
}

/** Minimum similarity for training-center applied knowledge to auto-reply in inbox. */
export const TRAINING_KNOWLEDGE_MATCH_MIN = 0.65;

export function knowledgeAutoReplyThreshold(
  knowledge: { sourceItemId?: string | null },
  settings: Pick<AiLearningSettings, 'highConfidenceThreshold' | 'trainingKnowledgeMatchThreshold'>,
): number {
  if (knowledge.sourceItemId) {
    const trainingMin = settings.trainingKnowledgeMatchThreshold ?? TRAINING_KNOWLEDGE_MATCH_MIN;
    const clamped = Math.max(0.5, Math.min(trainingMin, settings.highConfidenceThreshold));
    return clamped;
  }
  return settings.highConfidenceThreshold;
}
