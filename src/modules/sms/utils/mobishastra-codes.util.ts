export const MOBISHASTRA_CODES: Record<string, string> = {
  '000': 'Send Successful',
  '001': 'Invalid Receiver',
  '003': 'Invalid Message',
  '005': 'Authorization failed',
  '006': 'DND Number',
  '007': 'Cannot Extract Country Code',
  '008': 'Empty Receiver',
  '009': 'Profile Blocked',
  '010': 'Invalid Profile ID',
  '011': 'Profile ID expired',
  '012': 'Sender ID more than 13 chars',
  '013': 'Server Error',
};

export function mobishastraCodeMessage(code: string): string {
  const normalized = code.trim().padStart(3, '0');
  return MOBISHASTRA_CODES[normalized] ?? `Unknown error (${code})`;
}

export function isMobishastraSuccess(code: string): boolean {
  return code.trim().padStart(3, '0') === '000';
}

const TEXT_SUCCESS_PATTERNS = [/send successful/i, /^000\b/];
const TEXT_ERROR_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid mobile/i, message: 'Invalid Receiver' },
  { pattern: /invalid password/i, message: 'Authorization failed' },
  { pattern: /profile id blocked|profile blocked/i, message: 'Profile Blocked' },
  { pattern: /no more credits/i, message: 'No More Credits' },
  { pattern: /invalid profile/i, message: 'Invalid Profile ID' },
  { pattern: /enter mobile/i, message: 'Empty Receiver' },
  { pattern: /enter text message/i, message: 'Invalid Message' },
  { pattern: /server error/i, message: 'Server Error' },
];

/** Parse MobiShastra HTTP body — prefers leading 3-digit code (ShowError=C). */
export function parseMobishastraResponse(raw: string): {
  code: string;
  success: boolean;
  message: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { code: '013', success: false, message: mobishastraCodeMessage('013') };
  }

  const leadingCode = trimmed.match(/^(\d{3})/);
  if (leadingCode && MOBISHASTRA_CODES[leadingCode[1]]) {
    const code = leadingCode[1];
    return {
      code,
      success: isMobishastraSuccess(code),
      message: mobishastraCodeMessage(code),
    };
  }

  if (TEXT_SUCCESS_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return { code: '000', success: true, message: mobishastraCodeMessage('000') };
  }

  for (const entry of TEXT_ERROR_PATTERNS) {
    if (entry.pattern.test(trimmed)) {
      return { code: 'ERR', success: false, message: entry.message };
    }
  }

  return { code: 'ERR', success: false, message: trimmed.slice(0, 200) };
}
