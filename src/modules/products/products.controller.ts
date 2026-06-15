import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { InauzwaSyncService } from './inauzwa-sync.service';
import { InauzwaAuthService } from './inauzwa-auth.service';
import {
  CreateProductDto,
  UpdateProductDto,
  CreateVariantDto,
  UpdateVariantDto,
  SendProductMessageDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  BulkPasteInventoryDto,
  GenerateVariantsDto,
  InauzwaSyncDto,
  UpdateInauzwaSyncPreferencesDto,
  TestInauzwaConnectionDto,
  InauzwaLoginDto,
  InauzwaSupabaseSessionDto,
} from './dto/product.dto';
import { InauzwaSyncPreferencesService } from './inauzwa-sync-preferences.service';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKeyRole, ApiKey } from '../auth/entities/api-key.entity';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly inauzwaSyncService: InauzwaSyncService,
    private readonly inauzwaPreferences: InauzwaSyncPreferencesService,
    private readonly inauzwaAuth: InauzwaAuthService,
  ) {}

  @Get('sync/inauzwa/status')
  @ApiOperation({ summary: 'INAUZWA import configuration status' })
  inauzwaStatus() {
    return this.inauzwaSyncService.getStatus();
  }

  @Get('sync/inauzwa/branches')
  @ApiOperation({ summary: 'List INAUZWA branches (requires database URL)' })
  listInauzwaBranches() {
    return this.inauzwaSyncService.listBranches();
  }

  @Patch('sync/inauzwa/settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Save INAUZWA sync preferences (branch, auto-sync, etc.)' })
  updateInauzwaSettings(@Body() dto: UpdateInauzwaSyncPreferencesDto) {
    return this.inauzwaPreferences.update(dto);
  }

  @Patch('sync/inauzwa/connection')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Save INAUZWA inventory connection (database URL or API token)' })
  async updateInauzwaConnection(@Body() dto: UpdateInauzwaSyncPreferencesDto) {
    const result = await this.inauzwaPreferences.update({
      databaseUrl: dto.databaseUrl,
      apiUrl: dto.apiUrl,
      apiToken: dto.apiToken,
      currency: dto.currency,
      clearConnection: dto.clearConnection,
    });
    this.inauzwaSyncService.resetConnectionPool();
    return result;
  }

  @Post('sync/inauzwa/login')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Sign in to INAUZWA and save API connection + branch/vendor' })
  async loginInauzwa(@Body() dto: InauzwaLoginDto) {
    const result = await this.inauzwaAuth.login(dto);
    this.inauzwaSyncService.resetConnectionPool();
    return result;
  }

  @Post('sync/inauzwa/login/supabase-session')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Save INAUZWA connection after browser Supabase sign-in' })
  async completeInauzwaSupabaseSession(@Body() dto: InauzwaSupabaseSessionDto) {
    const result = await this.inauzwaAuth.completeSupabaseSession(dto);
    this.inauzwaSyncService.resetConnectionPool();
    return result;
  }

  @Post('sync/inauzwa/test-connection')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Test INAUZWA database or API connection' })
  testInauzwaConnection(@Body() dto: TestInauzwaConnectionDto) {
    return this.inauzwaSyncService.testConnection(dto);
  }

  @Post('sync/inauzwa/quick')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Quick merge sync using saved branch settings' })
  quickSyncInauzwa() {
    return this.inauzwaSyncService.quickSync();
  }

  @Post('sync/inauzwa')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Import or update products from INAUZWA (database or API)' })
  syncInauzwa(@Body() dto: InauzwaSyncDto) {
    return this.inauzwaSyncService.sync(dto);
  }

  @Get('health/summary')
  @ApiOperation({ summary: 'Product catalog health summary' })
  healthSummary() {
    return this.productsService.getHealthSummary();
  }

  @Get('catalog/stats')
  @ApiOperation({ summary: 'Catalog-wide inventory stats (unfiltered by search)' })
  catalogStats(@Query('activeOnly') activeOnly?: string) {
    return this.productsService.catalogStats({
      activeOnly: activeOnly !== 'false',
    });
  }

  @Get()
  @ApiOperation({ summary: 'List CRM products with stock summary' })
  list(
    @Query('q') q?: string,
    @Query('inStockOnly') inStockOnly?: string,
    @Query('activeOnly') activeOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = limit != null ? Number(limit) : undefined;
    return this.productsService.list({
      q,
      inStockOnly: inStockOnly === 'true',
      activeOnly: activeOnly !== 'false',
      limit: parsedLimit != null && !Number.isNaN(parsedLimit) ? parsedLimit : undefined,
      offset: offset != null ? Number(offset) : undefined,
    });
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Product health check' })
  productHealth(@Param('id') id: string) {
    return this.productsService.getProductHealth(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Product audit history' })
  productHistory(@Param('id') id: string) {
    return this.productsService.getProductHistory(id);
  }

  @Get(':id/inventory-items')
  @ApiOperation({ summary: 'List inventory items for product' })
  listInventory(
    @Param('id') id: string,
    @Query('variantId') variantId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.productsService.listInventoryItems(id, { variantId, branchId, status, q });
  }

  @Post(':id/inventory-items')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Add inventory item (IMEI/serial)' })
  createInventory(@Param('id') id: string, @Body() dto: CreateInventoryItemDto) {
    return this.productsService.createInventoryItem(id, dto);
  }

  @Patch(':id/inventory-items/:itemId')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update inventory item' })
  updateInventory(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.productsService.updateInventoryItem(id, itemId, dto);
  }

  @Delete(':id/inventory-items/:itemId')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Deactivate inventory item' })
  deleteInventory(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.productsService.deleteInventoryItem(id, itemId);
  }

  @Post(':id/inventory-items/bulk-paste')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Bulk paste IMEI/serial list' })
  bulkPasteInventory(@Param('id') id: string, @Body() dto: BulkPasteInventoryDto) {
    return this.productsService.bulkPasteInventory(id, dto);
  }

  @Post(':id/variants/generate')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Generate variant matrix' })
  generateVariants(@Param('id') id: string, @Body() dto: GenerateVariantsDto) {
    return this.productsService.generateVariants(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product with variants' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product and its variants' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.productsService.remove(id);
  }

  @Post(':id/variants')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Add a variant (standard, parent, or IMEI child)' })
  addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch(':productId/variants/:variantId')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update a variant' })
  updateVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productsService.updateVariant(productId, variantId, dto);
  }

  @Delete(':productId/variants/:variantId')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete a variant (and its IMEI children if parent)' })
  removeVariant(
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.productsService.removeVariant(productId, variantId);
  }

  @Get(':id/preview-message')
  @ApiOperation({ summary: 'Preview WhatsApp message text for a product' })
  previewMessage(
    @Param('id') id: string,
    @Query('variantId') variantId?: string,
    @Query('includeAllVariants') includeAllVariants?: string,
    @Query('includeAvailableDevices') includeAvailableDevices?: string,
    @Query('inStockOnly') inStockOnly?: string,
  ) {
    return this.productsService.previewMessage(id, {
      variantId,
      includeAllVariants: includeAllVariants !== 'false',
      includeAvailableDevices: includeAvailableDevices === 'true',
      inStockOnly: inStockOnly !== 'false',
    });
  }

  @Post(':id/send')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send product details to a WhatsApp chat' })
  send(@Param('id') id: string, @Body() dto: SendProductMessageDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.productsService.sendToChat(id, dto, apiKey);
  }
}
