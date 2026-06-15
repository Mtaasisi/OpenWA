/** Known safe AI profile / opt-out reply templates that must not be flagged as spam. */

const EXEMPT_PATTERNS: RegExp[] = [
  /^Sawa .+, ngoja nisave namba yako/i,
  /^Ahaa basi powa nimekupata\.?$/i,
  /^Sawa Boss, tumekusitishia ujumbe/i,
];

export function isSafeExemptContent(body: string | undefined | null): boolean {
  const text = (body ?? '').trim();
  if (!text) return false;
  return EXEMPT_PATTERNS.some(p => p.test(text));
}
