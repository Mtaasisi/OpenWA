export interface NormalizedPhone {
  raw: string;
  normalized: string;
  providerFormat: string;
}

const TZ_LOCAL_PREFIX = '255';

/** Normalize Tanzania phone numbers to international digits without plus. */
export function normalizeSmsPhone(input: string | null | undefined): NormalizedPhone | null {
  if (!input?.trim()) return null;

  let digits = input.trim().replace(/[\s\-().+]/g, '');

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length >= 10) {
    digits = TZ_LOCAL_PREFIX + digits.slice(1);
  } else if (/^[67]\d{8}$/.test(digits)) {
    digits = TZ_LOCAL_PREFIX + digits;
  }

  if (!/^\d{10,15}$/.test(digits)) {
    return null;
  }

  if (digits.startsWith(TZ_LOCAL_PREFIX) && digits.length !== 12) {
    return null;
  }

  return {
    raw: input.trim(),
    normalized: digits,
    providerFormat: digits,
  };
}

export function validateSmsPhone(input: string | null | undefined): string {
  const result = normalizeSmsPhone(input);
  if (!result) {
    throw new Error('Invalid or empty phone number');
  }
  return result.normalized;
}
