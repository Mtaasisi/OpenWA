import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuickReplyTemplate } from './entities/quick-reply-template.entity';
import { QuickReplyService } from './quick-reply.service';
import { QuickReplyController } from './quick-reply.controller';
import { QuickReplyPermissionGuard } from './guards/quick-reply-permission.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([QuickReplyTemplate], 'data'), AuthModule],
  controllers: [QuickReplyController],
  providers: [QuickReplyService, QuickReplyPermissionGuard],
  exports: [QuickReplyService],
})
export class QuickReplyModule {}
