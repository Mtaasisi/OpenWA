import { Body, Controller, Get, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiMemoryService } from './ai-memory.service';
import { AiMemoryIndexService } from './ai-memory-index.service';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';

@ApiTags('ai')
@Controller('ai/memory')
export class AiMemoryController {
  constructor(
    private readonly memory: AiMemoryService,
    private readonly memoryIndex: AiMemoryIndexService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List AI memory files' })
  list() {
    return { files: this.memory.listFiles() };
  }

  @Get('read')
  @ApiOperation({ summary: 'Read a memory file (optional line range)' })
  read(
    @Query('path') filePath: string,
    @Query('fromLine') fromLine?: string,
    @Query('lineCount') lineCount?: string,
  ) {
    const content = this.memory.readFile(
      filePath,
      fromLine ? parseInt(fromLine, 10) : undefined,
      lineCount ? parseInt(lineCount, 10) : undefined,
    );
    return { path: filePath, content };
  }

  @Put()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Write a memory file' })
  write(@Body() body: { path: string; content: string }) {
    return this.memory.writeFile(body.path, body.content);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search memory chunks' })
  async search(@Query('q') q: string, @Query('limit') limit?: string) {
    return {
      hits: await this.memory.search(q, limit ? parseInt(limit, 10) : 8),
    };
  }

  @Get('index-status')
  @ApiOperation({ summary: 'Indexed memory chunk count and vector search availability' })
  async indexStatus() {
    return this.memoryIndex.getIndexStatus();
  }

  @Post('reindex')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Reindex all memory files (embeddings + chunks)' })
  async reindex() {
    return this.memoryIndex.reindexAll();
  }

  @Post('dream')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Promote frequently recalled snippets to MEMORY.md' })
  dream() {
    return this.memory.runDreaming();
  }
}
