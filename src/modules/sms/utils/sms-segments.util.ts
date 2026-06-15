/** Basic GSM-7 character set (excluding extension table for simplicity). */
const GSM7_REGEX =
  /^[\n\r @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\\[~\]|€]*$/;

export interface SmsSegmentInfo {
  smsCount: number;
  isUnicode: boolean;
  charCount: number;
  warning?: string;
}

export function calculateSmsSegments(message: string): SmsSegmentInfo {
  const text = message ?? '';
  const charCount = text.length;
  const isUnicode = !GSM7_REGEX.test(text);

  let smsCount: number;
  if (charCount === 0) {
    smsCount = 0;
  } else if (isUnicode) {
    smsCount = charCount <= 70 ? 1 : Math.ceil(charCount / 63);
  } else {
    smsCount = charCount <= 160 ? 1 : Math.ceil(charCount / 153);
  }

  let warning: string | undefined;
  if (smsCount > 1) {
    warning = `Message will be sent as ${smsCount} SMS segments`;
  }
  if (isUnicode && charCount > 670) {
    warning = `Long Unicode message (${charCount} chars, ${smsCount} segments)`;
  } else if (!isUnicode && charCount > 1600) {
    warning = `Very long message (${charCount} chars, ${smsCount} segments)`;
  }

  return { smsCount, isUnicode, charCount, warning };
}
