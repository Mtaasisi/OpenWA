import { parseWhatsAppArchive } from './ai-learning-archive.util';
import { parseLearningImport } from './ai-learning-import.util';
import { analyzeLearningMessages } from './ai-learning-analyze.util';
import { parseLearningCsv } from './ai-learning-csv.util';

const SAMPLE_ARCHIVE = `[09/06/2025, 10:15:30] Customer A: Mambo
[09/06/2025, 10:16:01] You: Mambo vipi Boss 😊 Karibu Inauzwa.
[09/06/2025, 10:17:12] Customer A: Bei ya iPhone 14?
[09/06/2025, 10:18:00] You: iPhone 14 ni TZS 1,200,000 boss.
[09/06/2025, 10:19:44] Customer A: <Media omitted>
[09/06/2025, 10:20:01] Customer A: Mnatoa warranty?
[09/06/2025, 10:21:10] You: Ndiyo boss, warranty ipo.`;

describe('parseWhatsAppArchive', () => {
  it('parses bracket-format lines and multiline continuations', () => {
    const archive = `[01/01/2025, 09:00:00] Jane: Habari
line two
[01/01/2025, 09:01:00] You: Karibu`;
    const rows = parseWhatsAppArchive(archive);
    expect(rows).toHaveLength(2);
    expect(rows[0].messageBody).toBe('Habari\nline two');
    expect(rows[0].direction).toBe('inbound');
    expect(rows[1].direction).toBe('outbound');
  });
});

describe('parseLearningImport', () => {
  it('detects whatsapp archive from txt extension', () => {
    const { format, rows } = parseLearningImport(SAMPLE_ARCHIVE, 'chat.txt');
    expect(format).toBe('whatsapp_archive');
    expect(rows.length).toBeGreaterThan(4);
    expect(rows.some(r => r.messageBody.includes('Media omitted'))).toBe(false);
  });

  it('detects csv from header', () => {
    const csv = 'messageBody,direction\nHabari,inbound\nKaribu,outbound';
    const { format, rows } = parseLearningImport(csv, 'export.csv');
    expect(format).toBe('csv');
    expect(rows).toHaveLength(2);
  });
});

describe('analyzeLearningMessages', () => {
  it('extracts intents, questions, and staff reply samples', () => {
    const { rows } = parseLearningImport(SAMPLE_ARCHIVE, 'chat.txt');
    const analysis = analyzeLearningMessages(rows);
    expect(analysis.customerRows).toBeGreaterThan(0);
    expect(analysis.topQuestions.length).toBeGreaterThan(0);
    expect(Object.keys(analysis.intentBreakdown).length).toBeGreaterThan(0);
    expect(analysis.replySamples.length).toBeGreaterThan(0);
    expect(analysis.replySamples[0].staff.length).toBeGreaterThan(2);
  });

  it('works with structured csv rows', () => {
    const csv = `messageBody,direction
Mambo,inbound
Bei gani?,inbound
TZS 500000,outbound`;
    const rows = parseLearningCsv(csv);
    const analysis = analyzeLearningMessages(rows);
    expect(analysis.topQuestions.some(q => /bei/i.test(q.text))).toBe(true);
  });
});
