import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BadRequestException } from '@nestjs/common';
import { AiTrainingKnowledgeWriterService } from './ai-training-knowledge-writer.service';
import { toRuleId } from './utils/ai-training-sanitize.util';

describe('AiTrainingKnowledgeWriterService', () => {
  let tmpDir: string;
  let files: Map<string, string>;
  let writer: AiTrainingKnowledgeWriterService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openwa-knowledge-writer-'));
    fs.mkdirSync(path.join(tmpDir, 'backups'), { recursive: true });
    files = new Map([['FAQ.md', '# FAQ\n\n']]);

    const knowledge = {
      readFile: jest.fn((rel: string) => {
        const content = files.get(rel);
        if (content == null) throw new Error(`Missing ${rel}`);
        return { content };
      }),
      writeFile: jest.fn((rel: string, content: string) => {
        files.set(rel, content);
        const abs = path.join(tmpDir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
      }),
    };

    writer = new AiTrainingKnowledgeWriterService(knowledge as never, {
      get: jest.fn((key: string) => (key === 'ai.knowledgePath' ? tmpDir : undefined)),
    } as never);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes a structured section and creates a backup file', () => {
    const result = writer.writeApprovedKnowledge({
      targetFile: 'FAQ.md',
      question: 'Mko wapi?',
      approvedAnswer: 'Tupo Dar es Salaam Boss.',
      approvedBy: 'admin-1',
    });

    expect(result.skippedDuplicate).toBe(false);
    expect(result.backupPath).toMatch(/^backups\//);
    expect(fs.readdirSync(path.join(tmpDir, 'backups')).length).toBeGreaterThan(0);
    expect(result.newContent).toContain('Learned Rule');
    expect(result.newContent).toContain('Mko wapi?');
    expect(files.get('FAQ.md')).toContain('Learned Rule');
  });

  it('skips duplicate rule sections', () => {
    const ruleId = toRuleId('Mko wapi?');
    files.set('FAQ.md', `# FAQ\n\nAI_RULE_ID: ${ruleId}\nExisting rule\n`);

    const result = writer.writeApprovedKnowledge({
      targetFile: 'FAQ.md',
      question: 'Mko wapi?',
      approvedAnswer: 'Tupo Dar.',
      approvedBy: 'admin-1',
      ruleId,
    });

    expect(result.skippedDuplicate).toBe(true);
    expect(result.backupPath).toBeNull();
    expect(result.newContent).toBe(result.oldContent);
  });

  it('rejects answers with raw payment numbers', () => {
    expect(() =>
      writer.buildPreview({
        targetFile: 'FAQ.md',
        question: 'Namba ya malipo?',
        approvedAnswer: 'Paybill 123456 namba ya malipo',
        approvedBy: 'admin-1',
        maskPrivate: false,
      }),
    ).toThrow(BadRequestException);
  });

  it('masks private data in preview when enabled', () => {
    const preview = writer.buildPreview({
      targetFile: 'FAQ.md',
      question: 'Namba yako?',
      approvedAnswer: 'Email support@shop.com',
      approvedBy: 'admin-1',
      maskPrivate: true,
    });

    expect(preview.skippedDuplicate).toBe(false);
    expect(preview.newContent).toContain('[EMAIL]');
    expect(preview.newContent).not.toContain('support@shop.com');
  });
});
