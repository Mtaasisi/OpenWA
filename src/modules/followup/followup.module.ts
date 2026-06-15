import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FollowupConversation } from './entities/followup-conversation.entity';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import { FollowupRule } from './entities/followup-rule.entity';
import { FollowupQueueItem } from './entities/followup-queue-item.entity';
import { FollowupAttempt } from './entities/followup-attempt.entity';
import { FollowupStaffKpi } from './entities/followup-staff-kpi.entity';
import { CrmSaleAttribution } from './entities/crm-sale-attribution.entity';
import { FollowupAutopilotSettings } from './entities/followup-autopilot-settings.entity';
import { FollowupAutopilotAudit } from './entities/followup-autopilot-audit.entity';
import { Quote } from '../quote/entities/quote.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { Message } from '../message/entities/message.entity';
import { Session } from '../session/entities/session.entity';
import { FollowupConversationService } from './followup-conversation.service';
import { FollowupTemplateService } from './followup-template.service';
import { FollowupRuleService } from './followup-rule.service';
import { FollowupQueueService } from './followup-queue.service';
import { FollowupEngineService } from './followup-engine.service';
import { FollowupSchedulerService } from './followup-scheduler.service';
import { FollowupKpiService } from './followup-kpi.service';
import { FollowupHookService } from './followup-hook.service';
import { PipelineService } from './pipeline.service';
import { SaleAttributionService } from './sale-attribution.service';
import { FollowupController } from './followup.controller';
import { FollowUpPermissionGuard } from './guards/followup-permission.guard';
import { FollowupAiService } from './followup-ai.service';
import { FollowupAutopilotSettingsService } from './followup-autopilot-settings.service';
import { FollowupAutopilotDecisionService } from './followup-autopilot-decision.service';
import { FollowupAutopilotOrchestratorService } from './followup-autopilot-orchestrator.service';
import { FollowupAutopilotChannelService } from './followup-autopilot-channel.service';
import { FollowupAutopilotAuditService } from './followup-autopilot-audit.service';
import { FollowupAutopilotReportService } from './followup-autopilot-report.service';
import { MessageModule } from '../message/message.module';
import { HooksModule } from '../../core/hooks';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { SmsModule } from '../sms/sms.module';
import { AiModule } from '../ai/ai.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        FollowupConversation,
        FollowupMessageTemplate,
        FollowupRule,
        FollowupQueueItem,
        FollowupAttempt,
        FollowupStaffKpi,
        CrmSaleAttribution,
        FollowupAutopilotSettings,
        FollowupAutopilotAudit,
        InboxThreadCrm,
        Message,
        Quote,
        Session,
      ],
      'data',
    ),
    forwardRef(() => MessageModule),
    forwardRef(() => AiModule),
    HooksModule,
    AuthModule,
    AuditModule,
    SmsModule,
    WhatsAppSafetyModule,
  ],
  controllers: [FollowupController],
  providers: [
    FollowupConversationService,
    FollowupTemplateService,
    FollowupRuleService,
    FollowupQueueService,
    FollowupEngineService,
    FollowupSchedulerService,
    FollowupKpiService,
    FollowupHookService,
    PipelineService,
    SaleAttributionService,
    FollowUpPermissionGuard,
    FollowupAiService,
    FollowupAutopilotSettingsService,
    FollowupAutopilotDecisionService,
    FollowupAutopilotOrchestratorService,
    FollowupAutopilotChannelService,
    FollowupAutopilotAuditService,
    FollowupAutopilotReportService,
  ],
  exports: [
    FollowupConversationService,
    FollowupQueueService,
    FollowupRuleService,
    FollowupTemplateService,
    FollowupEngineService,
    FollowupHookService,
    PipelineService,
    SaleAttributionService,
    FollowupKpiService,
    FollowupAutopilotSettingsService,
    FollowupAutopilotReportService,
  ],
})
export class FollowupModule {}
