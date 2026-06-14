const PAYMENT_PROOF_TEXT_RE =
  /\b(nimelipa|nime\s*lipa|nimepokea|nimetuma|sent\s+payment|payment\s+sent|screenshot|screen\s*shot|slip|receipt|nime\s*share|nimeweka|nime\s*weka|malipo\s*yamekwenda|nime\s*transfer)\b/i;

const PAYMENT_MEDIA_PLACEHOLDER_RE =
  /^\[(image|photo|document|media|attachment)\]$/i;

export function isPaymentProofMessage(text: string, hasMedia = false): boolean {
  const t = text.trim();
  if (hasMedia && /\b(lipa|malipo|payment|mpesa|screenshot|slip)\b/i.test(t)) {
    return true;
  }
  if (PAYMENT_MEDIA_PLACEHOLDER_RE.test(t) && hasMedia) return true;
  return PAYMENT_PROOF_TEXT_RE.test(t);
}

export const PAYMENT_PROOF_ACK_REPLY =
  'Asante Boss 😊 Nimepokea. Ngoja nithibitishe malipo halafu nakujibu muda si mrefu.';
