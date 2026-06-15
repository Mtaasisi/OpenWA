import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { ProductImportBatch } from './entities/product-import-batch.entity';
import { ProductImportRow } from './entities/product-import-row.entity';
import { ProductAuditEvent } from './entities/product-audit-event.entity';
import { ProductsService } from './products.service';
import { InventoryItemService } from './inventory-item.service';
import { ProductHealthService } from './product-health.service';
import { ProductValidationService } from './product-validation.service';
import { ProductAuditService } from './product-audit.service';
import { InauzwaSyncService } from './inauzwa-sync.service';
import { InauzwaAuthService } from './inauzwa-auth.service';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';
import { InauzwaSyncScheduler } from './inauzwa-sync.scheduler';
import { CrmInauzwaSyncSettings } from './entities/crm-inauzwa-sync-settings.entity';
import { ProductsController } from './products.controller';
import { ProductImportController } from './import/product-import.controller';
import { ProductImportService } from './import/product-import.service';
import { ProductImportParserService } from './import/product-import-parser.service';
import { ProductImportMappingService } from './import/product-import-mapping.service';
import { ProductImportValidationService } from './import/product-import-validation.service';
import { ProductImportExecutorService } from './import/product-import-executor.service';
import { ProductImportRollbackService } from './import/product-import-rollback.service';
import { MessageModule } from '../message/message.module';
import { FollowupModule } from '../followup/followup.module';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [
        Product,
        ProductVariant,
        InventoryItem,
        ProductImportBatch,
        ProductImportRow,
        ProductAuditEvent,
        CrmInauzwaSyncSettings,
      ],
      'data',
    ),
    forwardRef(() => MessageModule),
    forwardRef(() => FollowupModule),
    forwardRef(() => AiModule),
    AuditModule,
    EventsModule,
  ],
  controllers: [ProductsController, ProductImportController],
  providers: [
    ProductsService,
    InventoryItemService,
    ProductHealthService,
    ProductValidationService,
    ProductAuditService,
    ProductImportService,
    ProductImportParserService,
    ProductImportMappingService,
    ProductImportValidationService,
    ProductImportExecutorService,
    ProductImportRollbackService,
    InauzwaSyncService,
    InauzwaAuthService,
    InauzwaSyncPreferencesService,
    InauzwaSyncScheduler,
  ],
  exports: [
    ProductsService,
    InventoryItemService,
    ProductHealthService,
    InauzwaSyncService,
    InauzwaSyncPreferencesService,
  ],
})
export class ProductsModule {}
