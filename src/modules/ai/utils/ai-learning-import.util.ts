import { parseLearningCsv, type LearningMessageRow } from './ai-learning-csv.util';
import { parseWhatsAppArchive } from './ai-learning-archive.util';
import { cleanLearningRows } from './ai-learning-clean.util';

export type LearningImportFormat = 'csv' | 'whatsapp_archive';

const BRACKET_LINE = /^\[\d{1,2}\/\d{1,2}\/\d{2,4},/m;
const DASH_LINE = /^\d{1,2}\/\d{1,2}\/\d{2,4}, \d{1,2}:\d{2}/m;

const CSV_BODY_HEADERS = new Set([
  'messagebody',
  'message_body',
  'body',
  'text',
  'message',
  'content',
]);

function firstNonEmptyLine(text: string): string {
  return text.split(/\r?\n/).find(l => l.trim())?.trim() ?? '';
}

function looksLikeWhatsAppArchive(text: string): boolean {
  const sample = text.split(/\r?\n/).slice(0, 8).join('\n');
  return BRACKET_LINE.test(sample) || DASH_LINE.test(sample);
}

function looksLikeCsv(text: string): boolean {
  const header = firstNonEmptyLine(text).toLowerCase();
  if (!header.includes(',')) return false;
  const cols = header.split(',').map(c => c.trim().replace(/\s+/g, '_'));
  return cols.some(c => CSV_BODY_HEADERS.has(c));
}

export function detectLearningImportFormat(
  content: string,
  fileName?: string | null,
): LearningImportFormat {
  const ext = (fileName ?? '').toLowerCase();
  if (ext.endsWith('.txt')) return 'whatsapp_archive';
  if (ext.endsWith('.csv')) return 'csv';
  if (looksLikeWhatsAppArchive(content)) return 'whatsapp_archive';
  if (looksLikeCsv(content)) return 'csv';
  return 'whatsapp_archive';
}

export function parseLearningImport(
  content: string,
  fileName?: string | null,
): { format: LearningImportFormat; rows: LearningMessageRow[] } {
  const format = detectLearningImportFormat(content, fileName);
  const raw =
    format === 'csv' ? parseLearningCsv(content) : parseWhatsAppArchive(content);
  return { format, rows: cleanLearningRows(raw) };
}
