import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { ProductDemandService } from './product-demand.service';
import { ProductDemandCampaignService } from './product-demand-campaign.service';
import { ProductDemandCampaignChannel } from './product-demand.enums';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKeyRole, ApiKey } from '../auth/entities/api-key.entity';
import { ProductDemandIntent } from './product-demand.enums';

class MapMissingDto {
  @IsString() productId: string;
  @IsOptional() @IsString() variantId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) aliasNames?: string[];
}

class AliasDto {
  @IsString() @MinLength(1) aliasText: string;
  @IsString() productId: string;
  @IsOptional() @IsString() variantId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
}

class StockingDto {
  @IsOptional() @IsString() productId?: string;
  @IsOptional() @IsString() productName?: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsString() chatId?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() note?: string;
}

class RecActionDto {
  @IsString() action: 'accept' | 'task' | 'campaign' | 'stocking' | 'done';
}

class UpdateCampaignDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() sessionId?: string;
}

class SendCampaignDto {
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsString() templateId?: string;
}

class CampaignSafetyPreflightDto {
  @IsOptional() @IsString() sessionId?: string;
  @IsOptional() @IsString() templateId?: string;
}

class LinkProductRequestDto {
  @IsString() productId: string;
}

class UpdateProductRequestDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() assignedStaffId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() priority?: string;
}

class ProductRequestDto {
  @IsString() @MinLength(1) productName: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() suggestedSpecs?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() customerCount?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) exampleMessages?: string[];
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() assignedStaffId?: string;
  @IsOptional() @IsString() dueDate?: string;
  @IsOptional() @IsString() missingProductRequestId?: string;
  @IsOptional() createStockingReminder?: boolean;
}

@ApiTags('product-demand')
@Controller('product-demand')
export class ProductDemandController {
  constructor(
    private readonly demand: ProductDemandService,
    private readonly campaigns: ProductDemandCampaignService,
  ) {}

  @Get('overview')
  overview() {
    return this.demand.getOverview();
  }

  @Post('backfill-summaries')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Rebuild demand summaries from stored events' })
  backfillSummaries() {
    return this.demand.backfillSummariesFromEvents();
  }

  @Get('items')
  listItems(
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('intent') intent?: ProductDemandIntent,
    @Query('matched') matched?: 'matched' | 'unmatched',
    @Query('installmentOnly') installmentOnly?: string,
    @Query('discountOnly') discountOnly?: string,
    @Query('paymentReadyOnly') paymentReadyOnly?: string,
    @Query('trendingOnly') trendingOnly?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.demand.listSummaries({
      branchId,
      category,
      brand,
      intent,
      matched,
      installmentOnly: installmentOnly === 'true',
      discountOnly: discountOnly === 'true',
      paymentReadyOnly: paymentReadyOnly === 'true',
      trendingOnly: trendingOnly === 'true',
      from,
      to,
    });
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.demand.getSummaryDetail(id);
  }

  @Get('missing')
  listMissing(@Query('status') status?: string) {
    return this.demand.listMissing(status as never);
  }

  @Get('missing/:id')
  getMissing(@Param('id') id: string) {
    return this.demand.getMissingDetail(id);
  }

  @Post('missing/:id/map')
  @RequireRole(ApiKeyRole.OPERATOR)
  mapMissing(
    @Param('id') id: string,
    @Body() body: MapMissingDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.demand.mapMissing(id, { ...body, createdBy: key.id });
  }

  @Post('missing/:id/ignore')
  @RequireRole(ApiKeyRole.OPERATOR)
  ignoreMissing(@Param('id') id: string) {
    return this.demand.ignoreMissing(id);
  }

  @Post('alias')
  @RequireRole(ApiKeyRole.OPERATOR)
  addAlias(@Body() body: AliasDto, @CurrentApiKey() key: ApiKey) {
    return this.demand.addAlias({ ...body, createdBy: key.id });
  }

  @Post('stocking-reminder')
  @RequireRole(ApiKeyRole.OPERATOR)
  stocking(@Body() body: StockingDto) {
    return this.demand.createStockingReminder(body);
  }

  @Post('product-request')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create new product catalog request from demand' })
  createProductRequest(
    @Body() body: ProductRequestDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.demand.createProductRequest({
      ...body,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      createdBy: key.id,
    });
  }

  @Get('product-requests')
  listProductRequests(@Query('status') status?: string) {
    return this.demand.listProductRequests(status);
  }

  @Get('product-requests/:id')
  getProductRequest(@Param('id') id: string) {
    return this.demand.getProductRequest(id);
  }

  @Post('product-requests/:id/link-product')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Link catalog request to an existing product and mark done' })
  linkProductRequest(@Param('id') id: string, @Body() body: LinkProductRequestDto) {
    return this.demand.linkProductRequestToCatalog(id, body.productId);
  }

  @Patch('product-requests/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  updateProductRequest(@Param('id') id: string, @Body() body: UpdateProductRequestDto) {
    return this.demand.updateProductRequest(id, {
      ...body,
      dueDate:
        body.dueDate !== undefined
          ? body.dueDate
            ? new Date(body.dueDate)
            : null
          : undefined,
    });
  }

  @Get('recommendations')
  recommendations() {
    return this.demand.listRecommendations();
  }

  @Post('recommendations/:id/action')
  @RequireRole(ApiKeyRole.OPERATOR)
  recAction(
    @Param('id') id: string,
    @Body() body: RecActionDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.demand.recommendationAction(id, body.action, key.id);
  }

  @Get('campaigns')
  listCampaigns() {
    return this.campaigns.listCampaigns();
  }

  @Get('campaigns/metrics')
  campaignMetrics() {
    return this.campaigns.getCampaignMetrics();
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.campaigns.getCampaign(id);
  }

  @Patch('campaigns/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  updateCampaign(@Param('id') id: string, @Body() body: UpdateCampaignDto) {
    return this.campaigns.updateCampaign(id, body);
  }

  @Post('campaigns/:id/safety-preflight')
  @RequireRole(ApiKeyRole.OPERATOR)
  safetyPreflight(@Param('id') id: string, @Body() body: CampaignSafetyPreflightDto) {
    return this.campaigns.safetyPreflight(id, body);
  }

  @Post('campaigns/:id/approve-launch')
  @RequireRole(ApiKeyRole.ADMIN)
  approveLaunch(@Param('id') id: string, @CurrentApiKey() key: ApiKey) {
    return this.campaigns.approveLaunch(id, key);
  }

  @Post('campaigns/:id/send')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Send product demand outreach campaign via SMS or WhatsApp' })
  sendCampaign(
    @Param('id') id: string,
    @Body() body: SendCampaignDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.campaigns.sendCampaign(id, key, {
      channel: body.channel as ProductDemandCampaignChannel | undefined,
      sessionId: body.sessionId,
      templateId: body.templateId,
    });
  }

  @Post('recommendations/:id/dismiss')
  @RequireRole(ApiKeyRole.OPERATOR)
  dismiss(@Param('id') id: string) {
    return this.demand.dismissRecommendation(id);
  }
}
