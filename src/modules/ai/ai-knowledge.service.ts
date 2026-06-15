import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';
import { AI_RULES_VERSION } from './services/ai-human-timing.service';
import * as fs from 'fs';
import * as path from 'path';

const SAFE_PATH = /^[a-zA-Z0-9._/-]+$/;
const MAX_FILE_BYTES = 512_000;
const MAX_PROMPT_CHARS = 9_000;

/** Knowledge files excluded from auto-reply RAG (rules injected via intent packs instead). */
export const EXCLUDED_FROM_AUTO_REPLY_RAG = [
  'AI_REPLY_RULES.md',
  'AI_REPLY_EXAMPLES.md',
  'AGENT_ACTION_RULES.md',
  'README_AI_TRAINING_SETUP.md',
] as const;

export interface AutoReplyKnowledgeLimits {
  maxChunks?: number;
  maxCharsPerChunk?: number;
  maxTotalChars?: number;
}

const VERSION_MARKER_PREFIX = 'AI_RULES_VERSION:';

/** Inauzwa default training — version-synced from seed/ai-knowledge on boot. */
export const BUNDLED_KNOWLEDGE_FILES = [
  'AGENT_ACTION_RULES.md',
  'AI_REPLY_RULES.md',
  'AI_REPLY_EXAMPLES.md',
  'SHOP.md',
  'FAQ.md',
  'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
  'PAYMENT_RULES.md',
  'DELIVERY_RULES.md',
  'WARRANTY_RULES.md',
  'INSTALLMENT_PRODUCT_RULES.md',
  'DISCOUNT_ESCALATION_RULES.md',
  'POLICIES.md',
  'PRODUCT_QA.md',
  'FAQ_KNOWLEDGE.md',
  'README_AI_TRAINING_SETUP.md',
] as const;

