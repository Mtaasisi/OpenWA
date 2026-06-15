import {
  AiKnowledgeService,
  EXCLUDED_FROM_AUTO_REPLY_RAG,
} from './ai-knowledge.service';

describe('AiKnowledgeService.buildAutoReplyKnowledgeExcerpt', () => {
  const service = Object.create(AiKnowledgeService.prototype) as AiKnowledgeService;

  beforeEach(() => {
    jest.spyOn(service, 'search').mockResolvedValue([
      { path: 'AI_REPLY_RULES.md', snippet: 'rules '.repeat(120) },
      { path: 'AI_REPLY_EXAMPLES.md', snippet: 'examples '.repeat(120) },
      { path: 'FAQ.md', snippet: 'faq answer about warranty '.repeat(40) },
      { path: 'SHOP.md', snippet: 'shop hours and location '.repeat(40) },
      { path: 'WARRANTY_RULES.md', snippet: 'warranty policy details '.repeat(40) },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('excludes rule/example files and caps total chars at 1200', async () => {
    const excerpt = await service.buildAutoReplyKnowledgeExcerpt('warranty question', {
      maxChunks: 2,
      maxTotalChars: 1200,
    });

    expect(excerpt.length).toBeGreaterThan(0);
    expect(excerpt.length).toBeLessThan(1300);
    for (const excluded of EXCLUDED_FROM_AUTO_REPLY_RAG) {
      expect(excerpt).not.toContain(`[${excluded}]`);
    }
    expect(excerpt).toContain('[FAQ.md]');
  });

  it('returns empty string for blank query', async () => {
    const excerpt = await service.buildAutoReplyKnowledgeExcerpt('   ');
    expect(excerpt).toBe('');
    expect(service.search).not.toHaveBeenCalled();
  });
});
