import type { LearningMessageRow } from './ai-learning-csv.util';

/** Android / desktop: [dd/mm/yyyy, hh:mm:ss] Sender: message */
const BRACKET_LINE =
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}), (\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\] ([^:]+): (.*)$/i;

/** iOS / some exports: dd/mm/yyyy, hh:mm - Sender: message */
const DASH_LINE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}), (\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?) - ([^:]+): (.*)$/i;

const OUTBOUND_SENDERS = new Set(['you', 'me']);

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, '');
}

function directionForSender(sender: string): string {
  return OUTBOUND_SENDERS.has(sender.trim().toLowerCase()) ? 'outbound' : 'inbound';
}

function parseArchiveLine(line: string): {
  timestamp: string;
  sender: string;
  messageBody: string;
} | null {
  const bracket = line.match(BRACKET_LINE);
  if (bracket) {
    return {
      timestamp: `${bracket[1]} ${bracket[2]}`,
      sender: bracket[3].trim(),
      messageBody: bracket[4].trim(),
    };
  }
  const dash = line.match(DASH_LINE);
  if (dash) {
    return {
      timestamp: `${dash[1]} ${dash[2]}`,
      sender: dash[3].trim(),
      messageBody: dash[4].trim(),
    };
  }
  return null;
}

/** Parse a WhatsApp chat export (.txt) into normalized learning rows. */
export function parseWhatsAppArchive(text: string): LearningMessageRow[] {
  const lines = stripBom(text).split(/\r?\n/);
  const rows: LearningMessageRow[] = [];
  let current: LearningMessageRow | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;

    const parsed = parseArchiveLine(line);
    if (parsed) {
      if (current) rows.push(current);
      current = {
        messageBody: parsed.messageBody,
        sender: parsed.sender,
        direction: directionForSender(parsed.sender),
        timestamp: parsed.timestamp,
        chatId: null,
        sessionId: null,
      };
      continue;
    }

    if (current) {
      current.messageBody = `${current.messageBody}\n${line.trim()}`;
    }
  }

  if (current) rows.push(current);
  return rows;
}