@Injectable()
export class AiKnowledgeService {
  private readonly logger = new Logger(AiKnowledgeService.name);
  private readonly basePath: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AiKnowledgeIndexService))
    private readonly knowledgeIndex: AiKnowledgeIndexService,
  ) {
    const configured = this.configService.get<string>('ai.knowledgePath');
    this.basePath = path.resolve(configured || './data/ai-knowledge');
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    this.seedMissingKnowledgeFiles();
  }

  /** Copy seed markdown into data/ai-knowledge (bundled Inauzwa training syncs on version bump). */
  private seedMissingKnowledgeFiles(): void {
    const seedDir = path.resolve(process.cwd(), 'seed/ai-knowledge');
    if (!fs.existsSync(seedDir)) {
      const shopPath = path.join(this.basePath, 'SHOP.md');
      if (!fs.existsSync(shopPath)) {
        fs.writeFileSync(
          shopPath,
          `# Shop knowledge

Add your business policies, product notes, warranty rules, and FAQs here.
The AI inbox agent reads this file when replying to customers.
`,
          'utf8',
        );
      }
      return;
    }

    for (const name of fs.readdirSync(seedDir)) {
      if (!name.endsWith('.md') && !name.endsWith('.txt')) continue;
      const src = path.join(seedDir, name);
      const dest = path.join(this.basePath, name);
      const isBundled = (BUNDLED_KNOWLEDGE_FILES as readonly string[]).includes(name);

      if (isBundled) {
        const seedContent = this.ensureVersionMarker(fs.readFileSync(src, 'utf8'));
        const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
        if (destContent === seedContent) continue;

        if (destContent !== null) {
          const destVersion = this.extractRulesVersion(destContent);
          const seedVersion = this.extractRulesVersion(seedContent);
          if (destVersion && seedVersion && destVersion === seedVersion) continue;

          const legacyBundledWithoutVersion = destVersion === null && seedVersion !== null;
          if (!legacyBundledWithoutVersion) {
            const userEdited = destVersion === null && destContent.trim().length > 200;
            if (userEdited) {
              this.logger.debug(`Skipping bundled overwrite for user-edited file: ${name}`);
              continue;
            }
          } else {
            this.logger.log(`Migrating legacy bundled knowledge file: ${name}`);
          }

          const backupPath = `${dest}.bak-${Date.now()}`;
          fs.copyFileSync(dest, backupPath);
          this.logger.log(`Backed up knowledge file before update: ${backupPath}`);
        }

        fs.writeFileSync(dest, seedContent, 'utf8');
        this.logger.log(
          destContent === null ? `Seeded knowledge file: ${name}` : `Updated bundled knowledge: ${name}`,
        );
        continue;
      }

      if (fs.existsSync(dest)) continue;
      fs.copyFileSync(src, dest);
      this.logger.log(`Seeded knowledge file: ${name}`);
    }
  }

  listFiles(): { path: string; size: number; updatedAt: string }[] {
    const out: { path: string; size: number; updatedAt: string }[] = [];
    const walk = (dir: string, prefix: string) => {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith('.')) continue;
        const full = path.join(dir, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, rel);
        else if (name.endsWith('.md') || name.endsWith('.txt')) {
          out.push({
            path: rel.replace(/\\/g, '/'),
            size: stat.size,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    };
    walk(this.basePath, '');
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }

  readFile(relativePath: string): { path: string; content: string } {
    const filePath = this.resolvePath(relativePath);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Knowledge file not found');
    const content = fs.readFileSync(filePath, 'utf8');
    return { path: relativePath.replace(/\\/g, '/'), content };
  }

  writeFile(relativePath: string, content: string): { path: string; size: number } {
    if (!relativePath.endsWith('.md') && !relativePath.endsWith('.txt')) {
      throw new BadRequestException('Only .md and .txt files are allowed');
    }
    if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) {
      throw new BadRequestException('File too large (max 512KB)');
    }
    const filePath = this.resolvePath(relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
    void this.knowledgeIndex.reindexPath(relativePath).catch(err => {
      this.logger.warn(`Knowledge reindex failed for ${relativePath}: ${err instanceof Error ? err.message : String(err)}`);
    });
    return { path: relativePath, size: Buffer.byteLength(content, 'utf8') };
  }

  /** Append a markdown section to an existing knowledge file (staff assistant / training flows). */
  appendSection(relativePath: string, sectionMarkdown: string): { path: string; size: number } {
    const section = sectionMarkdown.trim();
    if (!section) {
      throw new BadRequestException('sectionMarkdown is required');
    }
    let base = '';
    try {
      base = this.readFile(relativePath).content;
    } catch {
      base = `# ${relativePath.replace(/\.md$/i, '').replace(/_/g, ' ')}\n`;
    }
    const merged = `${base.trimEnd()}\n\n${section}\n`;
    return this.writeFile(relativePath, merged);
  }

  async search(query: string, limit = 10): Promise<{ path: string; snippet: string }[]> {
    try {
      const hybrid = await this.knowledgeIndex.hybridSearch(query, limit);
      if (hybrid?.length) {
        return hybrid.map(h => ({
          path: h.path,
          snippet:
            h.text.length > 220 ? `${h.text.slice(0, 220).replace(/\s+/g, ' ').trim()}…` : h.text,
        }));
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Hybrid knowledge search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return this.searchKeywordFiles(query, limit);
  }

  private searchKeywordFiles(query: string, limit = 10): { path: string; snippet: string }[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: { path: string; snippet: string; score: number }[] = [];
    for (const file of this.listFiles()) {
      const { content } = this.readFile(file.path);
      const lower = content.toLowerCase();
      const idx = lower.indexOf(q);
      if (idx < 0) continue;
      const start = Math.max(0, idx - 80);
      const end = Math.min(content.length, idx + q.length + 120);
      const snippet =
        (start > 0 ? '…' : '') + content.slice(start, end).replace(/\s+/g, ' ').trim() + (end < content.length ? '…' : '');
      results.push({ path: file.path, snippet, score: 1 / (1 + idx) });
    }
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, 25))
      .map(({ path, snippet }) => ({ path, snippet }));
  }

  /** Text block injected into AI system prompts (shop policies, FAQs). */
  buildPromptExcerpt(maxChars = MAX_PROMPT_CHARS): string {
    const files = this.listFiles();
    if (!files.length) return '';

    const parts: string[] = ['=== Shop knowledge base ==='];
    let used = parts[0].length;

    const priority = [
      'AI_REPLY_RULES.md',
      'AI_REPLY_EXAMPLES.md',
      'SHOP.md',
      'FAQ.md',
      'BRANCH_PROFILE_AND_PAYMENT_SETTINGS.md',
      'PAYMENT_RULES.md',
      'DELIVERY_RULES.md',
      'WARRANTY_RULES.md',
      'INSTALLMENT_PRODUCT_RULES.md',
      'DISCOUNT_ESCALATION_RULES.md',
      'POLICIES.md',
      'PRODUCT_QA.md',
      'FAQ_KNOWLEDGE.md',
    ];
    const ordered = [
      ...priority.filter(p => files.some(f => f.path === p)),
      ...files.map(f => f.path).filter(p => !priority.includes(p)),
    ];

    for (const rel of ordered) {
      try {
        const { content } = this.readFile(rel);
        const chunk = `--- ${rel} ---\n${content.trim()}`;
        if (used + chunk.length + 2 > maxChars) {
          parts.push(`--- ${rel} ---\n${content.trim().slice(0, maxChars - used - 20)}…`);
          break;
        }
        parts.push(chunk);
        used += chunk.length + 2;
      } catch {
        /* skip */
      }
    }

    return parts.join('\n\n');
  }

  /** Prefer semantic/keyword hits for the current message; fall back to static excerpt. */
  async buildContextualPromptExcerpt(contextQuery: string, maxChars = MAX_PROMPT_CHARS): Promise<string> {
    const q = contextQuery.trim();
    if (!q) return this.buildPromptExcerpt(maxChars);

    try {
      const hits = await this.search(q, 8);
      if (!hits.length) return this.buildPromptExcerpt(maxChars);

      const parts: string[] = ['=== Shop knowledge (relevant to this message) ==='];
      let used = parts[0].length;
      for (const h of hits) {
        const chunk = `[${h.path}] ${h.snippet}`;
        if (used + chunk.length + 2 > maxChars) break;
        parts.push(chunk);
        used += chunk.length + 2;
      }
      if (parts.length > 1) return parts.join('\n\n');
    } catch {
      /* fall through */
    }
    return this.buildPromptExcerpt(maxChars);
  }

  /**
   * Capped knowledge excerpt for auto-reply — excludes rule/example files and limits chunk count/size.
   */
  async buildAutoReplyKnowledgeExcerpt(
    contextQuery: string,
    limits: AutoReplyKnowledgeLimits = {},
  ): Promise<string> {
    const maxChunks = limits.maxChunks ?? 2;
    const maxCharsPerChunk = limits.maxCharsPerChunk ?? 600;
    const maxTotalChars = limits.maxTotalChars ?? 1200;

    const q = contextQuery.trim();
    if (!q) return '';

    try {
      const hits = await this.search(q, maxChunks + 2);
      const filtered = hits.filter(
        h => !(EXCLUDED_FROM_AUTO_REPLY_RAG as readonly string[]).includes(h.path),
      );

      if (!filtered.length) return '';

      const parts: string[] = ['=== Shop knowledge (relevant to this message) ==='];
      let used = parts[0].length;
      let chunks = 0;

      for (const h of filtered) {
        if (chunks >= maxChunks) break;
        const snippet = h.snippet.slice(0, maxCharsPerChunk);
        const chunk = `[${h.path}] ${snippet}`;
        if (used + chunk.length + 2 > maxTotalChars) {
          const remaining = maxTotalChars - used - 2;
          if (remaining > 40) {
            parts.push(`${chunk.slice(0, remaining)}…`);
          }
          break;
        }
        parts.push(chunk);
        used += chunk.length + 2;
        chunks += 1;
      }

      return parts.length > 1 ? parts.join('\n\n') : '';
    } catch {
      return '';
    }
  }

  private ensureVersionMarker(content: string): string {
    if (content.includes(VERSION_MARKER_PREFIX)) return content;
    return `${content.trim()}\n\n---\n${VERSION_MARKER_PREFIX} ${AI_RULES_VERSION}\n`;
  }

  private extractRulesVersion(content: string): string | null {
    const match = content.match(/AI_RULES_VERSION:\s*(\S+)/);
    return match?.[1] ?? null;
  }

  private resolvePath(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!SAFE_PATH.test(normalized) || normalized.includes('..')) {
      throw new BadRequestException('Invalid file path');
    }
    const resolved = path.resolve(this.basePath, normalized);
    if (!resolved.startsWith(this.basePath)) {
      throw new BadRequestException('Invalid file path');
    }
    return resolved;
  }
}
