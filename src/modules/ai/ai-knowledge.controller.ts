import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiKnowledgeIndexService } from './ai-knowledge-index.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

type AuthedRequest = Request & { apiKey?: { role: ApiKeyRole } };

@ApiTags('ai')
@Controller('ai/knowledge')
export class AiKnowledgeController {
  constructor(
    private readonly knowledge: AiKnowledgeService,
    private readonly knowledgeIndex: AiKnowledgeIndexService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List shop knowledge files' })
  list() {
    return { files: this.knowledge.listFiles() };
  }

  @Get('read')
  @ApiOperation({ summary: 'Read a knowledge file' })
  read(@Query('path') filePath: string) {
    return this.knowledge.readFile(filePath);
  }

  @Put()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Write a knowledge file' })
  write(@Body() body: { path: string; content: string }) {
    return this.knowledge.writeFile(body.path, body.content);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge files' })
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return {
      results: await this.knowledge.search(q, limit ? parseInt(limit, 10) : 10),
    };
  }

  @Get('index-status')
  @ApiOperation({ summary: 'Indexed knowledge chunk count' })
  async indexStatus() {
    const chunks = await this.knowledgeIndex.getIndexedChunkCount();
    return { chunks };
  }

  @Post('reindex')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Reindex shop knowledge for semantic search' })
  async reindex() {
    return this.knowledgeIndex.reindexAll();
  }

  @Get('excerpt')
  @ApiOperation({ summary: 'Preview knowledge injected into AI prompts' })
  excerpt() {
    return { excerpt: this.knowledge.buildPromptExcerpt() };
  }
}
