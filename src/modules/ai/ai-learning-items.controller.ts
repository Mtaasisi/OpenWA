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
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { AiLearningItemsService } from './ai-learning-items.service';
import { AiLearningKnowledgeService } from './ai-learning-knowledge.service';
import { AiLearningSettingsService } from './ai-learning-settings.service';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKeyRole, ApiKey } from '../auth/entities/api-key.entity';
import { AiLearningItemStatus } from './ai-learning.enums';
import type { AiLearningKnowledge } from './entities/ai-learning-knowledge.entity';

class PatchLearningItemDto {
  @IsOptional() @IsString() question?: string;
  @IsOptional() @IsString() adminFinalAnswer?: string;
  @IsOptional() @IsString() status?: AiLearningItemStatus;
  @IsOptional() @IsString() targetFile?: string;
  @IsOptional() @IsString() knowledgeCategory?: string;
  @IsOptional() @IsString() internalNote?: string;
  @IsOptional() @IsString() aiDraftAnswer?: string;
}

class TeachActionDto {
  @IsString() @MinLength(1) adminFinalAnswer: string;
  @IsOptional() @IsString() targetFile?: string;
  @IsOptional() @IsString() category?: string;
}

class ReplyOnlyDto {
  @IsString() @MinLength(1) answer: string;
}

class MergeDto {
  @IsArray() @IsString({ each: true }) targetIds: string[];
}

class PatchKnowledgeDto {
  @IsOptional() @IsString() questionPattern?: string;
  @IsOptional() @IsString() approvedAnswer?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() targetFile?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() internalNotes?: string;
}

class PatchSettingsDto {
  [key: string]: unknown;
}

@ApiTags('ai-learning')
@Controller('ai-learning')
export class AiLearningItemsController {
  constructor(
    private readonly items: AiLearningItemsService,
    private readonly knowledge: AiLearningKnowledgeService,
    private readonly settings: AiLearningSettingsService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'AI Learning overview KPIs' })
  overview() {
    return this.items.getOverview();
  }

  @Get('items')
  listItems(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.items.listItems({
      status: status as AiLearningItemStatus | undefined,
      search,
      branchId,
    });
  }

  @Get('items/:id')
  getItem(@Param('id') id: string) {
    return this.items.getItem(id);
  }

  @Get('items/:id/similar')
  similar(@Param('id') id: string) {
    return this.items.findSimilar(id);
  }

  @Patch('items/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  patchItem(@Param('id') id: string, @Body() body: PatchLearningItemDto) {
    return this.items.updateItem(id, body);
  }

  @Post('items/:id/approve')
  @RequireRole(ApiKeyRole.OPERATOR)
  approve(
    @Param('id') id: string,
    @Body() body: TeachActionDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.items.approveItem(id, {
      ...body,
      approvedBy: key.name ?? key.id,
    });
  }

  @Post('items/:id/reject')
  @RequireRole(ApiKeyRole.OPERATOR)
  reject(@Param('id') id: string) {
    return this.items.rejectItem(id);
  }

  @Post('items/:id/ignore')
  @RequireRole(ApiKeyRole.OPERATOR)
  ignore(@Param('id') id: string) {
    return this.items.ignoreItem(id);
  }

  @Post('items/:id/merge')
  @RequireRole(ApiKeyRole.OPERATOR)
  merge(@Param('id') id: string, @Body() body: MergeDto) {
    return this.items.mergeItems(id, body.targetIds);
  }

  @Post('items/:id/reply-and-teach')
  @RequireRole(ApiKeyRole.OPERATOR)
  replyAndTeach(
    @Param('id') id: string,
    @Body() body: TeachActionDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.items.replyAndTeach(id, {
      ...body,
      approvedBy: key.name ?? key.id,
      actorStaffId: key.id,
    });
  }

  @Post('items/:id/teach-only')
  @RequireRole(ApiKeyRole.OPERATOR)
  teachOnly(
    @Param('id') id: string,
    @Body() body: TeachActionDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.items.teachOnly(id, {
      ...body,
      approvedBy: key.name ?? key.id,
    });
  }

  @Post('items/:id/reply-only')
  @RequireRole(ApiKeyRole.OPERATOR)
  replyOnly(
    @Param('id') id: string,
    @Body() body: ReplyOnlyDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.items.replyOnly(id, { answer: body.answer, actorStaffId: key.id });
  }

  @Get('knowledge')
  listKnowledge(@Query('status') status?: string, @Query('search') search?: string) {
    return this.knowledge.listKnowledge({ status, search });
  }

  @Patch('knowledge/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  patchKnowledge(
    @Param('id') id: string,
    @Body() body: PatchKnowledgeDto,
    @CurrentApiKey() key: ApiKey,
  ) {
    return this.knowledge.updateKnowledge(id, body as Partial<AiLearningKnowledge>, key.id);
  }

  @Post('knowledge/:id/disable')
  @RequireRole(ApiKeyRole.OPERATOR)
  disableKnowledge(@Param('id') id: string) {
    return this.knowledge.disableKnowledge(id);
  }

  @Post('knowledge/:id/mark-needs-review')
  @RequireRole(ApiKeyRole.OPERATOR)
  markNeedsReview(@Param('id') id: string) {
    return this.knowledge.markNeedsReview(id);
  }

  @Get('history')
  history() {
    return this.items.listHistory();
  }

  @Get('settings')
  getSettings() {
    return this.settings.getSettings();
  }

  @Patch('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  patchSettings(@Body() body: PatchSettingsDto) {
    return this.settings.updateSettings(body);
  }

  @Post('settings/reset')
  @RequireRole(ApiKeyRole.OPERATOR)
  resetSettings() {
    return this.settings.resetDefaults();
  }
}
