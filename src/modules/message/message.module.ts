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
import { InboxCrmService } from './inbox-crm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageBatch, InboxThreadRead, InboxThreadCrm], 'data'),
    forwardRef(() => SessionModule),
    StorageModule,
  ],
  controllers: [MessageController, InboxController],
  providers: [MessageService, BulkMessageService, InboxCrmService],
  exports: [MessageService, BulkMessageService, InboxCrmService],
})
export class MessageModule {}
