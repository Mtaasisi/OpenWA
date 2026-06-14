import type { LearningMessageRow } from './ai-learning-csv.util';
import { isCustomerMessage } from './ai-learning-csv.util';

const SYSTEM_PATTERNS = [
  /end-to-end encrypted/i,
  /changed the subject/i,
  /changed this group's icon/i,
  /created group/i,
  /joined using this group's invite link/i,
  /left$/i,
  /removed /i,
  /added /i,
  /message was deleted/i,
  /waiting for this message/i,
  /missed voice call/i,
  /missed video call/i,
];

const MEDIA_PATTERNS = [
  /^<media omitted>$/i,
  /^image omitted$/i,
  /^video omitted$/i,
  /^audio omitted$/i,
  /^sticker omitted$/i,
  /^document omitted$/i,
  /^gif omitted$/i,
  /\(file attached\)$/i,
];

const AUTO_ALERT_PATTERNS = [
  /^[A-Z0-9]{6,12} confirmed\./i,
  /^you have received/i,
  /^payment of (?:kes|tzs|usd)/i,
  /^mpesa$/i,
];

export function isLearningNoiseMessage(row: LearningMessageRow): boolean {
  const body = row.messageBody.trim();
  if (!body) return true;
  if (body.length < 2) return true;

  for (const re of SYSTEM_PATTERNS) {
    if (re.test(body)) return true;
  }
  for (const re of MEDIA_PATTERNS) {
    if (re.test(body)) return true;
  }
  for (const re of AUTO_ALERT_PATTERNS) {
    if (re.test(body)) return true;
  }

  return false;
}

export function cleanLearningRows(rows: LearningMessageRow[]): LearningMessageRow[] {
  return rows.filter(row => !isLearningNoiseMessage(row));
}

export function filterCustomerLearningRows(rows: LearningMessageRow[]): LearningMessageRow[] {
  return cleanLearningRows(rows).filter(isCustomerMessage);
}
