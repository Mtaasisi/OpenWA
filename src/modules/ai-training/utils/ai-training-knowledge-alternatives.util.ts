import type { AiLearningItem } from '../../ai/entities/ai-learning-item.entity';
import { normalizeQuestion } from '../../ai/utils/ai-learning-confidence.util';
import { parseCustomInstruction } from './ai-training-sanitize.util';

export function buildTrainingAlternativeQuestions(
  item: Pick<AiLearningItem, 'question' | 'normalizedQuestion' | 'title' | 'detectedIntent'>,
  options?: {
    customInstruction?: string | null;
    extraPhrases?: string[];
  },
): string[] {
  const primaryNorm = normalizeQuestion(item.question);
  const alts = new Set<string>();

  const push = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const normalized = normalizeQuestion(trimmed);
    if (!normalized || normalized === primaryNorm) return;
    alts.add(trimmed);
  };

  push(item.normalizedQuestion);
  push(item.title);
  push(item.detectedIntent);
  for (const phrase of options?.extraPhrases ?? []) push(phrase);

  if (options?.customInstruction) {
    try {
      const parsed = parseCustomInstruction(options.customInstruction, item.question);
      for (const phrase of parsed.triggerPhrases ?? []) push(phrase);
    } catch {
      // ignore malformed custom instruction blocks
    }
  }

  return [...alts].slice(0, 8);
}
