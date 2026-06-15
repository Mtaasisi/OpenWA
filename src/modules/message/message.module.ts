import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageService } from './message.service';
import { BulkMessageService } from './bulk-message.service';
import { MessageController } from './message.controller';
import { InboxController } from './inbox.controller';
import { SessionModule } from '../session/session.module';
import { StorageModule } from '../../common/storage/storage.module';
import { Message } from './entities/message.entity';
import { MessageBatch } from './entities/message-batch.entity';
import { InboxThreadRead } from './entities/inbox-thread-read.entity';
import { InboxThreadCrm } from './entities/inbox-thread-crm.entity';
import { InboxThreadSummary } from './entities/inbox-thread-summary.entity';
import { InboxThreadEvent } from './entities/inbox-thread-event.entity';
import { InboxThreadPin } from './entities/inbox-thread-pin.entity';
import { InboxSavedView } from './entities/inbox-saved-view.entity';
import { InboxCrmService } from './inbox-crm.service';
import { InboxThreadSummaryService } from './inbox-thread-summary.service';
import { InboxThreadStateService } from './inbox-thread-state.service';
import { InboxSendPipelineService } from './inbox-send-pipeline.service';
import { InboxAiDiagnosisService } from './inbox-ai-diagnosis.service';
import { InboxComposeSuggestionsService } from './inbox-compose-suggestions.service';
import { InboxThreadEventService } from './inbox-thread-event.service';
import { InboxThreadPinService } from './inbox-thread-pin.service';
import { InboxSavedViewService } from './inbox-saved-view.service';
import { InboxTransferService } from './inbox-transfer.service';
import { FollowupModule } from '../followup/followup.module';
import { StorageManagementModule } from '../storage/storage.module';
import { FollowupConversation } from '../followup/entities/followup-conversation.entity';
import { AuditModule } from '../audit/audit.module';
import { ContactModule } from '../contact/contact.module';
import { AiModule } from '../ai/ai.module';
import { QuickReplyModule } from '../quick-reply/quick-reply.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        Message,
        MessageBatch,
        InboxThreadRead,
        InboxThreadCrm,
        InboxThreadSummary,
        InboxThreadEvent,
        InboxThreadPin,
        InboxSavedView,
        FollowupConversation,
      ],
      'data',
    ),
    forwardRef(() => SessionModule),
    forwardRef(() => FollowupModule),
    forwardRef(() => StorageManagementModule),
    forwardRef(() => WhatsAppSafetyModule),
    AuditModule,
    StorageModule,
    ContactModule,
    forwardRef(() => AiModule),
    QuickReplyModule,
  ],
  controllers: [MessageController, InboxController],
  providers: [
    MessageService,
    BulkMessageService,
    InboxCrmService,
    InboxTransferService,
    InboxThreadSummaryService,
    InboxThreadStateService,
    InboxSendPipelineService,
    InboxAiDiagnosisService,
    InboxComposeSuggestionsService,
    InboxThreadEventService,
    InboxThreadPinService,
    InboxSavedViewService,
  ],
  exports: [
    MessageService,
    BulkMessageService,
    InboxCrmService,
    InboxTransferService,
    InboxThreadSummaryService,
    InboxThreadStateService,
    InboxSendPipelineService,
    InboxAiDiagnosisService,
    InboxComposeSuggestionsService,
    InboxThreadEventService,
    InboxThreadPinService,
    InboxSavedViewService,
  ],
})
export class MessageModule {}
