import { Injectable } from '@nestjs/common';
import { AiAutoReplyMasterService } from '../ai/ai-auto-reply-master.service';
import { WhatsAppSendQueueService } from '../whatsapp-safety/services/whatsapp-send-queue.service';
import { WhatsAppQueueStatus } from '../whatsapp-safety/enums/whatsapp-safety.enums';
import type { AgentActionRequest } from './agent-action.types';

@Injectable()
export class AgentActionDiagnosticService {
  constructor(
    private readonly autoReplyHealth: AiAutoReplyMasterService,
    private readonly sendQueue: WhatsAppSendQueueService,
  ) {}

  async getAppHealthSummary(): Promise<{ message: string; data: Record<string, unknown> }> {
    const health = await this.autoReplyHealth.getHealth();
    const failedChecks = health.checks.filter(c => !c.ok);
    const overall =
      failedChecks.length === 0 && health.masterEnabled ? 'success' : 'warning';
    const warnings = failedChecks
      .map(c => c.detail ?? c.id)
      .filter((w): w is string => Boolean(w))
      .slice(0, 5);
    const message =
      overall === 'success'
        ? 'System iko sawa ✅'
        : `System status: ${overall}. ${warnings.length ? `Issues: ${warnings.join('; ')}` : ''}`;
    return {
      message,
      data: {
        overall,
        warnings,
        masterEnabled: health.masterEnabled,
        sessions: health.sessions,
      },
    };
  }

  async diagnoseAiNotReplying(request: AgentActionRequest): Promise<{ message: string; data: Record<string, unknown> }> {
    const health = await this.autoReplyHealth.getHealth();
    const reasons: string[] = [];
    const fixes: string[] = [];

    for (const check of health.checks) {
      if (!check.ok && check.detail) {
        reasons.push(check.detail);
        if (check.fixTarget) fixes.push(check.fixTarget);
      }
    }

    const disconnected = health.sessions.filter(s => !s.connected);
    if (disconnected.length) {
      reasons.push(`${disconnected.length} WhatsApp session(s) not connected`);
      fixes.push('channels');
    }

    const paused = health.sessions.filter(s => s.automationPaused);
    if (paused.length) {
      reasons.push(`${paused.length} session(s) have automation paused`);
    }

    const failedQueue = await this.sendQueue.list({ status: WhatsAppQueueStatus.FAILED, limit: 5 });
    if (failedQueue.length) {
      reasons.push(`${failedQueue.length}+ failed messages in send queue`);
      fixes.push('queue');
    }

    if (reasons.length === 0) {
      if (!health.masterEnabled) {
        return {
          message: 'AI auto reply imezimwa. Washa AI auto reply ili AI ianze kujibu.',
          data: { health, reasons: ['master disabled'] },
        };
      }
      return {
        message: 'AI auto reply inaonekana sawa. Kama bado haijibu, angalia chat-specific pause au customer opt-out.',
        data: { health },
      };
    }

    const message = `Kwa nini AI haijibu: ${reasons.join('; ')}`;
    return { message, data: { health, reasons, suggestedFixes: fixes, chatId: request.currentChatId } };
  }
}
