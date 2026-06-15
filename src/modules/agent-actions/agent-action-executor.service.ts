import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { AiAutoReplyMasterService } from '../ai/ai-auto-reply-master.service';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AiKnowledgeIndexService } from '../ai/ai-knowledge-index.service';
import { AiMemoryService } from '../ai/ai-memory.service';
import { AiMemoryIndexService } from '../ai/ai-memory-index.service';
import { AiProfileService } from '../ai/ai-profile.service';
import { humanTimingPresetForStyle, type HumanReplyStyle } from '../ai/services/ai-human-timing.service';
import { WhatsAppSafetySettingsService } from '../whatsapp-safety/services/whatsapp-safety-settings.service';
import { FollowupAutopilotSettingsService } from '../followup/followup-autopilot-settings.service';
import { InauzwaSyncPreferencesService } from '../products/inauzwa-sync-preferences.service';
import { SessionService } from '../session/session.service';
import { WhatsAppSendQueueService } from '../whatsapp-safety/services/whatsapp-send-queue.service';
import { WhatsAppQueueStatus } from '../whatsapp-safety/enums/whatsapp-safety.enums';
import { BackupService } from '../backup/backup.service';
import type { BackupType } from '../backup/entities/backup-record.entity';
import type {
  AgentActionDefinition,
  AgentActionExecutionContext,
  AgentActionExecutionOutcome,
} from './agent-action.types';
import { AgentActionDiagnosticService } from './agent-action-diagnostic.service';

@Injectable()
export class AgentActionExecutorService {
  constructor(
    private readonly autoReplyMaster: AiAutoReplyMasterService,
    private readonly aiSettings: AiSettingsService,
    private readonly knowledgeIndex: AiKnowledgeIndexService,
    private readonly memory: AiMemoryService,
    private readonly memoryIndex: AiMemoryIndexService,
    private readonly aiProfile: AiProfileService,
    private readonly safetySettings: WhatsAppSafetySettingsService,
    private readonly autopilotSettings: FollowupAutopilotSettingsService,
    private readonly inauzwaPrefs: InauzwaSyncPreferencesService,
    @Inject(forwardRef(() => SessionService))
    private readonly sessionService: SessionService,
    private readonly sendQueue: WhatsAppSendQueueService,
    private readonly backupService: BackupService,
    private readonly diagnostics: AgentActionDiagnosticService,
  ) {}

  async execute(
    action: AgentActionDefinition,
    ctx: AgentActionExecutionContext,
  ): Promise<AgentActionExecutionOutcome> {
    switch (action.id) {
      case 'ai.auto_reply.enable':
        return this.toggleAutoReply(true);
      case 'ai.auto_reply.disable':
        return this.toggleAutoReply(false);
      case 'ai.reply_style.fast':
        return this.setReplyStyle('fast');
      case 'ai.reply_style.balanced':
        return this.setReplyStyle('balanced');
      case 'ai.reply_style.careful':
        return this.setReplyStyle('careful');
      case 'ai.burst_reading.enable':
        return this.setBurstReading(true);
      case 'ai.burst_reading.disable':
        return this.setBurstReading(false);
      case 'ai.presence_replies.enable':
        return this.setPresenceReplies(true);
      case 'ai.quoted_reply.enable':
        return this.setQuotedReply(true);
      case 'ai.quoted_reply.disable':
        return this.setQuotedReply(false);
      case 'ai.suspicious_name_confirmation.enable':
        return this.setSuspiciousNameCheck(true);
      case 'ai.knowledge.reindex':
        return this.reindexKnowledge();
      case 'ai.memory.clear':
        return this.clearMemory();
      case 'whatsapp.session.reconnect':
        return this.reconnectWhatsApp(ctx);
      case 'whatsapp.session.remove':
        return this.removeWhatsAppSession(ctx);
      case 'whatsapp.safety.enable':
        return this.setSafetyGuard(true);
      case 'whatsapp.safety.disable':
        return this.setSafetyGuard(false);
      case 'whatsapp.campaigns.pause':
        return this.setCampaignsEnabled(false);
      case 'whatsapp.campaigns.resume':
        return this.setCampaignsEnabled(true);
      case 'followup.autopilot.enable':
        return this.setAutopilot(true);
      case 'followup.autopilot.disable':
        return this.setAutopilot(false);
      case 'followup.create_for_current_customer':
        return this.createFollowupHint(ctx);
      case 'branch.switch':
        return this.switchBranch(ctx);
      case 'app.health.check':
        return this.diagnostics.getAppHealthSummary();
      case 'ai.reply.diagnose':
        return this.diagnostics.diagnoseAiNotReplying(ctx.request);
      case 'queue.retry_failed':
        return this.retryFailedQueue();
      case 'backup.create':
        return this.createBackup(ctx);
      default:
        throw new BadRequestException(`Action ${action.id} has no executor`);
    }
  }

