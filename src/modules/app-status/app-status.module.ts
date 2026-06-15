import { Module, forwardRef } from '@nestjs/common';
import { AppStatusController } from './app-status.controller';
import { AppStatusService } from './app-status.service';
import { SessionModule } from '../session/session.module';
import { AiModule } from '../ai/ai.module';
import { ProductsModule } from '../products/products.module';
import { WhatsAppSafetyModule } from '../whatsapp-safety/whatsapp-safety.module';
import { FollowupModule } from '../followup/followup.module';
import { DesktopModule } from '../desktop/desktop.module';

@Module({
  imports: [forwardRef(() => SessionModule), AiModule, ProductsModule, WhatsAppSafetyModule, FollowupModule, DesktopModule],
  controllers: [AppStatusController],
  providers: [AppStatusService],
  exports: [AppStatusService],
})
export class AppStatusModule {}
