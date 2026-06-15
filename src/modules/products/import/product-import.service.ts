import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductImportBatch } from '../entities/product-import-batch.entity';
import { ProductImportParserService } from './product-import-parser.service';
import { ProductImportMappingService } from './product-import-mapping.service';
import { ProductImportValidationService } from './product-import-validation.service';
import { ProductImportExecutorService } from './product-import-executor.service';
import { ProductImportRollbackService } from './product-import-rollback.service';
import type { ProductImportPreviewDto, ProductImportExecuteDto } from '../dto/product.dto';

@Injectable()
export class ProductImportService {
  constructor(
    @InjectRepository(ProductImportBatch, 'data')
    private readonly batchRepo: Repository<ProductImportBatch>,
    private readonly parser: ProductImportParserService,
    private readonly mapping: ProductImportMappingService,
    private readonly validation: ProductImportValidationService,
    private readonly executor: ProductImportExecutorService,
    private readonly rollbackService: ProductImportRollbackService,
  ) {}

  getTemplate(): string {
    return this.parser.getTemplateCsv();
  }

  async preview(dto: ProductImportPreviewDto) {
    const content = Buffer.from(dto.fileContentBase64, 'base64').toString('utf8');
    const parsed =
      dto.fileType === 'xlsx'
        ? this.parser.parseXlsxBase64(dto.fileContentBase64)
        : this.parser.parseCsv(content);

    const columnMapping = dto.columnMapping ?? this.mapping.autoMap(parsed.headers);
    const mappedRows = parsed.rows.map((row) => ({
      rowNumber: row.rowNumber,
      mapped: this.applyMapping(row.data, columnMapping),
    }));

    const validated = await this.validation.validateRows(mappedRows, dto.importType);

    return {
      headers: parsed.headers,
      columnMapping,
      rows: validated,
      summary: {
        total: validated.length,
        valid: validated.filter((r) => r.status === 'valid').length,
        warning: validated.filter((r) => r.status === 'warning').length,
        error: validated.filter((r) => r.status === 'error').length,
      },
    };
  }

  async execute(dto: ProductImportExecuteDto, createdBy?: string) {
    const preview = await this.preview(dto);
    const dryRun = dto.mode === 'dry_run';

    const batch = this.batchRepo.create({
      branchId: dto.branchId ?? null,
      fileName: dto.fileName,
      fileType: dto.fileType,
      importType: dto.importType,
      mode: dto.mode,
      status: 'running',
      totalRows: preview.summary.total,
      validRows: preview.summary.valid,
      warningRows: preview.summary.warning,
      errorRows: preview.summary.error,
      createdBy: createdBy ?? null,
    });
    await this.batchRepo.save(batch);

    const result = await this.executor.execute(batch, preview.rows, dryRun);

    batch.status = dryRun ? 'completed' : 'completed';
    batch.createdCount = result.createdCount;
    batch.updatedCount = result.updatedCount;
    batch.skippedCount = result.skippedCount;
    batch.completedAt = new Date();
    await this.batchRepo.save(batch);

    return { batchId: batch.id, ...result, dryRun, preview: preview.summary };
  }

  async history(limit = 20) {
    return this.batchRepo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async getBatch(id: string) {
    return this.batchRepo.findOne({ where: { id } });
  }

  rollback(id: string) {
    return this.rollbackService.rollback(id);
  }

  private applyMapping(
    row: Record<string, string>,
    mapping: Record<string, string>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [field, header] of Object.entries(mapping)) {
      if (header && row[header] !== undefined) out[field] = row[header];
    }
    return out;
  }
}