  private async toggleAutoReply(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.aiSettings.get();
    await this.autoReplyMaster.setMasterEnabled(enabled);
    return {
      message: enabled ? 'Nimewasha AI auto reply ✅' : 'Nimezima AI auto reply ✅',
      data: { oldValue: before.autoReplyEnabled, newValue: enabled },
    };
  }

  private async setReplyStyle(style: HumanReplyStyle): Promise<AgentActionExecutionOutcome> {
    const before = await this.aiSettings.get();
    const preset = humanTimingPresetForStyle(style);
    await this.aiSettings.upsert({
      provider: before.provider,
      model: before.model,
      humanReplyStyle: style,
      humanTimingEnabled: true,
      activeChatWaitMinMs: preset.activeChatWaitMinMs,
      activeChatWaitMaxMs: preset.activeChatWaitMaxMs,
      warmChatWaitMinMs: preset.warmChatWaitMinMs,
      warmChatWaitMaxMs: preset.warmChatWaitMaxMs,
      coldChatWaitMinMs: preset.coldChatWaitMinMs,
      coldChatWaitMaxMs: preset.coldChatWaitMaxMs,
      burstPauseMinMs: preset.coldBurstPauseMinMs,
      burstPauseMaxMs: preset.coldBurstPauseMaxMs,
    });
    const labels = { fast: 'Fast', balanced: 'Balanced', careful: 'Careful' };
    return {
      message: `Nimeweka AI reply style kuwa ${labels[style]} ✅`,
      data: { oldValue: before.humanReplyStyle, newValue: style },
    };
  }

  private async setBurstReading(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.aiSettings.get();
    await this.aiSettings.upsert({
      provider: before.provider,
      model: before.model,
      humanTimingEnabled: enabled,
      replyToBurstLatestMessage: enabled,
    });
    return {
      message: enabled ? 'Nimewasha burst message reading ✅' : 'Nimezima burst message reading ✅',
      data: {
        oldValue: { humanTimingEnabled: before.humanTimingEnabled, replyToBurstLatestMessage: before.replyToBurstLatestMessage },
        newValue: { humanTimingEnabled: enabled, replyToBurstLatestMessage: enabled },
      },
    };
  }

  private async setPresenceReplies(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.aiSettings.get();
    await this.aiSettings.upsert({
      provider: before.provider,
      model: before.model,
      presenceIntentEnabled: enabled,
    });
    return {
      message: enabled ? 'Nimewasha presence replies ✅' : 'Nimezima presence replies ✅',
      data: { oldValue: before.presenceIntentEnabled, newValue: enabled },
    };
  }

  private async setQuotedReply(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.aiSettings.get();
    await this.aiSettings.upsert({
      provider: before.provider,
      model: before.model,
      autoReplyUseQuotedReply: enabled,
    });
    return {
      message: enabled ? 'Nimewasha quoted reply ✅' : 'Nimezima quoted reply ✅',
      data: { oldValue: before.autoReplyUseQuotedReply, newValue: enabled },
    };
  }

  private async setSuspiciousNameCheck(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.aiSettings.get();
    await this.aiSettings.upsert({
      provider: before.provider,
      model: before.model,
      suspiciousNameConfirmationEnabled: enabled,
    });
    return {
      message: enabled ? 'Nimewasha suspicious name check ✅' : 'Nimezima suspicious name check ✅',
      data: { oldValue: before.suspiciousNameConfirmationEnabled, newValue: enabled },
    };
  }

  private async reindexKnowledge(): Promise<AgentActionExecutionOutcome> {
    const result = await this.knowledgeIndex.reindexAll();
    return {
      message: `Nimeanza reindex AI knowledge ✅ (${result.files} files, ${result.chunks} chunks)`,
      data: result,
    };
  }

  private async clearMemory(): Promise<AgentActionExecutionOutcome> {
    const files = this.memory.listFiles();
    let cleared = 0;
    for (const f of files) {
      this.memory.writeFile(f.path, '');
      cleared += 1;
    }
    await this.memoryIndex.reindexAll();
    return {
      message: `Nimefuta AI memory files (${cleared}) ✅`,
      data: { clearedFiles: cleared },
    };
  }

