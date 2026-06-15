import type { TFunction } from 'i18next';

export type CustomerLabelInput = {
  chatId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  displayName?: string | null;
};

export function isLinkedDeviceChatId(chatId: string): boolean {
  return /@lid$/i.test(chatId);
}

export function whatsappChatLocalId(chatId: string): string {
  return chatId.replace(/@c\.us$/i, '').replace(/@g\.us$/i, '').replace(/@lid$/i, '');
}

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

/** True when a group display name is just the raw WhatsApp group id fallback. */
export function isFallbackGroupIdLabel(display: string, chatId: string): boolean {
  if (!chatId.endsWith('@g.us')) return false;
  const local = whatsappChatLocalId(chatId);
  const stripped = display.replace(/\s*\((group|קבוצה)\)\s*$/i, '').trim();
  if (!stripped) return true;
  const strippedDigits = stripped.replace(/\D/g, '');
  const localDigits = local.replace(/\D/g, '');
  return stripped === local || (strippedDigits.length >= 12 && strippedDigits === localDigits);
}

export function isPlausiblePhoneDigits(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}

const THREE_DIGIT_COUNTRY_CODES = new Set([
  '212', '213', '216', '218', '220', '221', '222', '223', '224', '225', '226', '227', '228', '229',
  '230', '231', '232', '233', '234', '235', '236', '237', '238', '239', '240', '241', '242', '243',
  '244', '245', '246', '248', '249', '250', '251', '252', '253', '254', '255', '256', '257', '258',
  '260', '261', '262', '263', '264', '265', '266', '267', '268', '269', '290', '291', '297', '298',
  '299', '350', '351', '352', '353', '354', '355', '356', '357', '358', '359', '370', '371', '372',
  '373', '374', '375', '376', '377', '378', '380', '381', '382', '383', '385', '386', '387', '389',
  '420', '421', '423', '500', '501', '502', '503', '504', '505', '506', '507', '508', '509', '590',
  '591', '592', '593', '594', '595', '596', '597', '598', '599', '670', '672', '673', '674', '675',
  '676', '677', '678', '679', '680', '681', '682', '683', '685', '686', '687', '688', '689', '690',
  '691', '692', '850', '852', '853', '855', '856', '880', '886', '960', '961', '962', '963', '964',
  '965', '966', '967', '968', '970', '971', '972', '973', '974', '975', '976', '977', '992', '993',
  '994', '995', '996', '998',
]);

function countryCodeLength(digits: string): number {
  if (digits.length === 10) return 0;
  if (digits.length === 11 && digits.startsWith('1')) return 1;
  if (digits.length >= 12 && THREE_DIGIT_COUNTRY_CODES.has(digits.slice(0, 3))) return 3;
  if (digits.length >= 11) return 2;
  return Math.max(1, digits.length - 10);
}

export function formatPhoneDigits(digits: string): string {
  if (!isPlausiblePhoneDigits(digits)) return digits;

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const ccLen = countryCodeLength(digits);
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

/** Strip lid internal ids and non-plausible values from stored CRM phone. */
export function sanitizeCustomerPhone(
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

/** Best E.164-style phone from stored values, then WhatsApp chat id. */
export function resolveCustomerPhone(
  chatId: string,
  ...phones: Array<string | null | undefined>
): string | null {
  for (const phone of phones) {
    const sanitized = sanitizeCustomerPhone(chatId, phone);
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

export type ConversationIdentityFields = {
  chatId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  displayName?: string | null;
  customerHandle?: string | null;
};

export function enrichConversationIdentity<T extends ConversationIdentityFields>(
  row: T,
): T & { customerName: string | null; customerPhone: string | null } {
  const identity = resolveThreadIdentity({
    chatId: row.chatId,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    displayName: row.displayName ?? row.customerHandle,
  });
  return { ...row, customerName: identity.customerName, customerPhone: identity.customerPhone };
}

export function linkedContactFallback(t?: TFunction): string {
  return t ? t('inbox.linkedContact') : 'Linked contact';
}

export function formatCustomerLabel(input: CustomerLabelInput, t?: TFunction): string {
  const { chatId, customerName, customerPhone, displayName } = input;

  const name = resolveCustomerName(chatId, customerName);
  if (name) return name;

  const sanitized = sanitizeCustomerPhone(chatId, customerPhone);
  const phoneDigits =
    sanitized?.replace(/\D/g, '') || phoneDigitsFromChatId(chatId) || '';
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
      const groupSuffix = t ? ` (${t('inbox.chipGroup')})` : ' (group)';
      if (/\((group|קבוצה)\)/i.test(groupDisplay)) return groupDisplay;
      return `${groupDisplay}${groupSuffix}`;
    }
    return t ? t('inbox.interakt.groupChat') : 'Group chat';
  }

  const display = displayName?.trim();
  if (display && display !== chatId && !isInternalLidUserId(display, chatId)) {
    if (looksLikePersonLabel(display) && !isGenericWhatsAppContactLabel(display)) return display;
    const displayDigits = display.replace(/\D/g, '');
    if (isPlausiblePhoneDigits(displayDigits)) return formatPhoneDigits(displayDigits);
  }

  if (isLinkedDeviceChatId(chatId)) {
    return linkedContactFallback(t);
  }

  const fromChat = phoneDigitsFromChatId(chatId);
  if (fromChat) return formatPhoneDigits(fromChat);

  return whatsappChatLocalId(chatId);
}

export function formatSanitizedPhoneDisplay(
  chatId: string,
  phone: string | null | undefined,
  _t?: TFunction,
): string | null {
  const sanitized = sanitizeCustomerPhone(chatId, phone);
  if (sanitized) {
    const digits = sanitized.replace(/\D/g, '');
    if (isPlausiblePhoneDigits(digits)) return formatPhoneDigits(digits);
  }
  const fromChat = phoneDigitsFromChatId(chatId);
  if (fromChat) return formatPhoneDigits(fromChat);
  return null;
}

export type CustomerProfileIdentityInput = {
  chatId: string;
  displayNameOverride?: string | null;
  crmName?: string | null;
  crmPhone?: string | null;
  followupName?: string | null;
  followupPhone?: string | null;
  conversationName?: string | null;
  conversationPhone?: string | null;
  conversationDisplayName?: string | null;
  waContactName?: string | null;
  waContactPhone?: string | null;
  /** Latest WhatsApp push name from inbound message metadata. */
  messageNotifyName?: string | null;
};

const GENERIC_CONTACT_LABELS = new Set([
  'whatsapp contact',
  'business',
  'personal',
  'unknown',
  'whatsapp',
  'other',
]);

function isGenericContactLabel(label: string, t?: TFunction): boolean {
  const trimmed = label.trim();
  if (!trimmed) return true;
  if (GENERIC_CONTACT_LABELS.has(trimmed.toLowerCase())) return true;
  if (t && trimmed === t('inbox.linkedContact')) return true;
  if (t && trimmed === t('inbox.interakt.whatsappContact')) return true;
  return false;
}

function pickPersonName(
  chatId: string,
  candidates: Array<string | null | undefined>,
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || isInternalLidUserId(trimmed, chatId) || isGenericContactLabel(trimmed)) {
      continue;
    }
    if (looksLikePersonLabel(trimmed)) return trimmed;
  }
  return null;
}

