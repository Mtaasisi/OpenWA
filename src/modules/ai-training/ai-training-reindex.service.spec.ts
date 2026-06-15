import { AiTrainingReindexService } from './ai-training-reindex.service';

describe('AiTrainingReindexService', () => {
  function createService(settingsPatch: Record<string, unknown> = {}) {
    let settings = {
      autoReindexAfterApproval: true,
      autoReindexSmallUpdatesOnly: true,
      knowledgeIndexStale: false,
      ...settingsPatch,
    };
    const settingsService = {
      getSettings: jest.fn(async () => settings),
      updateSettings: jest.fn(async (patch: Record<string, unknown>) => {
        settings = { ...settings, ...patch };
        return settings;
      }),
    };
    const knowledgeIndex = {
      reindexAll: jest.fn(async () => undefined),
      getIndexedChunkCount: jest.fn(async () => 42),
    };
    const memoryIndex = {
      reindexAll: jest.fn(async () => undefined),
      getIndexedChunkCount: jest.fn(async () => 7),
    };
    const svc = new AiTrainingReindexService(
      knowledgeIndex as never,
      memoryIndex as never,
      settingsService as never,
    );
    return { svc, settingsService, knowledgeIndex, memoryIndex, getSettings: () => settings };
  }

  it('maybeAutoReindex runs reindex for small approved changes', async () => {
    const { svc, knowledgeIndex, getSettings } = createService();
    const ok = await svc.maybeAutoReindex(800);
    expect(ok).toBe(true);
    expect(knowledgeIndex.reindexAll).toHaveBeenCalled();
    expect(getSettings().knowledgeIndexStale).toBe(false);
  });

  it('maybeAutoReindex marks stale when auto reindex is disabled', async () => {
    const { svc, knowledgeIndex, getSettings } = createService({ autoReindexAfterApproval: false });
    const ok = await svc.maybeAutoReindex(200);
    expect(ok).toBe(false);
    expect(knowledgeIndex.reindexAll).not.toHaveBeenCalled();
    expect(getSettings().knowledgeIndexStale).toBe(true);
  });

  it('maybeAutoReindex marks stale for large updates when small-only mode is enabled', async () => {
    const { svc, knowledgeIndex, getSettings } = createService();
    const ok = await svc.maybeAutoReindex(5000);
    expect(ok).toBe(false);
    expect(knowledgeIndex.reindexAll).not.toHaveBeenCalled();
    expect(getSettings().knowledgeIndexStale).toBe(true);
  });

  it('reindexAll clears stale flag and optionally reindexes memory', async () => {
    const { svc, memoryIndex, getSettings } = createService({ knowledgeIndexStale: true });
    const result = await svc.reindexAll({ includeMemory: true });
    expect(result.knowledgeChunks).toBe(42);
    expect(result.memoryChunks).toBe(7);
    expect(memoryIndex.reindexAll).toHaveBeenCalled();
    expect(getSettings().knowledgeIndexStale).toBe(false);
  });
});
