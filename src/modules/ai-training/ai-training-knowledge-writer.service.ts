import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { AiKnowledgeService } from '../ai/ai-knowledge.service';
import { AiTrainingUpdateMode } from './ai-training.types';
import {
  buildStructuredRuleSection,
  containsRawPaymentNumber,
  maskPrivateData,
  sectionExists,
  toRuleId,
} from './utils/ai-training-sanitize.util';

export interface KnowledgeWriteInput {
  targetFile: string;
  question: string;
  approvedAnswer: string;
  approvedBy: string;
  ruleId?: string;
  updateMode?: AiTrainingUpdateMode;
  customInstruction?: string | null;
  triggers?: string[];
  maskPrivate?: boolean;
}

export interface KnowledgeWriteResult {
  path: string;
  backupPath: string | null;
  oldContent: string;
  newContent: string;
  skippedDuplicate: boolean;
}

@Injectable()
export class AiTrainingKnowledgeWriterService {
  private readonly backupDir: string;

  constructor(
    private readonly knowledge: AiKnowledgeService,
    private readonly configService: ConfigService,
  ) {
    const base = path.resolve(
      this.configService.get<string>('ai.knowledgePath') || './data/ai-knowledge',
    );
    this.backupDir = path.join(base, 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  writeApprovedKnowledge(input: KnowledgeWriteInput): KnowledgeWriteResult {
    const preview = this.buildPreview(input);
    if (preview.skippedDuplicate) {
      return {
        path: preview.relPath,
        backupPath: null,
        oldContent: preview.oldContent,
        newContent: preview.newContent,
        skippedDuplicate: true,
      };
    }

    const backupPath = this.backupFile(preview.relPath, preview.oldContent);
    this.knowledge.writeFile(preview.relPath, preview.newContent);
    return {
      path: preview.relPath,
      backupPath,
      oldContent: preview.oldContent,
      newContent: preview.newContent,
      skippedDuplicate: false,
    };
  }

  buildPreview(input: KnowledgeWriteInput): {
    relPath: string;
    oldContent: string;
    newContent: string;
    skippedDuplicate: boolean;
  } {
    const relPath = this.resolvePath(input.targetFile);
    let content = '';
    try {
      content = this.knowledge.readFile(relPath).content;
    } catch {
      content = `# ${relPath.replace('.md', '')}\n\n`;
    }

    const answer = input.maskPrivate !== false ? maskPrivateData(input.approvedAnswer) : input.approvedAnswer;
    if (containsRawPaymentNumber(answer)) {
      throw new BadRequestException(
        'Answer contains raw payment numbers. Use branch/payment DB tools and save instruction only.',
      );
    }

    const ruleId = input.ruleId ?? toRuleId(input.question);
    if (sectionExists(content, ruleId)) {
      return { relPath, oldContent: content, newContent: content, skippedDuplicate: true };
    }

    const section = buildStructuredRuleSection({
      ruleId,
      title: input.question.slice(0, 80),
      source: 'Inbox training',
      approvedBy: input.approvedBy,
      body: input.customInstruction
        ? `${input.customInstruction}\n\nApproved reply:\n${answer}`
        : `When customer asks: ${input.question}\n\nApproved reply:\n${answer}`,
      triggers: input.triggers,
      exampleQuestion: input.question,
      exampleAnswer: answer,
    });

    let newContent = content.trim();
    if (input.updateMode === AiTrainingUpdateMode.REPLACE_SECTION && input.ruleId) {
      newContent = this.replaceSectionByRuleId(newContent, ruleId, section);
    } else {
      newContent = `${newContent}${section}`;
    }

    return { relPath, oldContent: content, newContent, skippedDuplicate: false };
  }

  private backupFile(relPath: string, content: string): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = relPath.replace(/[/\\]/g, '_');
    const backupRel = path.join('backups', `${safeName}.${ts}.bak`);
    const backupAbs = path.join(
      path.resolve(this.configService.get<string>('ai.knowledgePath') || './data/ai-knowledge'),
      'backups',
      `${safeName}.${ts}.bak`,
    );
    fs.writeFileSync(backupAbs, content, 'utf8');
    return backupRel;
  }

  private replaceSectionByRuleId(content: string, ruleId: string, newSection: string): string {
    const marker = `AI_RULE_ID: ${ruleId}`;
    const idx = content.indexOf(marker);
    if (idx < 0) return `${content.trim()}${newSection}`;
    const before = content.slice(0, idx);
    const afterStart = content.indexOf('\n## Learned Rule:', idx + 1);
    const after = afterStart >= 0 ? content.slice(afterStart) : '';
    return `${before.trim()}${newSection}${after}`;
  }

  private resolvePath(targetFile: string): string {
    const t = targetFile.trim();
    if (t === 'FAQ_KNOWLEDGE.md') return 'FAQ.md';
    return t;
  }
}
