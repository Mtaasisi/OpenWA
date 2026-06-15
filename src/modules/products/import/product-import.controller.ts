import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductImportService } from './product-import.service';
import { ProductImportPreviewDto, ProductImportExecuteDto } from '../dto/product.dto';
import { RequireRole, CurrentApiKey } from '../../auth/decorators/auth.decorators';
import { ApiKeyRole, ApiKey } from '../../auth/entities/api-key.entity';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products/import')
export class ProductImportController {
  constructor(private readonly importService: ProductImportService) {}

  @Get('template')
  @ApiOperation({ summary: 'Download product import CSV template' })
  getTemplate() {
    return { csv: this.importService.getTemplate() };
  }

  @Get('history')
  @ApiOperation({ summary: 'List recent product import batches' })
  history() {
    return this.importService.history();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get import batch details' })
  getBatch(@Param('id') id: string) {
    return this.importService.getBatch(id);
  }

  @Post('preview')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Preview and validate product import file' })
  preview(@Body() dto: ProductImportPreviewDto) {
    return this.importService.preview(dto);
  }

  @Post('execute')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Execute product import' })
  execute(@Body() dto: ProductImportExecuteDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.importService.execute(dto, apiKey.id);
  }

  @Post(':id/rollback')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Rollback import batch (created records only)' })
  rollback(@Param('id') id: string) {
    return this.importService.rollback(id);
  }
}
