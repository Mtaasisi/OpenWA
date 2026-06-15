import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { AiTrainingService } from './ai-training.service';
import { AiTrainingApprovalService } from './ai-training-approval.service';
import {
  AiTrainingIssueType,
  AiTrainingSourceType,
  AiTrainingUpdateMode,
} from './ai-training.types';

class ManualTrainingDto {
  @IsString() @MinLength(1) question: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() sourceType?: AiTrainingSourceType;
  @IsOptional() @IsString() issueType?: AiTrainingIssueType;
  @IsOptional() @IsString() suggestedTargetFile?: string;
  @IsOptional() @IsString() customInstruction?: string;
}

class PreviewApprovalDto {
  @IsOptional() @IsString() selectedSuggestionId?: string;
  @IsOptional() @IsString() customAnswer?: string;
  @IsOptional() @IsString() customInstruction?: string;
  @IsOptional() @IsString() targetFile?: string;
  @IsOptional() @IsString() targetSection?: string;
  @IsOptional() @IsString() updateMode?: AiTrainingUpdateMode;
}

class ApproveDto extends PreviewApprovalDto {
  @IsOptional() @IsBoolean() applyNow?: boolean;
}

class BulkIdsDto {
  @IsArray() @IsString({ each: true }) ids: string[];
}

class BulkApproveOverrideDto {
  @IsString() id: string;
  @IsOptional() @IsString() customAnswer?: string;
  @IsOptional() @IsString() selectedSuggestionId?: string;
}

class BulkApproveDto {
  @IsArray() @IsString({ each: true }) ids: string[];
  @IsOptional() @IsBoolean() applyNow?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkApproveOverrideDto)
  overrides?: BulkApproveOverrideDto[];
}

class ReindexDto {
  @IsOptional() @IsBoolean() includeMemory?: boolean;
}

@ApiTags('ai-training')
@Controller('ai-training')
export class AiTrainingController {
  constructor(
    private readonly training: AiTrainingService,
    private readonly approval: AiTrainingApprovalService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Training Center overview KPIs' })
  overview() {
    return this.training.getOverview();
  }

  @Get('items')
  listItems(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
    @Query('sourceType') sourceType?: string,
    @Query('issueType') issueType?: string,
    @Query('priority') priority?: string,
  ) {
    return this.training.listItems({
      status: status as never,
      search,
      branchId,
      sourceType,
      issueType,
      priority,
    });
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.training.getItemDetail(id);
  }

  @Post('items')
  @RequireRole(ApiKeyRole.OPERATOR)
  createManual(@Body() body: ManualTrainingDto, @CurrentApiKey() key: ApiKey) {
    return this.training.createManualItem({
      question: body.question,
      title: body.title,
      sourceType: body.sourceType ?? AiTrainingSourceType.MANUAL_ADMIN_NOTE,
      issueType: body.issueType ?? AiTrainingIssueType.ADMIN_MANUAL_TRAINING,
      suggestedTargetFile: body.suggestedTargetFile,
      metadata: body.customInstruction ? { customInstruction: body.customInstruction } : null,
      createdByAi: false,
    });
  }

  @Post('scan/inbox')
  @RequireRole(ApiKeyRole.OPERATOR)
  scanInbox(@Query('days') days?: string) {
    return this.training.scanInbox({ days: days ? Number(days) : undefined });
  }

  @Post('scan/system')
  @RequireRole(ApiKeyRole.OPERATOR)
  scanSystem() {
    return this.training.scanSystem();
  }

  @Post('items/:id/generate-suggestions')
  @RequireRole(ApiKeyRole.OPERATOR)
  generateSuggestions(@Param('id') id: string) {
    return this.training.generateSuggestions(id);
  }

  @Post('items/:id/preview-approval')
  @RequireRole(ApiKeyRole.OPERATOR)
  previewApproval(@Param('id') id: string, @Body() body: PreviewApprovalDto) {
    return this.approval.previewApproval({ trainingItemId: id, ...body });
  }

  @Post('items/:id/approve')
  @RequireRole(ApiKeyRole.OPERATOR)
  approve(
    @Param('id') id: string,
    @Body() body: ApproveDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.approval.approve({
      trainingItemId: id,
      ...body,
      approvedBy: key.name ?? key.id,
      approvedByRole: key.role,
    });
  }

  @Post('items/:id/apply')
  @RequireRole(ApiKeyRole.OPERATOR)
  async applyPending(
    @Param('id') id: string,
    @CurrentApiKey() key: ApiKey,
  ) {
    const detail = await this.training.getItemDetail(id);
    const preview = await this.approval.previewApproval({ trainingItemId: id });
    const result = await this.approval.approve({
      trainingItemId: id,
      customAnswer: detail.adminFinalAnswer ?? detail.aiDraftAnswer ?? undefined,
      targetFile: preview.targetFile,
      updateMode: preview.updateMode,
      approvedBy: key.name ?? key.id,
      approvedByRole: key.role,
      applyNow: true,
    });
    return result;
  }

  @Post('items/:id/reject')
  @RequireRole(ApiKeyRole.OPERATOR)
  reject(@Param('id') id: string, @CurrentApiKey() key: ApiKey) {
    return this.approval.reject(id, key.name ?? key.id);
  }

  @Post('items/:id/ignore')
  @RequireRole(ApiKeyRole.OPERATOR)
  ignore(@Param('id') id: string, @CurrentApiKey() key: ApiKey) {
    return this.training.ignoreItem(id, key.name ?? key.id);
  }

  @Post('items/bulk-ignore')
  @RequireRole(ApiKeyRole.OPERATOR)
  bulkIgnore(@Body() body: BulkIdsDto, @CurrentApiKey() key: ApiKey) {
    return this.training.bulkIgnore(body.ids, key.name ?? key.id);
  }

  @Post('items/bulk-approve')
  @RequireRole(ApiKeyRole.OPERATOR)
  bulkApprove(@Body() body: BulkApproveDto, @CurrentApiKey() key: ApiKey) {
    return this.training.bulkApprove(
      body.ids,
      key.name ?? key.id,
      key.role,
      body.applyNow,
      body.overrides,
    );
  }

  @Post('reindex')
  @RequireRole(ApiKeyRole.OPERATOR)
  reindex(@Body() body: ReindexDto) {
    return this.training.reindex(body.includeMemory);
  }

  @Get('audit')
  audit(@Query('trainingItemId') trainingItemId?: string) {
    return this.training.getAudit(trainingItemId);
  }

  @Get('settings')
  getSettings() {
    return this.training.getSettings();
  }

  @Patch('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  patchSettings(@Body() body: Record<string, unknown>) {
    return this.training.updateSettings(body);
  }
}
