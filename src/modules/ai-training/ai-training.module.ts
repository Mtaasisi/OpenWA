import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { AiLearningItem } from '../ai/entities/ai-learning-item.entity';
import { AiReplyEvent } from '../ai/entities/ai-reply-event.entity';
import { InboxThreadCrm } from '../message/entities/inbox-thread-crm.entity';
import { MessageModule } from '../message/message.module';
import { AiTrainingSuggestion } from './entities/ai-training-suggestion.entity';
import { AiTrainingApproval } from './entities/ai-training-approval.entity';
import { AiTrainingAuditLog } from './entities/ai-training-audit-log.entity';
import { AiTrainingController } from './ai-training.controller';
import { AiTrainingService } from './ai-training.service';
import { AiTrainingScanService } from './ai-training-scan.service';
import { AiTrainingQuestionGeneratorService } from './ai-training-question-generator.service';
import { AiTrainingSuggestionService } from './ai-training-suggestion.service';
import { AiTrainingApprovalService } from './ai-training-approval.service';
import { AiTrainingKnowledgeWriterService } from './ai-training-knowledge-writer.service';
import { AiTrainingMemoryWriterService } from './ai-training-memory-writer.service';
import { AiTrainingRouterService } from './ai-training-router.service';
import { AiTrainingAuditService } from './ai-training-audit.service';
import { AiTrainingReindexService } from './ai-training-reindex.service';

@Module({
  imports: [
    forwardRef(() => AiModule),
    forwardRef(() => MessageModule),
    TypeOrmModule.forFeature(
      [
        AiLearningItem,
        AiTrainingSuggestion,
        AiTrainingApproval,
        AiTrainingAuditLog,
        AiReplyEvent,
        InboxThreadCrm,
      ],
      'data',
    ),
  ],
  controllers: [AiTrainingController],
  providers: [
    AiTrainingService,
    AiTrainingScanService,
    AiTrainingQuestionGeneratorService,
    AiTrainingSuggestionService,
    AiTrainingApprovalService,
    AiTrainingKnowledgeWriterService,
    AiTrainingMemoryWriterService,
    AiTrainingRouterService,
    AiTrainingAuditService,
    AiTrainingReindexService,
  ],
  exports: [
    AiTrainingService,
    AiTrainingScanService,
    AiTrainingApprovalService,
    AiTrainingReindexService,
  ],
})
export class AiTrainingModule {}
