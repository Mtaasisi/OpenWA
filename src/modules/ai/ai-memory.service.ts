import { Injectable, BadRequestException, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMemoryIndexService } from './ai-memory-index.service';
import { AI_RULES_VERSION } from './services/ai-human-timing.service';
import * as fs from 'fs';
import * as path from 'path';
import {
  chunkMarkdownFile,
  extractSearchKeywords,
  scoreChunkText,
} from './utils/ai-markdown-chunk.util';

const SAFE_PATH = /^[a-zA-Z0-9._/-]+$/;
const MAX_FILE_BYTES = 512_000;
const MAX_PROMPT_CHARS = 4_000;
const MEMORY_DOC = 'MEMORY.md';
const RECALLS_FILE = '.recalls.json';

const VERSION_MARKER_PREFIX = 'AI_RULES_VERSION:';

/** Staff memory seeded from seed/ai-memory on boot. */
export const BUNDLED_MEMORY_FILES = [MEMORY_DOC] as const;

export interface MemorySearchHit {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  score: number;
}

interface RecallEntry {
  path: string;
  startLine: number;
  endLine: number;
  text: string;
  count: number;
  lastAt: string;
}

@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name);
  private readonly basePath: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AiMemoryIndexService))
    private readonly memoryIndex: AiMemoryIndexService,
  ) {
    const configured = this.configService.get<string>('ai.memoryPath');
    this.basePath = path.resolve(configured || './data/ai-memory');
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
    this.seedMissingMemoryFiles();
  }

  /** Copy bundled staff memory from seed/ai-memory (version-synced like knowledge). */
  private seedMissingMemoryFiles(): void {
    const seedDir = path.resolve(process.cwd(), 'seed/ai-memory');
    const memoryPath = path.join(this.basePath, MEMORY_DOC);

    if (!fs.existsSync(seedDir)) {
      if (!fs.existsSync(memoryPath)) {
        fs.writeFileSync(
          memoryPath,
          `# Long-term memory\n\nFacts the AI should remember across staff chats and sessions.\nThe assistant can append here via the memory_write tool.\n`,
          'utf8',
        );
      }
      return;
    }

    for (const name of fs.readdirSync(seedDir)) {
      if (!name.endsWith('.md') && !name.endsWith('.txt')) continue;
      const src = path.join(seedDir, name);
      const dest = path.join(this.basePath, name);
      const isBundled = (BUNDLED_MEMORY_FILES as readonly string[]).includes(name);

      if (isBundled) {
        const seedContent = this.ensureVersionMarker(fs.readFileSync(src, 'utf8'));
        const destContent = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
        if (destContent === seedContent) continue;

        if (destContent !== null) {
          const destVersion = this.extractRulesVersion(destContent);
          const seedVersion = this.extractRulesVersion(seedContent);
          const userEdited = destVersion === null && destContent.trim().length > 200;
          if (userEdited) {
            this.logger.debug(`Skipping bundled memory overwrite for user-edited file: ${name}`);
            continue;
          }
          if (destVersion && seedVersion && destVersion === seedVersion) continue;
          const backupPath = `${dest}.bak-${Date.now()}`;
          fs.copyFileSync(dest, backupPath);
          this.logger.log(`Backed up memory file before update: ${backupPath}`);
        }

        fs.writeFileSync(dest, seedContent, 'utf8');
        this.logger.log(
          destContent === null ? `Seeded memory file: ${name}` : `Updated bundled memory: ${name}`,
        );
        void this.memoryIndex.reindexPath(name).catch(() => undefined);
        continue;
      }

      if (fs.existsSync(dest)) continue;
      fs.copyFileSync(src, dest);
      this.logger.log(`Seeded memory file: ${name}`);
      void this.memoryIndex.reindexPath(name).catch(() => undefined);
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

  readFile(relativePath: string, fromLine?: number, lineCount?: number): string {
    const filePath = this.resolvePath(relativePath);
    if (!fs.existsSync(filePath)) throw new NotFoundException('Memory file not found');
    const content = fs.readFileSync(filePath, 'utf8');
    if (fromLine === undefined) return content;
    const lines = content.split('\n');
    const start = Math.max(1, fromLine) - 1;
    const end = lineCount ? start + lineCount : lines.length;
    return lines.slice(start, end).join('\n');
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
    void this.memoryIndex.reindexPath(relativePath).catch(err => {
      this.logger.warn(`Memory reindex failed for ${relativePath}: ${err instanceof Error ? err.message : String(err)}`);
    });
    return { path: relativePath, size: Buffer.byteLength(content, 'utf8') };
  }

  appendToMemoryDoc(fact: string): void {
    const line = fact.trim();
    if (!line) return;
    const filePath = path.join(this.basePath, MEMORY_DOC);
    const stamp = new Date().toISOString().slice(0, 10);
    const entry = `- (${stamp}) ${line}\n`;
    fs.appendFileSync(filePath, entry, 'utf8');
    void this.memoryIndex.reindexPath(MEMORY_DOC).catch(() => undefined);
  }

  async search(query: string, limit = 8): Promise<MemorySearchHit[]> {
    try {
      const hybrid = await this.memoryIndex.hybridSearch(query, limit);
      if (hybrid?.length) {
        for (const hit of hybrid) this.recordRecall(hit);
        return hybrid;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Hybrid memory search failed, using keyword fallback: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return this.searchKeywordFiles(query, limit);
  }

  /** Text block injected into AI system prompts (long-term facts). */
  buildPromptExcerpt(maxChars = MAX_PROMPT_CHARS): string {
    const files = this.listFiles();
    if (!files.length) return '';

    const parts: string[] = ['=== Long-term memory ==='];
    let used = parts[0].length;

    const priority = [MEMORY_DOC, ...files.map(f => f.path).filter(p => p !== MEMORY_DOC)];
    const ordered = [...new Set(priority)];

    for (const rel of ordered) {
      try {
        const content = this.readFile(rel);
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
      const hits = await this.search(q, 6);
      if (!hits.length) return this.buildPromptExcerpt(maxChars);

      const parts: string[] = ['=== Long-term memory (relevant to this message) ==='];
      let used = parts[0].length;
      for (const h of hits) {
        const snippet = h.text.replace(/\s+/g, ' ').trim().slice(0, 600);
        const chunk = `[${h.path}:${h.startLine}-${h.endLine}] ${snippet}`;
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

  private searchKeywordFiles(query: string, limit = 8): MemorySearchHit[] {
    const keywords = extractSearchKeywords(query);
    if (!keywords.length) return [];

    const scored: MemorySearchHit[] = [];
    for (const file of this.listFiles()) {
      let content: string;
      try {
        content = this.readFile(file.path);
      } catch {
        continue;
      }
      const chunks = chunkMarkdownFile(file.path, content);
      for (const chunk of chunks) {
        const score = scoreChunkText(chunk.text, keywords);
        if (score <= 0) continue;
        scored.push({
          path: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          text: chunk.text,
          score,
        });
      }
    }

    const hits = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, 20));

    for (const hit of hits) {
      this.recordRecall(hit);
    }
    return hits;
  }

  /** Promote frequently recalled chunks into MEMORY.md (dreaming). */
  runDreaming(minRecalls = 3, maxPromotions = 5): { promoted: number; entries: string[] } {
    const recalls = this.loadRecalls();
    const candidates = Object.values(recalls)
      .filter(r => r.count >= minRecalls && r.path !== MEMORY_DOC)
      .sort((a, b) => b.count - a.count)
      .slice(0, maxPromotions);

    const memoryContent = fs.existsSync(path.join(this.basePath, MEMORY_DOC))
      ? fs.readFileSync(path.join(this.basePath, MEMORY_DOC), 'utf8')
      : '';

    const promoted: string[] = [];
    for (const c of candidates) {
      const snippet = c.text.replace(/\s+/g, ' ').trim().slice(0, 400);
      if (!snippet || memoryContent.includes(snippet.slice(0, 80))) continue;
      this.appendToMemoryDoc(`[dream] ${snippet}`);
      promoted.push(`${c.path}:${c.startLine}-${c.endLine}`);
    }

    if (promoted.length) {
      void this.memoryIndex.reindexPath(MEMORY_DOC).catch(() => undefined);
      this.logger.log(`Memory dreaming promoted ${promoted.length} snippet(s)`);
    }
    return { promoted: promoted.length, entries: promoted };
  }

  private recordRecall(hit: MemorySearchHit): void {
    const recalls = this.loadRecalls();
    const key = `${hit.path}:${hit.startLine}:${hit.endLine}`;
    const existing = recalls[key];
    recalls[key] = {
      path: hit.path,
      startLine: hit.startLine,
      endLine: hit.endLine,
      text: hit.text,
      count: (existing?.count ?? 0) + 1,
      lastAt: new Date().toISOString(),
    };
    this.saveRecalls(recalls);
  }

  private loadRecalls(): Record<string, RecallEntry> {
    const p = path.join(this.basePath, RECALLS_FILE);
    if (!fs.existsSync(p)) return {};
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')) as Record<string, RecallEntry>;
    } catch {
      return {};
    }
  }

  private saveRecalls(data: Record<string, RecallEntry>): void {
    const p = path.join(this.basePath, RECALLS_FILE);
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
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
