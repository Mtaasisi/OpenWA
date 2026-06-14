import { Injectable } from '@nestjs/common';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';

export interface KnowledgeAppendInput {
  targetFile: string;
  category: string | null;
  questionPattern: string;
  approvedAnswer: string;
  approvedBy: string | null;
  examples?: string[];
}

@Injectable()
export class AiLearningKnowledgeFileService {
  constructor(
    private readonly knowledge: AiKnowledgeService,
    private readonly index: AiKnowledgeIndexService,
  ) {}

  appendApprovedKnowledge(input: KnowledgeAppendInput): { path: string } {
    const path = this.resolvePath(input.targetFile);
    let content = '';
    try {
      content = this.knowledge.readFile(path).content;
    } catch {
      content = `# ${path.replace('.md', '')}\n\n`;
    }

    const date = new Date().toISOString().slice(0, 10);
    const section = [
      '',
      `### ${input.questionPattern.slice(0, 120)}`,
      `_Approved ${date}${input.approvedBy ? ` by ${input.approvedBy}` : ''}${input.category ? ` · ${input.category}` : ''}_`,
      '',
      `**Q:** ${input.questionPattern}`,
      '',
      `**A:** ${input.approvedAnswer}`,
      '',
      ...(input.examples?.length
        ? ['**Examples:**', ...input.examples.map(e => `- ${e}`), '']
        : []),
    ].join('\n');

    this.knowledge.writeFile(path, `${content.trim()}\n${section}`);
    void this.index.reindexAll().catch(() => undefined);
    return { path };
  }

  private resolvePath(targetFile: string): string {
    const t = targetFile.trim();
    if (t === 'FAQ_KNOWLEDGE.md') return 'FAQ.md';
    return t;
  }
}
