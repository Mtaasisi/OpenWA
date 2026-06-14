import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AiMemoryFile } from './entities/ai-memory-file.entity';
import { AiMemoryChunk } from './entities/ai-memory-chunk.entity';
import { AiEmbeddingService } from './ai-embedding.service';
import { AiUsageFeature } from './cost/ai-cost.types';
import type { MemorySearchHit } from './ai-memory.service';
import {
  chunkMarkdownFile,
  extractSearchKeywords,
  scoreChunkText,
} from './utils/ai-markdown-chunk.util';
import { cosineSimilarity, toPgVectorLiteral } from './utils/ai-embedding.util';
import * as fs from 'fs';
import * as path from 'path';

const VECTOR_WEIGHT = 0.7;
const KEYWORD_WEIGHT = 0.3;

@Injectable()
export class AiMemoryIndexService implements OnModuleInit {
  private readonly logger = new Logger(AiMemoryIndexService.name);
  private vectorSearchReady: boolean | null = null;
  private readonly basePath: string;

  constructor(
    @InjectRepository(AiMemoryFile, 'data')
    private readonly fileRepo: Repository<AiMemoryFile>,
    @InjectRepository(AiMemoryChunk, 'data')
    private readonly chunkRepo: Repository<AiMemoryChunk>,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    private readonly embeddingService: AiEmbeddingService,
    private readonly configService: ConfigService,
  ) {
    this.basePath = path.resolve(
      this.configService.get<string>('ai.memoryPath') || './data/ai-memory',
    );
  }

