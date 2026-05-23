import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductsService } from './products.service';
import { InauzwaSyncService } from './inauzwa-sync.service';
import { InauzwaAuthService } from './inauzwa-auth.service';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';
import { InauzwaSyncScheduler } from './inauzwa-sync.scheduler';
import { CrmInauzwaSyncSettings } from './entities/crm-inauzwa-sync-settings.entity';
import { ProductsController } from './products.controller';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product, ProductVariant, CrmInauzwaSyncSettings], 'data'),
    forwardRef(() => MessageModule),
  ],
  controllers: [ProductsController],
  providers: [
    ProductsService,
    InauzwaSyncService,
    InauzwaAuthService,
    InauzwaSyncPreferencesService,
    InauzwaSyncScheduler,
  ],
  exports: [ProductsService, InauzwaSyncService, InauzwaSyncPreferencesService],
})
export class ProductsModule {}
