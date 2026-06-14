import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConfig } from './entities/ai-config.entity';
import { AiChatConversation } from './entities/ai-chat-conversation.entity';
import { AiChatMessage } from './entities/ai-chat-message.entity';
import { AiSettingsService } from './ai-settings.service';
import { AiSettingsController } from './ai-settings.controller';
import { AiChatService } from './ai-chat.service';
import { AiChatController, AiChatConversationsController } from './ai-chat.controller';
import { AiChatConversationsService } from './ai-chat-conversations.service';
import { AiAppToolsService } from './ai-app-tools';
import { AiSearchService } from './ai-search.service';
import { AiInboxAutoReplyService } from './ai-inbox-auto-reply.service';
import { AiHumanTimingService } from './services/ai-human-timing.service';
import { AiInboxAgentService } from './ai-inbox-agent.service';
import { AiInboxContextService } from './ai-inbox-context.service';
import { AiCustomerToolsService } from './ai-customer-tools.service';
import { AiCircuitBreakerService } from './ai-circuit-breaker.service';
import { AiAuditService } from './ai-audit.service';
import { AiStaffWaBridgeService } from './ai-staff-wa-bridge.service';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiKnowledgeController } from './ai-knowledge.controller';
import { AiMemoryService } from './ai-memory.service';
import { AiMemoryController } from './ai-memory.controller';
import { AiMemoryFile } from './entities/ai-memory-file.entity';
import { AiMemoryChunk } from './entities/ai-memory-chunk.entity';
import { AiEmbeddingService } from './ai-embedding.service';
import { AiMemoryIndexService } from './ai-memory-index.service';
import { AiMemoryDreamScheduler } from './ai-memory-dream.scheduler';
import { AiKnowledgeFile } from './entities/ai-knowledge-file.entity';
import { AiKnowledgeChunk } from './entities/ai-knowledge-chunk.entity';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';
import { AiStatusService } from './ai-status.service';
import { AiAutoReplyMasterService } from './ai-auto-reply-master.service';
import { BranchAiProfile } from './entities/branch-ai-profile.entity';
import { BranchPaymentAccount } from './entities/branch-payment-account.entity';
import { AiEscalation } from './entities/ai-escalation.entity';
import { AiReplyEvent } from './entities/ai-reply-event.entity';
import { StockingReminder } from './entities/stocking-reminder.entity';
import { AiProfileService } from './ai-profile.service';
import { AiProfileController } from './ai-profile.controller';
import { AiSignalService } from './ai-signal.service';
import { AiSignalsController } from './ai-signals.controller';
import { AiSearchController } from './ai-search.controller';
import { AiLearningImport } from './entities/ai-learning-import.entity';
import { AiLearningItem } from './entities/ai-learning-item.entity';
import { AiLearningKnowledge } from './entities/ai-learning-knowledge.entity';
import { AiLearningSettings } from './entities/ai-learning-settings.entity';
import { ProductDemandEvent } from './entities/product-demand-event.entity';
import { ProductDemandSummary } from './entities/product-demand-summary.entity';
import { ProductAlias } from './entities/product-alias.entity';
import { MissingProductRequest } from './entities/missing-product-request.entity';
import { ProductDemandRecommendation } from './entities/product-demand-recommendation.entity';
import { ProductCatalogRequest } from './entities/product-catalog-request.entity';
import { ProductDemandCampaign } from './entities/product-demand-campaign.entity';
import { CustomerProfileEnrichment } from './entities/customer-profile-enrichment.entity';
import { CustomerProfileLearningEvent } from './entities/customer-profile-learning-event.entity';
import { LostDemandFollowup } from './entities/lost-demand-followup.entity';
import { ProductDemandCampaignService } from './product-demand-campaign.service';
import { CustomerProfileEnrichmentService } from './customer-profile-enrichment.service';
import { CustomerProfileController } from './customer-profile.controller';
import { AiLearningService } from './ai-learning.service';
import { AiLearningController } from './ai-learning.controller';
import { AiLearningItemsController } from './ai-learning-items.controller';
import { AiLearningItemsService } from './ai-learning-items.service';
import { AiLearningKnowledgeService } from './ai-learning-knowledge.service';
import { AiLearningKnowledgeFileService } from './ai-learning-knowledge-file.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { ProductDemandService } from './product-demand.service';
import { ProductDemandController } from './product-demand.controller';
import { AiLearningDashboardController } from './ai-learning-dashboard.controller';
import { AiLearningInboxService } from './ai-learning-inbox.service';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { InboxThreadSummary } from '../message/entities/inbox-thread-summary.entity';
import { Session } from '../session/entities/session.entity';
import { FollowupConversation } from '../followup/entities/followup-conversation.entity';
import { EventsModule } from '../events/events.module';
import { StatsModule } from '../stats/stats.module';
import { WebhookModule } from '../webhook/webhook.module';
import { ProductsModule } from '../products/products.module';
import { QuickReplyModule } from '../quick-reply/quick-reply.module';
import { QuoteModule } from '../quote/quote.module';
import { PluginsApiModule } from '../plugins/plugins.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';
import { SmsModule } from '../sms/sms.module';
import { SessionModule } from '../session/session.module';
import { FollowupModule } from '../followup/followup.module';
import { MessageModule } from '../message/message.module';
import { AuditModule } from '../audit/audit.module';
import { InfraModule } from '../infra/infra.module';
import { AgentActionsModule } from '../agent-actions/agent-actions.module';
import { AiProductNotFoundService } from './ai-product-not-found.service';
import { AiTrainingModule } from '../ai-training/ai-training.module';
import { AiUsageLog } from './entities/ai-usage-log.entity';
import { AiModelPricing } from './entities/ai-model-pricing.entity';
import { AiProcessedInboundMessage } from './entities/ai-processed-inbound-message.entity';
import { AiCostTrackerService } from './cost/ai-cost-tracker.service';
import { AiBudgetGuardService } from './cost/ai-budget-guard.service';
import { AiModelRouterService } from './cost/ai-model-router.service';
import { AiProcessedMessageService } from './cost/ai-processed-message.service';
import { AiUsageQueryService } from './cost/ai-usage-query.service';
import { AiUsageAdminController } from './ai-usage-admin.controller';
import { AiBudgetAdminController, AiControlAdminController } from './ai-budget-admin.controller';
import { AiCostPermissionsController } from './cost/ai-cost-permissions.controller';
import { AiCostPermissionGuard } from './cost/guards/ai-cost-permission.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        AiConfig,
        AiChatConversation,
        AiChatMessage,
        AiMemoryFile,
        AiMemoryChunk,
        AiKnowledgeFile,
        AiKnowledgeChunk,
        BranchAiProfile,
        BranchPaymentAccount,
        AiEscalation,
        AiReplyEvent,
        StockingReminder,
        InboxThreadCrm,
        InboxThreadSummary,
        Session,
        FollowupConversation,
        AiLearningImport,
        AiLearningItem,
        AiLearningKnowledge,
        AiLearningSettings,
        ProductDemandEvent,
        ProductDemandSummary,
        ProductAlias,
        MissingProductRequest,
        ProductDemandRecommendation,
        ProductCatalogRequest,
        ProductDemandCampaign,
        CustomerProfileEnrichment,
        CustomerProfileLearningEvent,
        LostDemandFollowup,
        AiUsageLog,
        AiModelPricing,
        AiProcessedInboundMessage,
      ],
      'data',
    ),
    StatsModule,
    forwardRef(() => SessionModule),
    WebhookModule,
    forwardRef(() => ProductsModule),
    forwardRef(() => FollowupModule),
    QuickReplyModule,
    QuoteModule,
    PluginsApiModule,
    forwardRef(() => MessageModule),
    forwardRef(() => WhatsAppSafetyModule),
    InfraModule,
    EventsModule,
    SmsModule,
    AuditModule,
    forwardRef(() => AgentActionsModule),
    forwardRef(() => AiTrainingModule),
  ],
  controllers: [
    AiSettingsController,
    AiChatController,
    AiChatConversationsController,
    AiKnowledgeController,
    AiMemoryController,
    AiProfileController,
    AiSignalsController,
    AiSearchController,
    AiLearningController,
    AiLearningItemsController,
    ProductDemandController,
    AiLearningDashboardController,
    CustomerProfileController,
    AiUsageAdminController,
    AiBudgetAdminController,
    AiControlAdminController,
    AiCostPermissionsController,
  ],
  providers: [
    AiCostPermissionGuard,
    AiSettingsService,
    AiChatService,
    AiChatConversationsService,
    AiAppToolsService,
    AiSearchService,
    AiInboxAutoReplyService,
    AiHumanTimingService,
    AiInboxAgentService,
    AiInboxContextService,
    AiCustomerToolsService,
    AiCircuitBreakerService,
    AiAuditService,
    AiStaffWaBridgeService,
    AiKnowledgeService,
    AiMemoryService,
    AiEmbeddingService,
    AiMemoryIndexService,
    AiMemoryDreamScheduler,
    AiKnowledgeIndexService,
    AiStatusService,
    AiAutoReplyMasterService,
    AiProfileService,
    AiSignalService,
    AiLearningService,
    AiLearningItemsService,
    AiLearningKnowledgeService,
    AiLearningKnowledgeFileService,
    AiLearningSettingsService,
    ProductDemandService,
    ProductDemandCampaignService,
    AiLearningInboxService,
    AiProductNotFoundService,
    CustomerProfileEnrichmentService,
    AiCostTrackerService,
    AiBudgetGuardService,
    AiModelRouterService,
    AiProcessedMessageService,
    AiUsageQueryService,
  ],
  exports: [
    AiSettingsService,
    AiChatService,
    AiInboxContextService,
    AiAppToolsService,
    AiChatConversationsService,
    AiProfileService,
    AiSignalService,
    AiStatusService,
    AiAutoReplyMasterService,
    AiKnowledgeService,
    AiKnowledgeIndexService,
    AiMemoryService,
    AiMemoryIndexService,
    AiLearningService,
    AiLearningItemsService,
    AiLearningKnowledgeService,
    AiLearningSettingsService,
    ProductDemandService,
    ProductDemandCampaignService,
    CustomerProfileEnrichmentService,
    AiCostTrackerService,
    AiBudgetGuardService,
    AiModelRouterService,
    AiTrainingModule,
  ],
})
export class AiModule {}
