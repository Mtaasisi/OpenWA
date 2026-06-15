/** Human-readable line appended to CRM notes when AI hands a chat to staff. */
export function formatAiEscalationNote(reason: string, at = new Date()): string {
  const when = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
  return `AI escalated · ${when} · ${reason.trim()}`;
}
