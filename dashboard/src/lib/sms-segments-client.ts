/** Client-side SMS segment estimate (mirrors backend logic). */
export function calculateSmsSegmentsClient(message: string): {
  smsCount: number;
  isUnicode: boolean;
  warning?: string;
} {
  const GSM7_REGEX =
    /^[\n\r @£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà^{}\\\[~\]|€]*$/;
  const text = message ?? '';
  const isUnicode = !GSM7_REGEX.test(text);
  const charCount = text.length;
  let smsCount = 0;
  if (charCount > 0) {
    smsCount = isUnicode
      ? charCount <= 70
        ? 1
        : Math.ceil(charCount / 63)
      : charCount <= 160
        ? 1
        : Math.ceil(charCount / 153);
  }
  const warning =
    smsCount > 1 ? `Message will be sent as ${smsCount} SMS segments` : undefined;
  return { smsCount, isUnicode, warning };
}
