import { Injectable } from '@nestjs/common';
import { AiKnowledgeIndexService } from '../ai/ai-knowledge-index.service';
import { AiMemoryIndexService } from '../ai/ai-memory-index.service';
import { AiLearningSettingsService } from '../ai/ai-learning-settings.service';

@Injectable()
export class AiTrainingReindexService {
  constructor(
    private readonly knowledgeIndex: AiKnowledgeIndexService,
    private readonly memoryIndex: AiMemoryIndexService,
    private readonly settings: AiLearningSettingsService,
  ) {}

  async markStale(): Promise<void> {
    await this.settings.updateSettings({ knowledgeIndexStale: true });
  }

  async clearStale(): Promise<void> {
    await this.settings.updateSettings({ knowledgeIndexStale: false });
  }

  async isStale(): Promise<boolean> {
    const s = await this.settings.getSettings();
    return Boolean(s.knowledgeIndexStale);
  }

  async reindexAll(options?: { includeMemory?: boolean }): Promise<{
    knowledgeChunks: number;
    memoryChunks?: number;
    error?: string;
  }> {
    try {
      await this.knowledgeIndex.reindexAll();
      const knowledgeChunks = await this.knowledgeIndex.getIndexedChunkCount();
      let memoryChunks: number | undefined;
      if (options?.includeMemory) {
        await this.memoryIndex.reindexAll();
        memoryChunks = await this.memoryIndex.getIndexedChunkCount();
      }
      await this.clearStale();
      return { knowledgeChunks, memoryChunks };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { knowledgeChunks: 0, error: message };
    }
  }

  async maybeAutoReindex(changeSize: number): Promise<boolean> {
    const s = await this.settings.getSettings();
    if (!s.autoReindexAfterApproval) {
      await this.markStale();
      return false;
    }
    if (s.autoReindexSmallUpdatesOnly && changeSize > 4000) {
      await this.markStale();
      return false;
    }
    const result = await this.reindexAll();
    return !result.error;
  }
}
