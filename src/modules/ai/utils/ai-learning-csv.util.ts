export interface LearningMessageRow {
  messageBody: string;
  direction?: string | null;
  sender?: string | null;
  timestamp?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

const BODY_KEYS = new Set(['messagebody', 'message_body', 'body', 'text', 'message', 'content']);
const DIRECTION_KEYS = new Set(['direction', 'type', 'msg_type']);
const SENDER_KEYS = new Set(['sender', 'from', 'author']);

function pickColumn(headers: string[], keys: Set<string>): number {
  return headers.findIndex(h => keys.has(normalizeHeader(h)));
}

export function parseLearningCsv(csv: string): LearningMessageRow[] {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const bodyIdx = pickColumn(headers, BODY_KEYS);
  const dirIdx = pickColumn(headers, DIRECTION_KEYS);
  const senderIdx = pickColumn(headers, SENDER_KEYS);
  const chatIdx = headers.findIndex(h => h === 'chatid' || h === 'chat_id');
  const sessionIdx = headers.findIndex(h => h === 'sessionid' || h === 'session_id');
  const tsIdx = headers.findIndex(h => h === 'timestamp' || h === 'date' || h === 'time');

  if (bodyIdx < 0) return [];

  const rows: LearningMessageRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const messageBody = cols[bodyIdx]?.trim();
    if (!messageBody) continue;
    rows.push({
      messageBody,
      direction: dirIdx >= 0 ? cols[dirIdx] ?? null : null,
      sender: senderIdx >= 0 ? cols[senderIdx] ?? null : null,
      timestamp: tsIdx >= 0 ? cols[tsIdx] ?? null : null,
      chatId: chatIdx >= 0 ? cols[chatIdx] ?? null : null,
      sessionId: sessionIdx >= 0 ? cols[sessionIdx] ?? null : null,
    });
  }
  return rows;
}

export function isCustomerMessage(row: LearningMessageRow): boolean {
  const dir = (row.direction ?? '').toLowerCase();
  if (dir === 'inbound' || dir === 'incoming' || dir === 'received') return true;
  if (dir === 'outbound' || dir === 'outgoing' || dir === 'sent') return false;
  const sender = (row.sender ?? '').toLowerCase();
  if (sender.includes('customer') || sender === 'them') return true;
  if (sender.includes('staff') || sender === 'me' || sender === 'you') return false;
  return true;
}
