import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiLearningImport } from './entities/ai-learning-import.entity';
import type { LearningMessageRow } from './utils/ai-learning-csv.util';
import { analyzeLearningMessages } from './utils/ai-learning-analyze.util';
import { parseLearningImport } from './utils/ai-learning-import.util';
import { cleanLearningRows } from './utils/ai-learning-clean.util';
import { AiKnowledgeService } from './ai-knowledge.service';
import { pickReplySamplesForPrompt } from './utils/ai-learning-reply-samples.util';

@Injectable()
export class AiLearningService {
  constructor(
    @InjectRepository(AiLearningImport, 'data')
    private readonly importRepo: Repository<AiLearningImport>,
    private readonly knowledge: AiKnowledgeService,
  ) {}

  listImports(): Promise<AiLearningImport[]> {
    return this.importRepo.find({ order: { createdAt: 'DESC' }, take: 25 });
  }

  async buildReplySamplesPromptBlock(incomingText: string): Promise<string> {
    const imports = await this.importRepo.find({
      where: { status: 'complete' },
      order: { createdAt: 'DESC' },
      take: 3,
    });

    const samples = imports.flatMap(imp => imp.replySamples ?? []);
    if (!samples.length) return '';

    return pickReplySamplesForPrompt(incomingText, samples);
  }

  async getImport(id: string): Promise<AiLearningImport> {
    const row = await this.importRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Learning import not found');
    return row;
  }

  async importMessages(input: {
    sourceName: string;
    messages?: LearningMessageRow[];
    csv?: string;
    archive?: string;
    fileName?: string | null;
  }): Promise<AiLearningImport> {
    let rows: LearningMessageRow[] = [];
    let importFormat: string | null = null;

    if (input.messages?.length) {
      rows = cleanLearningRows(input.messages);
      importFormat = 'messages';
    } else if (input.archive?.trim()) {
      const parsed = parseLearningImport(input.archive, input.fileName);
      rows = parsed.rows;
      importFormat = parsed.format;
    } else if (input.csv?.trim()) {
      const parsed = parseLearningImport(input.csv, input.fileName ?? 'import.csv');
      rows = parsed.rows;
      importFormat = parsed.format;
    }

    const record = this.importRepo.create({
      sourceName: input.sourceName.trim() || 'import',
      status: 'processing',
      totalRows: rows.length,
      importFormat,
    });
    await this.importRepo.save(record);

    try {
      if (!rows.length) {
        throw new BadRequestException('No messages found in import file');
      }

      const analysis = analyzeLearningMessages(rows);

      record.status = 'complete';
      record.importedRows = analysis.customerRows;
      record.questionCount = analysis.topQuestions.length;
      record.topQuestions = analysis.topQuestions;
      record.intentBreakdown = analysis.intentBreakdown;
      record.replySamples = analysis.replySamples;
      record.errorMessage = null;
    } catch (err: unknown) {
      record.status = 'failed';
      record.errorMessage = err instanceof Error ? err.message : String(err);
    }

    return this.importRepo.save(record);
  }

  async promoteTopQuestionsToFaq(importId: string): Promise<{ path: string; added: number }> {
    const record = await this.getImport(importId);
    const questions = record.topQuestions ?? [];
    if (!questions.length) {
      throw new BadRequestException('Import has no question patterns to promote');
    }

    const path = 'FAQ.md';
    let content = '';
    try {
      content = this.knowledge.readFile(path).content;
    } catch {
      content = '# FAQ\n\nCustomer frequently asked questions.\n';
    }

    const section = [
      '',
      `## Learned from ${record.sourceName}`,
      `_Imported ${new Date().toISOString().slice(0, 10)}_`,
      '',
      ...questions.slice(0, 15).map(q => {
        const intent = 'intent' in q && q.intent ? ` [${q.intent}]` : '';
        return `- ${q.text}${intent} _(×${q.count})_`;
      }),
      '',
    ].join('\n');

    this.knowledge.writeFile(path, `${content.trim()}\n${section}`);
    return { path, added: Math.min(questions.length, 15) };
  }

  async promoteReplySamplesToExamples(importId: string): Promise<{ path: string; added: number }> {
    const record = await this.getImport(importId);
    const samples = record.replySamples ?? [];
    if (!samples.length) {
      throw new BadRequestException('Import has no reply samples to promote');
    }

    const path = 'AI_REPLY_EXAMPLES.md';
    let content = '';
    try {
      content = this.knowledge.readFile(path).content;
    } catch {
      content = '# AI Reply Examples — Inauzwa\n\nGood and bad examples for training tone and behavior.\n';
    }

    const slice = samples.slice(0, 15);
    const section = [
      '',
      `## Learned from ${record.sourceName}`,
      `_Imported ${new Date().toISOString().slice(0, 10)}_`,
      '',
      ...slice.flatMap(sample => [
        `### ${sample.intent.replace(/_/g, ' ')}`,
        'Customer:',
        '```text',
        sample.customer,
        '```',
        'Staff:',
        '```text',
        sample.staff,
        '```',
        '',
      ]),
    ].join('\n');

    this.knowledge.writeFile(path, `${content.trim()}\n${section}`);
    return { path, added: slice.length };
  }
}
