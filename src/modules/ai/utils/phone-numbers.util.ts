/** Coerce DB/API values into a string array (handles legacy plain-text rows). */
export function normalizePhoneNumbers(value: unknown): string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map(String).map(s => s.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map(s => s.trim()).filter(Boolean);
      }
    } catch {
      // fall through — plain phone string or newline-separated list
    }
    return trimmed
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}
