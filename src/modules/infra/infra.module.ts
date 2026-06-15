import { Module } from '@nestjs/common';
import { InfraController } from './infra.controller';
import { InfraStatusService } from './infra-status.service';
import { EngineModule } from '../../engine/engine.module';
import { DockerModule } from '../docker';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [EngineModule, DockerModule, AuditModule],
  controllers: [InfraController],
  providers: [InfraStatusService],
  exports: [InfraStatusService],
})
export class InfraModule {}
