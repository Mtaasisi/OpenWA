import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QuoteService } from './quote.service';
import { InauzwaDataService } from './inauzwa-data.service';
import {
  AddQuoteItemDto,
  ConvertQuoteDto,
  CreateChatQuoteDto,
  SendQuoteDto,
  UpdateQuoteDto,
} from './dto/quote.dto';
import { QuoteStatus, QuotePermission } from './quote.enums';
import { RequireQuotePermission, QuotePermissionGuard } from './guards/quote-permission.guard';
import { CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey } from '../auth/entities/api-key.entity';
import { getEffectiveQuotePermissions } from './utils/permissions.util';

@ApiTags('quotes')
@ApiBearerAuth()
@Controller('quotes')
@UseGuards(QuotePermissionGuard)
export class QuoteController {
  constructor(
    private readonly quoteService: QuoteService,
    private readonly inauzwaData: InauzwaDataService,
  ) {}

  @Get('permissions')
  getPermissions(@CurrentApiKey() apiKey: ApiKey) {
    return { permissions: getEffectiveQuotePermissions(apiKey) };
  }

  @Get()
  @RequireQuotePermission(QuotePermission.VIEW_QUOTES)
  @ApiOperation({ summary: 'List quotes (filter by chat thread or branch)' })
  list(
    @Query('sessionId') sessionId?: string,
    @Query('chatId') chatId?: string,
    @Query('branchId') branchId?: string,
    @Query('status') status?: QuoteStatus,
  ) {
    return this.quoteService.list({ sessionId, chatId, branchId, status });
  }

  @Get('inauzwa/customers/search')
  @RequireQuotePermission(QuotePermission.VIEW_QUOTES)
  @ApiOperation({ summary: 'Search INAUZWA customers (when sync enabled)' })
  searchCustomers(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.inauzwaData.searchCustomers(q ?? '', limit ? Number(limit) : 20);
  }

  @Get('inauzwa/customers/:customerId/proformas')
  @RequireQuotePermission(QuotePermission.VIEW_QUOTES)
  listProformas(@Param('customerId') customerId: string) {
    return this.inauzwaData.listProformasForCustomer(customerId);
  }

  @Get('inauzwa/customers/:customerId/sales')
  @RequireQuotePermission(QuotePermission.VIEW_QUOTES)
  listSales(@Param('customerId') customerId: string) {
    return this.inauzwaData.listRecentSalesForCustomer(customerId);
  }

  @Get(':id')
  @RequireQuotePermission(QuotePermission.VIEW_QUOTES)
  findOne(@Param('id') id: string) {
    return this.quoteService.findOne(id);
  }

  @Get(':id/preview-message')
  @RequireQuotePermission(QuotePermission.VIEW_QUOTES)
  previewMessage(@Param('id') id: string) {
    return this.quoteService.previewMessage(id);
  }

  @Post('chat')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  @ApiOperation({ summary: 'Create a draft quote from WhatsApp chat context' })
  createFromChat(@Body() dto: CreateChatQuoteDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.quoteService.createFromChat(dto, apiKey);
  }

  @Patch(':id')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.quoteService.update(id, dto, apiKey);
  }

  @Post(':id/items')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  addItem(
    @Param('id') id: string,
    @Body() dto: AddQuoteItemDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.quoteService.addItem(id, dto, apiKey);
  }

  @Delete(':id/items/:itemId')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.quoteService.removeItem(id, itemId);
  }

  @Patch(':id/delivery-fee')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  setDeliveryFee(@Param('id') id: string, @Body('deliveryFee') deliveryFee: number) {
    return this.quoteService.setDeliveryFee(id, Number(deliveryFee) || 0);
  }

  @Post(':id/send')
  @RequireQuotePermission(QuotePermission.SEND_CHAT_QUOTE)
  send(@Param('id') id: string, @Body() dto: SendQuoteDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.quoteService.send(id, dto, apiKey);
  }

  @Post(':id/notify-sms')
  @RequireQuotePermission(QuotePermission.SEND_CHAT_QUOTE)
  @ApiOperation({ summary: 'Send short quote ready notification via SMS' })
  notifyBySms(@Param('id') id: string, @CurrentApiKey() apiKey: ApiKey) {
    return this.quoteService.notifyBySms(id, apiKey);
  }

  @Post(':id/accept')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  accept(@Param('id') id: string) {
    return this.quoteService.setStatus(id, QuoteStatus.ACCEPTED);
  }

  @Post(':id/reject')
  @RequireQuotePermission(QuotePermission.CREATE_CHAT_QUOTE)
  reject(@Param('id') id: string) {
    return this.quoteService.setStatus(id, QuoteStatus.REJECTED);
  }

  @Post(':id/convert')
  @RequireQuotePermission(QuotePermission.CONVERT_QUOTE_TO_SALE)
  convert(@Param('id') id: string, @Body() dto: ConvertQuoteDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.quoteService.convertToSale(id, dto, apiKey);
  }
}
