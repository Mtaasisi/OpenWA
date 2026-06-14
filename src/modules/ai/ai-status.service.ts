import { Injectable } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiMemoryIndexService } from './ai-memory-index.service';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';
import { AiKnowledgeService, BUNDLED_KNOWLEDGE_FILES } from './ai-knowledge.service';
import { AiProfileService } from './ai-profile.service';

export interface AiSetupCheckItem {
  id: string;
  ok: boolean;
  detail?: string | null;
}

@Injectable()
export class AiStatusService {
  constructor(
    private readonly aiSettings: AiSettingsService,
    private readonly memoryIndex: AiMemoryIndexService,
    private readonly knowledgeIndex: AiKnowledgeIndexService,
    private readonly knowledge: AiKnowledgeService,
    private readonly profileService: AiProfileService,
  ) {}

  async getStatus() {
    const config = await this.aiSettings.get();
    const [memory, knowledgeChunks, profiles, hasPayment, knowledgeFiles] = await Promise.all([
      this.memoryIndex.getIndexStatus(),
      this.knowledgeIndex.getIndexStatus(),
      this.profileService.listProfiles(),
      this.profileService.hasActivePaymentAccount(),
      Promise.resolve(this.knowledge.listFiles()),
    ]);

    const setupItems: AiSetupCheckItem[] = [
      { id: 'apiKey', ok: config.apiKeySet === true },
      { id: 'enabled', ok: config.enabled === true },
      { id: 'autoReply', ok: config.autoReplyEnabled === true },
      {
        id: 'knowledgeIndexed',
        ok: knowledgeChunks.chunks >= 15,
        detail: `${knowledgeChunks.chunks} chunks`,
      },
      {
        id: 'knowledgeFiles',
        ok: knowledgeFiles.length >= BUNDLED_KNOWLEDGE_FILES.length,
        detail: `${knowledgeFiles.length} files`,
      },
      {
        id: 'branchProfile',
        ok: profiles.some(p => !!p.locationDescription?.trim()),
        detail: profiles.length ? `${profiles.length} branch(es)` : '0 branches',
      },
      { id: 'paymentAccount', ok: hasPayment },
    ];

    const completed = setupItems.filter(i => i.ok).length;

    return {
      enabled: config.enabled,
      apiKeySet: config.apiKeySet,
      autoReplyEnabled: config.autoReplyEnabled,
      toolCallingEnabled: config.toolCallingEnabled,
      testStatus: config.testStatus,
      provider: config.provider,
      model: config.model,
      memory,
      knowledge: knowledgeChunks,
      setup: {
        ready: completed === setupItems.length,
        completed,
        total: setupItems.length,
        items: setupItems,
      },
    };
  }
}
