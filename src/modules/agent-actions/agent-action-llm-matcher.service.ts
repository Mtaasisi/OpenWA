import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import type { AgentActionMatch } from './agent-action.types';
import { AgentActionRegistryService } from './agent-action-registry.service';
import { AiChatService } from '../ai/ai-chat.service';
import { AiUsageFeature, AiUsageSource } from '../ai/cost/ai-cost.types';

type LlmClassification = {
  actionId: string;
  confidence: number;
  params?: Record<string, unknown>;
};

function extractJsonObject(raw: string): LlmClassification | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as LlmClassification;
    if (!parsed?.actionId || typeof parsed.confidence !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

@Injectable()
export class AgentActionLlmMatcherService {
  private readonly logger = new Logger(AgentActionLlmMatcherService.name);

  constructor(
    private readonly registry: AgentActionRegistryService,
    @Inject(forwardRef(() => AiChatService))
    private readonly aiChat: AiChatService,
  ) {}

  /** Refine ambiguous deterministic matches (0.55–0.84) using a lightweight LLM pass. */
  async refine(text: string, candidate: AgentActionMatch): Promise<AgentActionMatch | null> {
    const catalog = this.registry
      .getAll()
      .filter(a => a.risk !== 'blocked')
      .map(a => ({
        id: a.id,
        title: a.title,
        aliases: a.aliases.slice(0, 3),
      }));

    const system = [
      'You classify staff settings commands for OpenWA (Swahili or English).',
      'Reply with JSON only: {"actionId":"...","confidence":0.0-1.0,"params":{}}',
      'Use actionId "none" with confidence 0 when the message is not a settings command.',
      'Only use action ids from the catalog. Never invent ids.',
      'params may include branchName for branch switch commands.',
    ].join('\n');

    const user = [
      `User message: ${JSON.stringify(text)}`,
      `Deterministic guess: ${candidate.actionId} (confidence ${candidate.confidence.toFixed(2)})`,
      `Catalog: ${JSON.stringify(catalog)}`,
    ].join('\n');

    try {
      const raw = await this.aiChat.completeStructuredPrompt(system, user, 256, {
        feature: AiUsageFeature.BACKGROUND_JOB,
        source: AiUsageSource.BACKGROUND_JOB,
      });
      if (!raw) return null;

      const parsed = extractJsonObject(raw);
      if (!parsed || parsed.actionId === 'none' || parsed.confidence < 0.85) return null;

      const action = this.registry.getById(parsed.actionId);
      if (!action || action.risk === 'blocked') return null;

      return {
        actionId: parsed.actionId,
        confidence: Math.min(parsed.confidence, 0.98),
        params: { ...candidate.params, ...(parsed.params ?? {}) },
      };
    } catch (err) {
      this.logger.debug(
        `LLM agent-action refine skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
