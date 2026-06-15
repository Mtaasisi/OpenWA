/** Normalize Baileys JIDs to OpenWA chat ids (@c.us / @g.us). */
export function toOpenWaChatId(jid: string | null | undefined): string {
  if (!jid) return '';
  if (jid.endsWith('@s.whatsapp.net')) return jid.replace('@s.whatsapp.net', '@c.us');
  return jid;
}

/** Convert OpenWA chat id to Baileys JID. */
export function toBaileysJid(chatId: string): string {
  if (chatId.endsWith('@c.us')) return chatId.replace('@c.us', '@s.whatsapp.net');
  return chatId;
}

export function phoneFromJid(jid: string): string {
  return jid.split('@')[0]?.split(':')[0] ?? '';
}

export function phoneDigitsFromOpenWaChatId(chatId: string): string | null {
  const openWa = toOpenWaChatId(chatId);
  if (!openWa.endsWith('@c.us')) return null;
  const digits = phoneFromJid(toBaileysJid(openWa)).replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}
