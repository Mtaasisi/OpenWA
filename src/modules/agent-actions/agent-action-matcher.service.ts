import { Injectable } from '@nestjs/common';
import type { AgentActionMatch } from './agent-action.types';
import { AgentActionRegistryService } from './agent-action-registry.service';

const ON_WORDS = new Set(['zima', 'stop', 'disable', 'off', 'simamisha', 'pause']);
const OFF_TO_ON = new Set(['washa', 'enable', 'turn', 'on', 'endeleza', 'resume', 'fungua', 'open', 'onyesha', 'show', 'peleka', 'nionyeshe']);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenOverlap(a: string[], b: string[]): number {
  if (b.length === 0) return 0;
  const setA = new Set(a);
  let hits = 0;
  for (const t of b) {
    if (setA.has(t)) hits += 1;
  }
  return hits / b.length;
}

function extractBranchName(text: string): string | undefined {
  const patterns = [
    /badilisha branch kuwa\s+(.+)/i,
    /switch branch to\s+(.+)/i,
    /change branch to\s+(.+)/i,
    /branch\s+(?:kuwa|to)\s+(.+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

@Injectable()
export class AgentActionMatcherService {
  constructor(private readonly registry: AgentActionRegistryService) {}

  match(text: string): AgentActionMatch | null {
    const normalized = normalizeText(text);
    if (!normalized) return null;

    const tokens = normalized.split(' ').filter(Boolean);
    let best: AgentActionMatch | null = null;

    for (const action of this.registry.getAll()) {
      if (action.risk === 'blocked') continue;

      for (const alias of action.aliases) {
        const aliasNorm = normalizeText(alias);
        if (!aliasNorm) continue;
        if (normalized === aliasNorm || normalized.includes(aliasNorm)) {
          const confidence = normalized === aliasNorm ? 1 : 0.95;
          const candidate = this.buildMatch(action.id, confidence, normalized, text);
          if (!best || candidate.confidence > best.confidence) best = candidate;
        }
      }

      const kwScore = tokenOverlap(tokens, action.keywords.map(k => normalizeText(k)).flatMap(k => k.split(' ')));
      if (kwScore >= 0.6) {
        const confidence = 0.55 + kwScore * 0.35;
        const candidate = this.buildMatch(action.id, confidence, normalized, text);
        if (!best || candidate.confidence > best.confidence) best = candidate;
      }
    }

    if (!best || best.confidence < 0.55) return null;
    return best;
  }

  private buildMatch(
    actionId: string,
    confidence: number,
    normalized: string,
    raw: string,
  ): AgentActionMatch {
    const params: Record<string, unknown> = {};
    const branchName = extractBranchName(raw);
    if (branchName) params.branchName = branchName;

    const tokens = normalized.split(' ');
    const hasOff = tokens.some(t => ON_WORDS.has(t));
    const hasOn = tokens.some(t => OFF_TO_ON.has(t));

    if (actionId.includes('.enable') && hasOff && !hasOn) {
      return { actionId: actionId.replace('.enable', '.disable'), confidence, params };
    }
    if (actionId.includes('.disable') && hasOn && !hasOff) {
      return { actionId: actionId.replace('.disable', '.enable'), confidence, params };
    }

    return { actionId, confidence, params };
  }
}
