import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [AuditModule, forwardRef(() => SessionModule)],
  controllers: [PluginsController],
  providers: [PluginsService],
  exports: [PluginsService],
})
export class PluginsApiModule {}
