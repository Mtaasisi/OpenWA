import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsAppContactConsent } from './entities/whatsapp-contact-consent.entity';
import { WhatsAppSafetySettings } from './entities/whatsapp-safety-settings.entity';
import { WhatsAppAccountWarmup } from './entities/whatsapp-account-warmup.entity';
import { WhatsAppSendQueue } from './entities/whatsapp-send-queue.entity';
import {
  WhatsAppSessionAutomationState,
  WhatsAppSessionHealthEvent,
} from './entities/whatsapp-session-health-event.entity';
import { WhatsAppSendAudit } from './entities/whatsapp-send-audit.entity';
import { FollowupMessageTemplate } from '../followup/entities/followup-message-template.entity';
import { WhatsAppSafetySettingsService } from './services/whatsapp-safety-settings.service';
import { WhatsAppConsentService, WhatsAppServiceWindowService } from './services/whatsapp-consent.service';
import { WhatsAppSendAuditService } from './services/whatsapp-send-audit.service';
import { WhatsAppTemplateGuardService } from './services/whatsapp-template-guard.service';
import { WhatsAppPolicyGuardService } from './services/whatsapp-policy-guard.service';
import { WhatsAppWarmupService } from './services/whatsapp-warmup.service';
import { WhatsAppSessionHealthService } from './services/whatsapp-session-health.service';
import { WhatsAppSendQueueService } from './services/whatsapp-send-queue.service';
import { WhatsAppSendQueueWorker } from './services/whatsapp-send-queue.worker';
import { WhatsAppOutboundService } from './services/whatsapp-outbound.service';
import { WhatsAppCampaignPreflightService } from './services/whatsapp-campaign-preflight.service';
import { WhatsAppInboundHookService } from './services/whatsapp-inbound-hook.service';
import { AiSendPermissionService } from './services/ai-send-permission.service';
import { WhatsAppGroupSafetyService } from './services/whatsapp-group-safety.service';
import { WhatsAppStatusSafetyService } from './services/whatsapp-status-safety.service';
import { WhatsAppCloudTemplateSyncService } from './services/whatsapp-cloud-template-sync.service';
import { WhatsAppCloudOutboundService } from './services/whatsapp-cloud-outbound.service';
import { WhatsAppLinkPreflightService } from './services/whatsapp-link-preflight.service';
import { WhatsAppSafetyController } from './whatsapp-safety.controller';
import { Session } from '../session/entities/session.entity';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        WhatsAppContactConsent,
        WhatsAppSafetySettings,
        WhatsAppAccountWarmup,
        WhatsAppSendQueue,
        WhatsAppSessionHealthEvent,
        WhatsAppSessionAutomationState,
        WhatsAppSendAudit,
        FollowupMessageTemplate,
        Session,
      ],
      'data',
    ),
    AuthModule,
    EventsModule,
    forwardRef(() => MessageModule),
  ],
  controllers: [WhatsAppSafetyController],
  providers: [
    WhatsAppSafetySettingsService,
    WhatsAppConsentService,
    WhatsAppServiceWindowService,
    WhatsAppSendAuditService,
    WhatsAppTemplateGuardService,
    WhatsAppPolicyGuardService,
    WhatsAppWarmupService,
    WhatsAppSessionHealthService,
    WhatsAppSendQueueService,
    WhatsAppSendQueueWorker,
    WhatsAppOutboundService,
    WhatsAppCampaignPreflightService,
    WhatsAppInboundHookService,
    AiSendPermissionService,
    WhatsAppGroupSafetyService,
    WhatsAppStatusSafetyService,
    WhatsAppCloudTemplateSyncService,
    WhatsAppCloudOutboundService,
    WhatsAppLinkPreflightService,
  ],
  exports: [
    WhatsAppOutboundService,
    WhatsAppPolicyGuardService,
    AiSendPermissionService,
    WhatsAppConsentService,
    WhatsAppServiceWindowService,
    WhatsAppWarmupService,
    WhatsAppSessionHealthService,
    WhatsAppSendQueueService,
    WhatsAppSendAuditService,
    WhatsAppCampaignPreflightService,
    WhatsAppSafetySettingsService,
    WhatsAppGroupSafetyService,
    WhatsAppStatusSafetyService,
    WhatsAppCloudTemplateSyncService,
    WhatsAppCloudOutboundService,
  ],
})
export class WhatsAppSafetyModule {}
