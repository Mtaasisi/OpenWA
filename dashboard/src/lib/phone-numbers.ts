/** Display phone list in a textarea (one per line). */
export function formatPhoneNumbersForTextarea(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map(String).map(s => s.trim()).filter(Boolean).join('\n');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(String).map(s => s.trim()).filter(Boolean).join('\n');
        }
      } catch {
        // use raw string below
      }
    }
    return trimmed;
  }
  return '';
}