  private async reconnectWhatsApp(ctx: AgentActionExecutionContext): Promise<AgentActionExecutionOutcome> {
    const sessionId = typeof ctx.params.sessionId === 'string' ? ctx.params.sessionId : undefined;
    const sessions = await this.sessionService.findAll();
    const target = sessionId ? sessions.find(s => s.id === sessionId) : sessions[0];
    if (!target) throw new BadRequestException('No WhatsApp session found');
    await this.sessionService.restart(target.id);
    return { message: `Nime-restart WhatsApp session "${target.name}" ✅`, data: { sessionId: target.id } };
  }

  private async removeWhatsAppSession(ctx: AgentActionExecutionContext): Promise<AgentActionExecutionOutcome> {
    const sessionId = typeof ctx.params.sessionId === 'string' ? ctx.params.sessionId : undefined;
    const sessions = await this.sessionService.findAll();
    const target = sessionId ? sessions.find(s => s.id === sessionId) : sessions[0];
    if (!target) throw new BadRequestException('No WhatsApp session found');
    await this.sessionService.delete(target.id);
    return { message: `Nimeondoa WhatsApp session "${target.name}" ✅`, data: { sessionId: target.id } };
  }

  private async setSafetyGuard(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.safetySettings.getGlobal();
    await this.safetySettings.updateGlobal({ aiSafetyEnabled: enabled });
    return {
      message: enabled ? 'Nimewasha WhatsApp safety guard ✅' : 'Nimezima WhatsApp safety guard ✅',
      data: { oldValue: before.aiSafetyEnabled, newValue: enabled },
    };
  }

  private async setCampaignsEnabled(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.safetySettings.getGlobal();
    await this.safetySettings.updateGlobal({ campaignsEnabled: enabled });
    return {
      message: enabled ? 'Nimewasha campaigns ✅' : 'Nimesimamisha campaigns ✅',
      data: { oldValue: before.campaignsEnabled, newValue: enabled },
    };
  }

  private async setAutopilot(enabled: boolean): Promise<AgentActionExecutionOutcome> {
    const before = await this.autopilotSettings.getSettings();
    await this.autopilotSettings.updateSettings({ enabled });
    return {
      message: enabled ? 'Nimewasha follow-up autopilot ✅' : 'Nimezima follow-up autopilot ✅',
      data: { oldValue: before.enabled, newValue: enabled },
    };
  }

  private createFollowupHint(ctx: AgentActionExecutionContext): AgentActionExecutionOutcome {
    if (!ctx.request.currentCustomerId && !ctx.request.currentChatId) {
      throw new BadRequestException('Chagua customer kwanza kwenye inbox, kisha uliza tena.');
    }
    return {
      message: 'Nenda kwenye inbox na tumia Follow-up picker kuweka follow-up kwa customer huyu.',
      data: { chatId: ctx.request.currentChatId, customerId: ctx.request.currentCustomerId },
    };
  }

  private async switchBranch(ctx: AgentActionExecutionContext): Promise<AgentActionExecutionOutcome> {
    const branchName = typeof ctx.params.branchName === 'string' ? ctx.params.branchName : undefined;
    if (!branchName) throw new BadRequestException('Taja branch, mfano: "Badilisha branch kuwa Arusha"');

    const profiles = await this.aiProfile.listProfiles();
    const normalized = branchName.toLowerCase();
    const match =
      profiles.find(p => p.branchId.toLowerCase() === normalized) ??
      profiles.find(p => p.aiDisplayName?.toLowerCase().includes(normalized)) ??
      profiles.find(p => normalized.includes(p.branchId.toLowerCase()));

    if (!match) throw new BadRequestException(`Branch "${branchName}" haikupatikana.`);

    const before = await this.inauzwaPrefs.get();
    await this.inauzwaPrefs.update({ branchId: match.branchId });
    return {
      message: `Nimebadilisha branch kuwa ${match.aiDisplayName ?? match.branchId} ✅`,
      data: { oldValue: before.branchId, newValue: match.branchId },
    };
  }

  private async retryFailedQueue(): Promise<AgentActionExecutionOutcome> {
    const failed = await this.sendQueue.list({ status: WhatsAppQueueStatus.FAILED, limit: 20 });
    let retried = 0;
    for (const item of failed) {
      const result = await this.sendQueue.retry(item.id);
      if (result) retried += 1;
    }
    return {
      message: retried ? `Nimejaribu tena messages ${retried} ✅` : 'Hakuna failed messages kwenye queue.',
      data: { retried, totalFailed: failed.length },
    };
  }

  private async createBackup(ctx: AgentActionExecutionContext): Promise<AgentActionExecutionOutcome> {
    const record = await this.backupService.create(
      { backupType: 'full' as BackupType, includeMedia: false },
      ctx.apiKeyId,
    );
    return {
      message: 'Nimeanza backup ✅',
      data: { backupId: record.id, status: record.status },
    };
  }
}
