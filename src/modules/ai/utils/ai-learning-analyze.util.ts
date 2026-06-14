import type { LearningMessageRow } from './ai-learning-csv.util';
import { isCustomerMessage } from './ai-learning-csv.util';
import { detectCustomerIntent } from './ai-intent-detector.util';
import { AiCustomerIntent } from '../ai-signal.enums';

export interface LearnedQuestion {
  text: string;
  count: number;
  intent: string;
}

export interface LearnedReplySample {
  customer: string;
  staff: string;
  intent: string;
}

export interface LearningAnalysisResult {
  customerRows: number;
  topQuestions: LearnedQuestion[];
  intentBreakdown: Record<string, number>;
  replySamples: LearnedReplySample[];
}

const MAX_REPLY_SAMPLES = 20;

export function analyzeLearningMessages(rows: LearningMessageRow[]): LearningAnalysisResult {
  const customerRows = rows.filter(isCustomerMessage);
  const questionCounts = new Map<string, LearnedQuestion>();
  const intentBreakdown: Record<string, number> = {};
  const replySamples: LearnedReplySample[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isCustomerMessage(row)) continue;

    const text = row.messageBody.trim();
    if (text.length < 3 || text.length > 280) continue;

    const intent = detectCustomerIntent(text);
    if (intent === AiCustomerIntent.UNKNOWN) continue;

    intentBreakdown[intent] = (intentBreakdown[intent] ?? 0) + 1;

    const key = text.toLowerCase().slice(0, 120);
    const existing = questionCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      questionCounts.set(key, { text, count: 1, intent });
    }

    if (replySamples.length >= MAX_REPLY_SAMPLES) continue;

    const staffReply = findNextStaffReply(rows, i);
    if (staffReply) {
      replySamples.push({
        customer: text,
        staff: staffReply,
        intent,
      });
    }
  }

  const topQuestions = [...questionCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return {
    customerRows: customerRows.length,
    topQuestions,
    intentBreakdown,
    replySamples,
  };
}

function findNextStaffReply(rows: LearningMessageRow[], customerIndex: number): string | null {
  for (let j = customerIndex + 1; j < Math.min(customerIndex + 6, rows.length); j++) {
    const row = rows[j];
    if (!isCustomerMessage(row)) {
      const body = row.messageBody.trim();
      if (body.length >= 3 && body.length <= 500) return body;
      return null;
    }
  }
  return null;
}
