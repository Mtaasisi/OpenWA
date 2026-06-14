import type { LearnedReplySample } from './ai-learning-analyze.util';
import { detectCustomerIntent } from './ai-intent-detector.util';

const MAX_SAMPLES = 4;
const MAX_CHARS = 1400;

export function pickReplySamplesForPrompt(
  incomingText: string,
  samples: LearnedReplySample[],
  maxSamples = MAX_SAMPLES,
  maxChars = MAX_CHARS,
): string {
  if (!samples.length) return '';

  const keywordMatched = pickByKeywordOverlap(incomingText, samples);
  const intent = detectCustomerIntent(incomingText);
  const intentMatched = samples.filter(s => s.intent === intent);

  let matched: LearnedReplySample[];
  if (keywordMatched.length) {
    matched = keywordMatched;
  } else if (intentMatched.length) {
    matched = intentMatched;
  } else {
    matched = dedupeByIntent(samples);
  }

  matched = matched.slice(0, maxSamples);

  const lines = [
    '=== Staff reply examples (match tone and style — use tools for live prices, stock, location, and payment; do not copy outdated facts) ===',
  ];

  for (const sample of matched) {
    lines.push(`Customer: ${sample.customer.trim()}`);
    lines.push(`Staff: ${sample.staff.trim()}`);
    lines.push('');
  }

  return lines.join('\n').trim().slice(0, maxChars);
}

function pickByKeywordOverlap(
  incomingText: string,
  samples: LearnedReplySample[],
): LearnedReplySample[] {
  const tokens = incomingText
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(t => t.length > 2);
  if (!tokens.length) return [];

  return samples
    .map(sample => {
      const customer = sample.customer.toLowerCase();
      const hits = tokens.filter(t => customer.includes(t)).length;
      return { sample, hits };
    })
    .filter(row => row.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(row => row.sample);
}

function dedupeByIntent(samples: LearnedReplySample[]): LearnedReplySample[] {
  const seen = new Set<string>();
  const out: LearnedReplySample[] = [];
  for (const sample of samples) {
    if (seen.has(sample.intent)) continue;
    seen.add(sample.intent);
    out.push(sample);
  }
  return out.length ? out : samples;
}
