import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiSearchCategory, AiSearchService } from './ai-search.service';

@ApiTags('ai')
@Controller('ai/search')
export class AiSearchController {
  constructor(private readonly searchService: AiSearchService) {}

  @Get('everywhere')
  @ApiOperation({ summary: 'Search customers, products, quotes, messages, and more' })
  searchEverywhere(
    @Query('q') q?: string,
    @Query('categories') categories?: string,
    @Query('sessionId') sessionId?: string,
    @Query('chatId') chatId?: string,
    @Query('groupsOnly') groupsOnly?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedCategories = categories
      ? categories
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : undefined;

    return this.searchService.searchEverywhere(q ?? '', {
      categories: parsedCategories as AiSearchCategory[] | undefined,
      sessionId: sessionId?.trim() || undefined,
      chatId: chatId?.trim() || undefined,
      groupsOnly: groupsOnly === '1' || groupsOnly === 'true',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
