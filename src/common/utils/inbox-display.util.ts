/** WhatsApp @lid threads use an internal user id — not an E.164 phone number. */

export function isLinkedDeviceChatId(chatId: string): boolean {
  return /@lid$/i.test(chatId);
}

export function whatsappChatLocalId(chatId: string): string {
  return chatId.replace(/@c\.us$/i, '').replace(/@g\.us$/i, '').replace(/@lid$/i, '');
}

/** True when a label is the raw @lid user id (long digit string), not a person name or phone. */
export function isInternalLidUserId(label: string, chatId: string): boolean {
  if (!isLinkedDeviceChatId(chatId)) return false;
  const local = whatsappChatLocalId(chatId);
  const norm = label.trim();
  if (!norm) return false;
  if (norm === chatId || norm === local) return true;
  const digits = norm.replace(/\D/g, '');
  const localDigits = local.replace(/\D/g, '');
  return digits.length >= 14 && digits === localDigits;
}

export function looksLikePersonLabel(label: string): boolean {
  const t = label.trim();
  if (!t) return false;
  return /[a-zA-Z\u00C0-\u024F\u0590-\u05FF]/.test(t);
}

export function isFallbackGroupIdLabel(display: string, chatId: string): boolean {
  if (!chatId.endsWith('@g.us')) return false;
  const local = whatsappChatLocalId(chatId);
  const stripped = display.replace(/\s*\(group\)\s*$/i, '').trim();
  if (!stripped) return true;
  const strippedDigits = stripped.replace(/\D/g, '');
  const localDigits = local.replace(/\D/g, '');
  return stripped === local || (strippedDigits.length >= 12 && strippedDigits === localDigits);
}

/** True when a WhatsApp-provided title is safe to show (not a raw jid / lid internal id). */
export function isUsableWhatsAppChatTitle(name: string, chatId: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (isInternalLidUserId(trimmed, chatId)) return false;
  if (chatId.endsWith('@g.us') && isFallbackGroupIdLabel(trimmed, chatId)) return false;
  return true;
}

export function isPlausiblePhoneDigits(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}

/** Format digits for display (E.164-style when length is phone-like). */
export function formatPhoneDigits(digits: string): string {
  if (!isPlausiblePhoneDigits(digits)) return digits;

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const ccLen = digits.length === 11 ? 1 : digits.length - 10;
  const cc = digits.slice(0, ccLen);
  const national = digits.slice(ccLen);
  const grouped = national.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return `+${cc} ${grouped}`;
}

export function phoneDigitsFromChatId(chatId: string): string | null {
  if (!chatId.endsWith('@c.us') && !chatId.endsWith('@s.whatsapp.net')) return null;
  const digits = whatsappChatLocalId(chatId.replace(/@s\.whatsapp\.net$/i, '@c.us')).replace(/\D/g, '');
  return isPlausiblePhoneDigits(digits) ? digits : null;
}

export type InboxChatLabelInput = {
  chatId: string;
  displayName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  linkedContactFallback?: string;
};

/** Strip lid internal ids and non-plausible values from stored CRM phone. */
export function sanitizeStoredPhone(
  chatId: string,
  phone: string | null | undefined,
): string | null {
  const trimmed = phone?.trim();
  if (!trimmed) return null;
  if (isInternalLidUserId(trimmed, chatId)) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (!isPlausiblePhoneDigits(digits)) return null;
  return trimmed;
}

/** WhatsApp push names / categories that are not usable person names. */
const GENERIC_WHATSAPP_LABELS = new Set([
  'business',
  'personal',
  'unknown',
  'whatsapp',
  'whatsapp contact',
  'other',
]);

export function isGenericWhatsAppContactLabel(label: string | null | undefined): boolean {
  const trimmed = label?.trim();
  if (!trimmed) return true;
  return GENERIC_WHATSAPP_LABELS.has(trimmed.toLowerCase());
}

/** Best displayable person name — skips lid internal ids and non-name labels. */
export function resolveCustomerName(
  chatId: string,
  ...names: Array<string | null | undefined>
): string | null {
  for (const name of names) {
    const trimmed = name?.trim();
    if (
      !trimmed ||
      isInternalLidUserId(trimmed, chatId) ||
      !looksLikePersonLabel(trimmed) ||
      isGenericWhatsAppContactLabel(trimmed)
    ) {
      continue;
    }
    return trimmed;
  }
  return null;
}

/** Best E.164-style phone from stored CRM/follow-up values, then WhatsApp chat id. */
export function resolveCustomerPhone(
  chatId: string,
  ...phones: Array<string | null | undefined>
): string | null {
  for (const phone of phones) {
    const sanitized = sanitizeStoredPhone(chatId, phone);
    if (sanitized) return sanitized;
  }
  const derived = phoneDigitsFromChatId(chatId);
  return derived ? `+${derived}` : null;
}

export type ThreadIdentityInput = {
  chatId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  crmName?: string | null;
  crmPhone?: string | null;
  displayName?: string | null;
  chatTitle?: string | null;
};

/** Unified name + phone resolution for any thread surface (inbox, pipeline, AI, SMS). */
export function resolveThreadIdentity(input: ThreadIdentityInput): {
  customerName: string | null;
  customerPhone: string | null;
} {
  const { chatId } = input;
  const chatTitleName =
    input.chatTitle && !chatId.endsWith('@g.us')
      ? resolveCustomerName(chatId, input.chatTitle)
      : null;

  return {
    customerName:
      resolveCustomerName(
        chatId,
        input.customerName,
        input.crmName,
        input.displayName,
        input.chatTitle,
      ) || chatTitleName,
    customerPhone: resolveCustomerPhone(
      chatId,
      input.customerPhone,
      input.crmPhone,
    ),
  };
}

export function resolveInboxChatTitle(input: InboxChatLabelInput): string {
  const { chatId, displayName, customerName, customerPhone, linkedContactFallback } = input;

  const resolvedName = resolveCustomerName(chatId, customerName);
  if (resolvedName) return resolvedName;

  const sanitizedPhone = sanitizeStoredPhone(chatId, customerPhone);
  const phoneDigits =
    sanitizedPhone?.replace(/\D/g, '') || phoneDigitsFromChatId(chatId) || '';
  if (phoneDigits && isPlausiblePhoneDigits(phoneDigits)) {
    return formatPhoneDigits(phoneDigits);
  }

  if (chatId.endsWith('@g.us')) {
    const groupDisplay = displayName?.trim();
    if (
      groupDisplay &&
      groupDisplay !== chatId &&
      !isInternalLidUserId(groupDisplay, chatId) &&
      !isFallbackGroupIdLabel(groupDisplay, chatId)
    ) {
      if (/\(group\)/i.test(groupDisplay)) return groupDisplay;
      return `${groupDisplay} (group)`;
    }
    const base = whatsappChatLocalId(chatId);
    return `${formatPhoneDigits(base.replace(/\D/g, '')) || base} (group)`;
  }

  const display = displayName?.trim();
  if (
    display &&
    display !== chatId &&
    !isInternalLidUserId(display, chatId) &&
    looksLikePersonLabel(display) &&
    !isGenericWhatsAppContactLabel(display)
  ) {
    return display;
  }

  if (isLinkedDeviceChatId(chatId)) {
    return linkedContactFallback ?? 'WhatsApp contact';
  }

  const fromChat = phoneDigitsFromChatId(chatId);
  if (fromChat) return formatPhoneDigits(fromChat);

  return whatsappChatLocalId(chatId);
}
