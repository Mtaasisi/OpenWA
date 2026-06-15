import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { SendProductDto, SendCatalogDto, ProductQueryDto } from './dto/send-product.dto';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKeyRole, type ApiKey } from '../auth/entities/api-key.entity';

@ApiTags('Catalog')
@ApiBearerAuth()
@Controller('sessions/:sessionId')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('catalog')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get business catalog info' })
  async getCatalog(@Param('sessionId') sessionId: string) {
    return this.catalogService.getCatalog(sessionId);
  }

  @Get('catalog/products')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List catalog products' })
  async getProducts(@Param('sessionId') sessionId: string, @Query() query: ProductQueryDto) {
    return this.catalogService.getProducts(sessionId, query.page, query.limit);
  }

  @Get('catalog/products/:productId')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get a specific product' })
  async getProduct(@Param('sessionId') sessionId: string, @Param('productId') productId: string) {
    return this.catalogService.getProduct(sessionId, productId);
  }

  @Post('messages/send-product')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send a product message' })
  async sendProduct(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendProductDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.catalogService.sendProduct(sessionId, dto.chatId, dto.productId, dto.body, apiKey.id);
  }

  @Post('messages/send-catalog')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send catalog link' })
  async sendCatalog(
    @Param('sessionId') sessionId: string,
    @Body() dto: SendCatalogDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.catalogService.sendCatalog(sessionId, dto.chatId, dto.body, apiKey.id);
  }
}
