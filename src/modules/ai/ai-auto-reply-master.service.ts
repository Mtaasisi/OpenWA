import { Injectable } from '@nestjs/common';
import { AuditAction } from '../audit/entities/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { Session, SessionStatus } from '../session/entities/session.entity';
import { SessionService } from '../session/session.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import { WhatsAppSessionHealthService } from '../whatsapp-safety/services/whatsapp-session-health.service';
import { AiSettingsService } from './ai-settings.service';
import { AiKnowledgeService, BUNDLED_KNOWLEDGE_FILES } from './ai-knowledge.service';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';
import { AiCircuitBreakerService } from './ai-circuit-breaker.service';
import { AiSignalService } from './ai-signal.service';
import { InboxCrmService } from '../message/inbox-crm.service';
import { Inject, forwardRef } from '@nestjs/common';
import { ProductsService } from '../products/products.service';

export interface AiAutoReplyHealthCheck {
  id: string;
  ok: boolean;
  detail?: string | null;
  fixTarget?: 'ai' | 'automations' | 'whatsapp-safety' | 'channels' | 'ai-knowledge' | 'products' | null;
}

export interface AiAutoReplySessionHealth {
  sessionId: string;
  name: string;
  status: string;
  aiAutoReplyEnabled: boolean;
  connected: boolean;
  automationPaused: boolean;
  circuitBreakerOpen: boolean;
}

export interface AiAutoReplyHealthResponse {
  masterEnabled: boolean;
  ready: boolean;
  checks: AiAutoReplyHealthCheck[];
  sessions: AiAutoReplySessionHealth[];
  stats: {
    aiReplies24h: number;
    openEscalations: number;
    knowledgeChunks: number;
    knowledgeFiles: number;
  };
}

@Injectable()
export class AiAutoReplyMasterService {
  constructor(
    private readonly aiSettings: AiSettingsService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly safetySettings: WhatsAppSafetySettingsService,
    private readonly sessionHealth: WhatsAppSessionHealthService,
    private readonly knowledge: AiKnowledgeService,
    private readonly knowledgeIndex: AiKnowledgeIndexService,
    private readonly circuitBreaker: AiCircuitBreakerService,
    private readonly signalService: AiSignalService,
    private readonly audit: AuditService,
    @Inject(forwardRef(() => InboxCrmService))
    private readonly inboxCrm: InboxCrmService,
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
  ) {}

  async setMasterEnabled(enabled: boolean): Promise<AiAutoReplyHealthResponse> {
    await this.aiSettings.setAutoReplyEnabled(enabled);
    await this.safetySettings.updateGlobal({ aiAutoReplyEnabled: enabled });

    const sessions = await this.sessionService.findAll();
    await Promise.all(
      sessions.map(s => this.sessionService.setAiAutoReplyEnabled(s.id, enabled)),
    );

    return this.getHealth();
  }

  /**
   * Enable unrestricted fast auto-reply: instant pacing, no caps/escalations, resume paused chats.
   */
  async applyUnrestrictedMode(): Promise<AiAutoReplyHealthResponse & { resumedThreads: number }> {
    await this.aiSettings.setUnrestrictedMode(true);
    await this.safetySettings.updateGlobal({
      aiAutoReplyEnabled: true,
      aiSafetyEnabled: true,
    });
    const sessions = await this.sessionService.findAll();
    await Promise.all(
      sessions.map(s => this.sessionService.setAiAutoReplyEnabled(s.id, true)),
    );
    const { resumed } = await this.inboxCrm.bulkResumeAiThreads();
    const health = await this.getHealth();
    return { ...health, resumedThreads: resumed };
  }

