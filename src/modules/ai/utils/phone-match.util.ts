/** Digits-only form for loose phone matching (E.164, local, WhatsApp ids). */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function phonesMatch(a: string, b: string): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  const minLen = 9;
  if (da.length >= minLen && db.length >= minLen) {
    return da.endsWith(db.slice(-minLen)) || db.endsWith(da.slice(-minLen));
  }
  return false;
}

export function isAllowedStaffPhone(senderId: string, allowed: string[]): boolean {
  if (!allowed.length) return false;
  const fromDigits = normalizePhoneDigits(senderId);
  return allowed.some(n => phonesMatch(fromDigits, n));
}
