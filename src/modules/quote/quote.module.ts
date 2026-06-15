import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteItem } from './entities/quote-item.entity';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { QuotePermissionGuard } from './guards/quote-permission.guard';
import { InauzwaSaleService } from './inauzwa-sale.service';
import { InauzwaDataService } from './inauzwa-data.service';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { ProductsModule } from '../products/products.module';
import { MessageModule } from '../message/message.module';
import { FollowupModule } from '../followup/followup.module';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteItem, Product, ProductVariant], 'data'),
    ProductsModule,
    forwardRef(() => MessageModule),
    forwardRef(() => FollowupModule),
    AuthModule,
    SmsModule,
  ],
  controllers: [QuoteController],
  providers: [QuoteService, InauzwaSaleService, InauzwaDataService, QuotePermissionGuard],
  exports: [QuoteService, InauzwaDataService],
})
export class QuoteModule {}
