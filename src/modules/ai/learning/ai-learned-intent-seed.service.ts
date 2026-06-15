import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AiLearnedIntent,
  AiLearnedIntentStatus,
} from '../entities/ai-learned-intent.entity';
import { normalizeCustomerText } from './ai-text-normalizer.util';
import {
  GREETING_ONLY_REPLY,
  GREETING_REPEAT_ALT_REPLY,
  GREETING_REPEAT_REPLY,
} from '../utils/ai-behavior.util';

const DEFAULT_GREETING_SEEDS: Array<{
  phrase: string;
  replyVariations: string[];
}> = [
  { phrase: 'mambo', replyVariations: [GREETING_ONLY_REPLY, 'Poa sana 😊 Karibu Inauzwa, nikusaidie nini leo?'] },
  { phrase: 'mambo vipi', replyVariations: [GREETING_ONLY_REPLY, 'Mambo vipi 😊 Karibu, unahitaji bidhaa gani?'] },
  { phrase: 'habari', replyVariations: [GREETING_ONLY_REPLY, 'Karibu sana 😊 Niambie nikusaidie nini?'] },
  { phrase: 'hi', replyVariations: [GREETING_ONLY_REPLY, GREETING_REPEAT_ALT_REPLY] },
  { phrase: 'hello', replyVariations: [GREETING_ONLY_REPLY, GREETING_REPEAT_REPLY] },
  { phrase: 'vipi', replyVariations: [GREETING_ONLY_REPLY, 'Poa mkuu 😊 Niambie nikusaidie nini leo?'] },
  { phrase: 'za mida', replyVariations: [GREETING_ONLY_REPLY, 'Karibu sana 😊 Unaangalia simu, laptop au accessories?'] },
  { phrase: 'salama', replyVariations: [GREETING_REPEAT_REPLY, GREETING_REPEAT_ALT_REPLY] },
  { phrase: 'upo online', replyVariations: ['Ndiyo Boss niko online 😊', 'Nipo Boss 😊'] },
  { phrase: 'uko hapo', replyVariations: ['Ndiyo Boss niko hapa 😊', 'Nipo Boss 😊'] },
];

@Injectable()
export class AiLearnedIntentSeedService implements OnModuleInit {
  private readonly logger = new Logger(AiLearnedIntentSeedService.name);

  constructor(
    @InjectRepository(AiLearnedIntent, 'data')
    private readonly repo: Repository<AiLearnedIntent>,
  ) {}

  onModuleInit(): void {
    void this.seedDefaultGreetings().catch(err => {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Greeting intent seed skipped: ${msg}`);
    });
  }

  async seedDefaultGreetings(): Promise<number> {
    let created = 0;
    for (const seed of DEFAULT_GREETING_SEEDS) {
      const normalizedPhrase = normalizeCustomerText(seed.phrase);
      const existing = await this.repo.findOne({
        where: { normalizedPhrase, status: AiLearnedIntentStatus.ACTIVE },
      });
      if (existing) continue;

      await this.repo.save(
        this.repo.create({
          phrase: seed.phrase,
          normalizedPhrase,
          intent: 'greeting',
          suggestedReply: seed.replyVariations[0],
          replyVariations: seed.replyVariations.slice(1),
          status: AiLearnedIntentStatus.ACTIVE,
          autoApproved: true,
          confidence: 95,
          matchType: 'exact',
          metadata: { source: 'system_seed' },
        }),
      );
      created += 1;
    }
    if (created > 0) {
      this.logger.log(`Seeded ${created} default greeting learned intent(s)`);
    }
    return created;
  }
}
