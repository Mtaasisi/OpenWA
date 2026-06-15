/** Mask phone/JID or opaque IDs shown in admin dashboards (Phase 8 security). */
export function maskConversationId(id: string | null | undefined): string {
  if (!id) return '—';
  const s = id.trim();
  const atIdx = s.indexOf('@');
  if (atIdx > 4) {
    const local = s.slice(0, atIdx);
    const domain = s.slice(atIdx);
    if (/^\d+$/.test(local) && local.length >= 6) {
      return `${local.slice(0, 3)}***${local.slice(-2)}${domain}`;
    }
    if (local.length > 6) {
      return `${local.slice(0, 3)}…${local.slice(-2)}${domain}`;
    }
  }
  if (s.length > 10) return `${s.slice(0, 4)}…${s.slice(-4)}`;
  return s;
}
