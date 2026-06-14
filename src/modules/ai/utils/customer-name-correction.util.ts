import { capitalizeName } from './customer-name-detector.util';

export type NameCorrectionResult = {
  correctedName: string;
  previousName?: string;
};

const CORRECTION_PATTERNS: RegExp[] = [
  /sio\s+([A-Za-z\u00C0-\u024F]{2,30})\s*,?\s*ni\s+([A-Za-z\u00C0-\u024F]{2,30})/i,
  /si\s+([A-Za-z\u00C0-\u024F]{2,30})\s*,?\s*ni\s+([A-Za-z\u00C0-\u024F]{2,30})/i,
  /ni\s+([A-Za-z\u00C0-\u024F]{2,30})\s+sio\s+([A-Za-z\u00C0-\u024F]{2,30})/i,
  /jina\s+(?:ni|langu\s+ni)\s+([A-Za-z\u00C0-\u024F]{2,30})/i,
  /andika\s+([A-Za-z\u00C0-\u024F]{2,30})/i,
  /no,?\s*([A-Za-z\u00C0-\u024F]{2,30})/i,
  /not\s+([A-Za-z\u00C0-\u024F]{2,30})\s*,?\s*([A-Za-z\u00C0-\u024F]{2,30})/i,
];

export function detectNameCorrection(
  message: string,
  currentName: string | null | undefined,
): NameCorrectionResult | null {
  const text = message.trim();
  if (!text) return null;

  if (/umeandika\s+vibaya/i.test(text) && currentName) {
    return null;
  }

  for (const re of CORRECTION_PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (re.source.startsWith('ni\\s+') && m[1] && m[2]) {
      return {
        correctedName: capitalizeName(m[1]),
        previousName: capitalizeName(m[2]),
      };
    }
    if (re.source.startsWith('not') && m[1] && m[2]) {
      return {
        correctedName: capitalizeName(m[2]),
        previousName: capitalizeName(m[1]),
      };
    }
    if (m[2]) {
      return {
        correctedName: capitalizeName(m[2]),
        previousName: capitalizeName(m[1]),
      };
    }
    if (m[1]) {
      return {
        correctedName: capitalizeName(m[1]),
        previousName: currentName ? capitalizeName(currentName) : undefined,
      };
    }
  }

  return null;
}
