import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiReplyTemplate } from '../entities/ai-reply-template.entity';

const DEFAULT_TEMPLATES: Array<
  Pick<AiReplyTemplate, 'name' | 'category' | 'message' | 'language' | 'isFavorite' | 'usageCount' | 'ratingPercent'>
> = [
  {
    name: 'Greeting - Variation 1',
    category: 'greeting',
    message: 'Poa sana 😊 Karibu Inauzwa, nikusaidie nini leo?',
    language: 'mixed',
    isFavorite: true,
    usageCount: 0,
    ratingPercent: 95,
  },
  {
    name: 'Greeting - Variation 2',
    category: 'greeting',
    message: 'Mambo vipi 😊 Karibu, unahitaji bidhaa gani?',
    language: 'mixed',
    isFavorite: false,
    usageCount: 0,
    ratingPercent: 94,
  },
  {
    name: 'Price - General',
    category: 'price',
    message: 'Bei inategemea model unayotaka. Vipi, unahitaji ya matumizi gani?',
    language: 'sw',
    isFavorite: true,
    usageCount: 0,
    ratingPercent: 96,
  },
  {
    name: 'Location - Shop',
    category: 'location',
    message: 'Tupo Kariakoo, Dar es Salaam Tanzania dukani 😊',
    language: 'sw',
    isFavorite: false,
    usageCount: 0,
    ratingPercent: 93,
  },
  {
    name: 'Delivery - General',
    category: 'delivery',
    message: 'Ndiyo, tunatuma ndani karibu kote Tanzania kupitia makampuni ya usafirishaji.',
    language: 'sw',
    isFavorite: false,
    usageCount: 0,
    ratingPercent: 94,
  },
  {
    name: 'Installment - General',
    category: 'installment',
    message: 'Ndiyo, tunaweza malipo kidogo kidogo. Unahitaji kulipa kwa muda gani?',
    language: 'sw',
    isFavorite: false,
    usageCount: 0,
    ratingPercent: 90,
  },
];

export interface CreateAiReplyTemplateInput {
  name: string;
  category: string;
  message: string;
  language?: string;
  active?: boolean;
  branchId?: string | null;
  createdBy?: string | null;
}

export interface UpdateAiReplyTemplateInput {
  name?: string;
  category?: string;
  message?: string;
  language?: string;
  active?: boolean;
  isFavorite?: boolean;
  updatedBy?: string | null;
}

@Injectable()
export class AiReplyTemplateService {
  constructor(
    @InjectRepository(AiReplyTemplate, 'data')
    private readonly repo: Repository<AiReplyTemplate>,
  ) {}

  async list(branchId?: string | null): Promise<AiReplyTemplate[]> {
    await this.seedDefaultsIfEmpty();
    const where = branchId ? { branchId } : {};
    return this.repo.find({
      where,
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<AiReplyTemplate | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(input: CreateAiReplyTemplateInput): Promise<AiReplyTemplate> {
    const name = input.name?.trim();
    const category = input.category?.trim();
    const message = input.message?.trim();
    if (!name || !category || !message) {
      throw new Error('name_category_message_required');
    }

    return this.repo.save(
      this.repo.create({
        name,
        category,
        message,
        language: input.language?.trim() || 'mixed',
        active: input.active ?? true,
        branchId: input.branchId ?? null,
        createdBy: input.createdBy ?? null,
        updatedBy: input.createdBy ?? null,
      }),
    );
  }

  async update(id: string, input: UpdateAiReplyTemplateInput): Promise<AiReplyTemplate | null> {
    const row = await this.findById(id);
    if (!row) return null;

    if (input.name !== undefined) row.name = input.name.trim();
    if (input.category !== undefined) row.category = input.category.trim();
    if (input.message !== undefined) row.message = input.message.trim();
    if (input.language !== undefined) row.language = input.language.trim() || 'mixed';
    if (input.active !== undefined) row.active = input.active;
    if (input.isFavorite !== undefined) row.isFavorite = input.isFavorite;
    if (input.updatedBy !== undefined) row.updatedBy = input.updatedBy;

    return this.repo.save(row);
  }

  async delete(id: string): Promise<boolean> {
    const res = await this.repo.delete({ id });
    return (res.affected ?? 0) > 0;
  }

  private async seedDefaultsIfEmpty(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;

    await this.repo.save(
      DEFAULT_TEMPLATES.map(t =>
        this.repo.create({
          ...t,
          active: true,
          branchId: null,
          createdBy: 'system_seed',
          updatedBy: 'system_seed',
        }),
      ),
    );
  }
}