  onModuleInit(): void {
    const autoIndex = this.configService.get<boolean>('ai.memoryAutoIndexOnBoot', true);
    if (!autoIndex) return;
    void this.reindexAll().catch(err => {
      this.logger.warn(`Memory auto-index skipped: ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  async getIndexedChunkCount(): Promise<number> {
    return this.chunkRepo.count();
  }

  async getIndexStatus(): Promise<{
    chunks: number;
    vectorSearch: boolean;
    database: string;
  }> {
    const chunks = await this.chunkRepo.count();
    const vectorSearch =
      this.dataSource.options.type === 'postgres' && (await this.pgVectorAvailable());
    return {
      chunks,
      vectorSearch,
      database: String(this.dataSource.options.type),
    };
  }

  async reindexAll(): Promise<{ files: number; chunks: number }> {
    const paths = this.listMemoryFilePaths();
    let chunks = 0;
    for (const rel of paths) {
      chunks += await this.reindexPath(rel);
    }
    this.logger.log(`Memory index: ${paths.length} file(s), ${chunks} chunk(s)`);
    return { files: paths.length, chunks };
  }

  async reindexPath(relativePath: string): Promise<number> {
    const content = this.readFileContent(relativePath);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    let file = await this.fileRepo.findOne({ where: { path: relativePath } });
    if (file?.contentHash === contentHash) {
      return this.chunkRepo.count({ where: { fileId: file.id } });
    }

    if (!file) {
      file = this.fileRepo.create({ path: relativePath, contentHash, content });
    } else {
      file.contentHash = contentHash;
      file.content = content;
    }
    file = await this.fileRepo.save(file);

    await this.chunkRepo.delete({ fileId: file.id });

    const markdownChunks = chunkMarkdownFile(relativePath, content);
    const isPostgres = this.dataSource.options.type === 'postgres';
    const useVector = isPostgres && (await this.pgVectorAvailable());

    let count = 0;
    for (const chunk of markdownChunks) {
      const embedding = await this.embeddingService.embed(chunk.text, AiUsageFeature.MEMORY_UPDATE);
      const embeddingJson = embedding ? JSON.stringify(embedding) : null;

      if (useVector && embedding) {
        await this.dataSource.query(
          `INSERT INTO ai_memory_chunks ("fileId", "path", "startLine", "endLine", "text", "embeddingJson", embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
          [
            file.id,
            chunk.path,
            chunk.startLine,
            chunk.endLine,
            chunk.text,
            embeddingJson,
            toPgVectorLiteral(embedding),
          ],
        );
      } else {
        await this.chunkRepo.save(
          this.chunkRepo.create({
            fileId: file.id,
            path: chunk.path,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            text: chunk.text,
            embeddingJson,
          }),
        );
      }
      count++;
    }
    return count;
  }

  async hybridSearch(query: string, limit = 8): Promise<MemorySearchHit[] | null> {
    const total = await this.chunkRepo.count();
    if (total === 0) return null;

    const keywords = extractSearchKeywords(query);
    const queryEmbedding = await this.embeddingService.embed(query, AiUsageFeature.MEMORY_UPDATE);

    const isPostgres = this.dataSource.options.type === 'postgres';
    const useVector = isPostgres && queryEmbedding && (await this.pgVectorAvailable());

    const scored = new Map<string, MemorySearchHit & { vecScore: number; kwScore: number }>();

    if (useVector && queryEmbedding) {
      const vecLiteral = toPgVectorLiteral(queryEmbedding);
      const rows = (await this.dataSource.query(
        `SELECT "path", "startLine", "endLine", "text",
                (1 - (embedding <=> $1::vector)) AS vec_score
         FROM ai_memory_chunks
         WHERE embedding IS NOT NULL
         ORDER BY embedding <=> $1::vector
         LIMIT $2`,
        [vecLiteral, Math.min(limit * 3, 30)],
      )) as Array<{
        path: string;
        startLine: number;
        endLine: number;
        text: string;
        vec_score: number;
      }>;

      for (const row of rows) {
        const key = `${row.path}:${row.startLine}:${row.endLine}`;
        scored.set(key, {
          path: row.path,
          startLine: row.startLine,
          endLine: row.endLine,
          text: row.text,
          score: 0,
          vecScore: Number(row.vec_score) || 0,
          kwScore: 0,
        });
      }
    } else if (queryEmbedding) {
      const chunks = await this.chunkRepo.find({
        where: {},
        take: 500,
        order: { path: 'ASC' },
      });
      for (const chunk of chunks) {
        if (!chunk.embeddingJson) continue;
        try {
          const vec = JSON.parse(chunk.embeddingJson) as number[];
          const vecScore = cosineSimilarity(queryEmbedding, vec);
          if (vecScore < 0.2) continue;
          const key = `${chunk.path}:${chunk.startLine}:${chunk.endLine}`;
          scored.set(key, {
            path: chunk.path,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            text: chunk.text,
            score: 0,
            vecScore,
            kwScore: 0,
          });
        } catch {
          /* skip */
        }
      }
    }

    const allChunks = await this.chunkRepo.find({ take: 800 });
    for (const chunk of allChunks) {
      const kwScore = keywords.length ? scoreChunkText(chunk.text, keywords) : 0;
      if (kwScore <= 0 && !scored.has(`${chunk.path}:${chunk.startLine}:${chunk.endLine}`)) continue;
      const key = `${chunk.path}:${chunk.startLine}:${chunk.endLine}`;
      const existing = scored.get(key);
      if (existing) {
        existing.kwScore = Math.max(existing.kwScore, kwScore);
      } else if (kwScore > 0) {
        scored.set(key, {
          path: chunk.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          text: chunk.text,
          score: 0,
          vecScore: 0,
          kwScore,
        });
      }
    }

    const maxKw = Math.max(1, ...[...scored.values()].map(h => h.kwScore));
    const hits = [...scored.values()]
      .map(h => {
        const vecNorm = h.vecScore;
        const kwNorm = h.kwScore / maxKw;
        const score = (useVector ? VECTOR_WEIGHT * vecNorm : 0) + KEYWORD_WEIGHT * kwNorm;
        return { ...h, score };
      })
      .filter(h => h.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(limit, 20))
      .map(({ path, startLine, endLine, text, score }) => ({
        path,
        startLine,
        endLine,
        text,
        score,
      }));

    return hits.length ? hits : null;
  }

  private async pgVectorAvailable(): Promise<boolean> {
    if (this.vectorSearchReady !== null) return this.vectorSearchReady;
    if (this.dataSource.options.type !== 'postgres') {
      this.vectorSearchReady = false;
      return false;
    }
    try {
      const rows = (await this.dataSource.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ai_memory_chunks' AND column_name = 'embedding'
        LIMIT 1
      `)) as unknown[];
      this.vectorSearchReady = rows.length > 0;
    } catch {
      this.vectorSearchReady = false;
    }
    return this.vectorSearchReady;
  }

  private listMemoryFilePaths(): string[] {
    const out: string[] = [];
    const walk = (dir: string, prefix: string) => {
      if (!fs.existsSync(dir)) return;
      for (const name of fs.readdirSync(dir)) {
        if (name.startsWith('.')) continue;
        const full = path.join(dir, name);
        const rel = prefix ? `${prefix}/${name}` : name;
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, rel);
        else if (name.endsWith('.md') || name.endsWith('.txt')) {
          out.push(rel.replace(/\\/g, '/'));
        }
      }
    };
    walk(this.basePath, '');
    return out.sort();
  }

  private readFileContent(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const resolved = path.resolve(this.basePath, normalized);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('Invalid memory path');
    }
    return fs.readFileSync(resolved, 'utf8');
  }
}