  async getHealth(): Promise<AiAutoReplyHealthResponse> {
    const [config, safety, sessions, knowledgeFiles, knowledgeChunks, signals, catalogStats] =
      await Promise.all([
        this.aiSettings.get(),
        this.safetySettings.getGlobal(),
        this.sessionService.findAll(),
        Promise.resolve(this.knowledge.listFiles()),
        this.knowledgeIndex.getIndexedChunkCount(),
        this.signalService.getDashboardSignals(24),
        this.productsService.catalogStats({ activeOnly: true }),
      ]);

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const aiReplies24h = await this.audit.countSince(AuditAction.AI_REPLY, since24h);

    const masterEnabled = config.autoReplyEnabled === true;
    const providerReady = config.enabled === true && config.apiKeySet === true;
    const safetyAiOn = safety.aiAutoReplyEnabled !== false;
    const safetyMasterOn = safety.aiSafetyEnabled !== false;
    const connected = sessions.filter(s => s.status === SessionStatus.READY);
    const sessionsOn = sessions.filter(s =>
      this.sessionService.isAiAutoReplyEnabledForSession(s),
    ).length;
    const syncAligned =
      masterEnabled === safetyAiOn &&
      (masterEnabled ? sessionsOn === sessions.length : sessionsOn === 0);

    const sessionRows: AiAutoReplySessionHealth[] = await Promise.all(
      sessions.map(async (s: Session) => ({
        sessionId: s.id,
        name: s.name,
        status: s.status,
        aiAutoReplyEnabled: this.sessionService.isAiAutoReplyEnabledForSession(s),
        connected: s.status === SessionStatus.READY,
        automationPaused: await this.sessionHealth.isAutomationPaused(s.id),
        circuitBreakerOpen: this.circuitBreaker.isOpen(s.id),
      })),
    );

    const checks: AiAutoReplyHealthCheck[] = [
      {
        id: 'providerReady',
        ok: providerReady,
        detail: providerReady ? null : 'AI provider or API key missing',
        fixTarget: 'ai',
      },
      {
        id: 'masterEnabled',
        ok: masterEnabled,
        detail: masterEnabled ? null : 'Master auto-reply is off',
        fixTarget: 'automations',
      },
      {
        id: 'safetyAiReply',
        ok: safetyAiOn,
        detail: safetyAiOn ? null : 'WhatsApp safety has AI auto-reply disabled',
        fixTarget: 'whatsapp-safety',
      },
      {
        id: 'safetyEnabled',
        ok: safetyMasterOn,
        detail: safetyMasterOn ? null : 'WhatsApp AI safety guard is off',
        fixTarget: 'whatsapp-safety',
      },
      {
        id: 'sessionConnected',
        ok: connected.length > 0,
        detail: connected.length > 0 ? `${connected.length} connected` : 'No WhatsApp session connected',
        fixTarget: 'channels',
      },
      {
        id: 'knowledgeFiles',
        ok: knowledgeFiles.length >= BUNDLED_KNOWLEDGE_FILES.length,
        detail: `${knowledgeFiles.length} files`,
        fixTarget: 'ai-knowledge',
      },
      {
        id: 'knowledgeIndexed',
        ok: knowledgeChunks >= 15,
        detail: `${knowledgeChunks} chunks indexed`,
        fixTarget: 'ai-knowledge',
      },
      {
        id: 'syncAligned',
        ok: syncAligned || !masterEnabled,
        detail: syncAligned
          ? null
          : `${sessions.length - sessionsOn} session(s) excluded from master switch`,
        fixTarget: 'channels',
      },
      {
        id: 'localCatalog',
        ok: catalogStats.total > 0 && catalogStats.outOfStock < catalogStats.total,
        detail:
          catalogStats.total === 0
            ? 'No active products in local inventory'
            : catalogStats.outOfStock === catalogStats.total
              ? `${catalogStats.total} products but all out of stock`
              : `${catalogStats.total - catalogStats.outOfStock} in-stock of ${catalogStats.total} products`,
        fixTarget: 'products',
      },
    ];

    const blocking = [
      'providerReady',
      'masterEnabled',
      'safetyAiReply',
      'safetyEnabled',
      'sessionConnected',
    ];
    const ready =
      masterEnabled &&
      blocking.every(id => checks.find(c => c.id === id)?.ok) &&
      checks.find(c => c.id === 'knowledgeIndexed')?.ok !== false;

    return {
      masterEnabled,
      ready,
      checks,
      sessions: sessionRows,
      stats: {
        aiReplies24h,
        openEscalations: signals.openEscalations,
        knowledgeChunks,
        knowledgeFiles: knowledgeFiles.length,
      },
    };
  }
}