function pickPhoneDisplay(
  chatId: string,
  candidates: Array<string | null | undefined>,
  t?: TFunction,
): string | null {
  for (const candidate of candidates) {
    const formatted = formatSanitizedPhoneDisplay(chatId, candidate, t);
    if (formatted) return formatted;
  }
  const fromChat = phoneDigitsFromChatId(chatId);
  if (fromChat) return formatPhoneDigits(fromChat);
  return null;
}

export function latestIncomingNotifyName(
  messages: Array<{ direction?: string; metadata?: unknown }>,
): string | null {
  for (const msg of messages) {
    if (msg.direction && msg.direction !== 'incoming') continue;
    const name = (msg.metadata as { notifyName?: string } | null)?.notifyName?.trim();
    if (name) return name;
  }
  return null;
}

/** Resolve inbox CRM profile hero name + phone from CRM, follow-up, conversation, and live WA contact. */
export function resolveCustomerProfileIdentity(
  input: CustomerProfileIdentityInput,
  t?: TFunction,
): { name: string; phone: string | null } {
  const { chatId } = input;

  const personName = pickPersonName(chatId, [
    input.displayNameOverride,
    input.messageNotifyName,
    input.waContactName,
    input.crmName,
    input.followupName,
    input.conversationName,
    input.conversationDisplayName,
  ]);

  const phone = pickPhoneDisplay(
    chatId,
    [
      input.waContactPhone,
      input.crmPhone,
      input.followupPhone,
      input.conversationPhone,
    ],
    t,
  );

  let name =
    personName ??
    formatCustomerLabel(
      {
        chatId,
        customerName:
          input.followupName ??
          input.crmName ??
          input.conversationName ??
          input.waContactName,
        customerPhone:
          input.followupPhone ??
          input.crmPhone ??
          input.conversationPhone ??
          input.waContactPhone,
        displayName: input.conversationDisplayName,
      },
      t,
    );

  if (isGenericContactLabel(name, t) || isInternalLidUserId(name, chatId)) {
    name = phone ?? (t ? t('inbox.interakt.unidentifiedLead') : 'Unidentified lead');
  }

  if (phone && name === phone) {
    name = personName ?? (t ? t('inbox.interakt.unidentifiedLead') : 'Unidentified lead');
  }

  return { name, phone };
}

export type ConversationPhoneCopyInput = {
  chatId: string;
  customerPhone?: string | null;
  displayName?: string | null;
  waContactPhone?: string | null;
};

/** Clipboard text for inbox "Copy phone" — prefers WA digits from chat id over CRM labels. */
export function conversationPhoneCopyText(
  input: ConversationPhoneCopyInput,
  t?: TFunction,
): string {
  const { chatId } = input;
  if (!chatId.trim() || chatId.endsWith('@g.us')) return '';

  const fromChat = phoneDigitsFromChatId(chatId);
  if (fromChat) return formatPhoneDigits(fromChat);

  const formatted = pickPhoneDisplay(
    chatId,
    [input.waContactPhone, input.customerPhone, input.displayName],
    t,
  );
  if (formatted) return formatted;

  return '';
}

/** Clipboard text for inbox "Copy chat ID" — local WhatsApp id without @suffix. */
export function conversationChatIdCopyText(chatId: string): string {
  const trimmed = chatId.trim();
  if (!trimmed) return '';
  return whatsappChatLocalId(trimmed);
}
