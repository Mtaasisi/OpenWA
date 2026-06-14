import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiLearningService } from './ai-learning.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import type { LearningMessageRow } from './utils/ai-learning-csv.util';

class LearningMessageDto implements LearningMessageRow {
  @IsString()
  @MinLength(1)
  messageBody: string;

  @IsOptional()
  @IsString()
  direction?: string | null;

  @IsOptional()
  @IsString()
  sender?: string | null;

  @IsOptional()
  @IsString()
  timestamp?: string | null;

  @IsOptional()
  @IsString()
  chatId?: string | null;

  @IsOptional()
  @IsString()
  sessionId?: string | null;
}

class ImportLearningDto {
  @IsString()
  @MinLength(1)
  sourceName: string;

  @IsOptional()
  @IsString()
  csv?: string;

  @IsOptional()
  @IsString()
  archive?: string;

  @IsOptional()
  @IsString()
  fileName?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningMessageDto)
  messages?: LearningMessageDto[];
}

@ApiTags('ai')
@Controller('ai/learning')
export class AiLearningController {
  constructor(private readonly learning: AiLearningService) {}

  @Get('imports')
  @ApiOperation({ summary: 'List WhatsApp learning imports' })
  listImports() {
    return this.learning.listImports();
  }

  @Get('imports/:id')
  @ApiOperation({ summary: 'Get learning import details' })
  getImport(@Param('id') id: string) {
    return this.learning.getImport(id);
  }

  @Post('import')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Import customer messages for AI learning analysis' })
  importMessages(@Body() body: ImportLearningDto) {
    return this.learning.importMessages(body);
  }

  @Post('imports/:id/promote-faq')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Append top learned questions to FAQ.md' })
  promoteFaq(@Param('id') id: string) {
    return this.learning.promoteTopQuestionsToFaq(id);
  }

  @Post('imports/:id/promote-examples')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Append learned reply samples to AI_REPLY_EXAMPLES.md' })
  promoteExamples(@Param('id') id: string) {
    return this.learning.promoteReplySamplesToExamples(id);
  }
}
