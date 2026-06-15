import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentActionAuditLog } from './entities/agent-action-audit-log.entity';
import { AgentActionConfirmation } from './entities/agent-action-confirmation.entity';
import { AgentActionSettings } from './entities/agent-action-settings.entity';
import { AgentActionController } from './agent-action.controller';
import { AgentActionRegistryService } from './agent-action-registry.service';
import { AgentActionMatcherService } from './agent-action-matcher.service';
import { AgentActionLlmMatcherService } from './agent-action-llm-matcher.service';
import { AgentActionPermissionService } from './agent-action-permission.service';
import { AgentActionRiskService } from './agent-action-risk.service';
import { AgentActionConfirmationService } from './agent-action-confirmation.service';
import { AgentActionAuditService } from './agent-action-audit.service';
import { AgentActionLinkService } from './agent-action-link.service';
import { AgentActionDiagnosticService } from './agent-action-diagnostic.service';
import { AgentActionExecutorService } from './agent-action-executor.service';
import { AgentActionRouterService } from './agent-action-router.service';
import { AgentActionSettingsService } from './agent-action-settings.service';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';
import { FollowupModule } from '../followup/followup.module';
import { ProductsModule } from '../products/products.module';
import { BackupModule } from '../backup/backup.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [AgentActionAuditLog, AgentActionConfirmation, AgentActionSettings],
      'data',
    ),
    AuditModule,
    forwardRef(() => AiModule),
    WhatsAppSafetyModule,
    forwardRef(() => FollowupModule),
    forwardRef(() => ProductsModule),
    BackupModule,
    forwardRef(() => SessionModule),
  ],
  controllers: [AgentActionController],
  providers: [
    AgentActionRegistryService,
    AgentActionMatcherService,
    AgentActionLlmMatcherService,
    AgentActionPermissionService,
    AgentActionRiskService,
    AgentActionConfirmationService,
    AgentActionAuditService,
    AgentActionLinkService,
    AgentActionDiagnosticService,
    AgentActionExecutorService,
    AgentActionRouterService,
    AgentActionSettingsService,
  ],
  exports: [AgentActionRouterService, AgentActionRegistryService, AgentActionSettingsService],
})
export class AgentActionsModule {}
