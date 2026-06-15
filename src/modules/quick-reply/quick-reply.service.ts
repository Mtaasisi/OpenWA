import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { QuickReplyTemplate } from './entities/quick-reply-template.entity';
import { QuickReplyCategory } from './quick-reply.enums';
import {
  CreateQuickReplyDto,
  PreviewQuickReplyDto,
  UpdateQuickReplyDto,
} from './dto/quick-reply.dto';
import { renderTemplate, TemplateVariables } from '../followup/utils/template.util';

@Injectable()
export class QuickReplyService implements OnModuleInit {
  private readonly logger = new Logger(QuickReplyService.name);

  constructor(
    @InjectRepository(QuickReplyTemplate, 'data')
    private readonly repo: Repository<QuickReplyTemplate>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaultsIfEmpty();
  }

  async seedDefaultsIfEmpty(): Promise<void> {
    const count = await this.repo.count();
    if (count > 0) return;

    const defaults: Array<{ name: string; category: QuickReplyCategory; body: string }> = [
      {
        name: 'Welcome greeting',
        category: QuickReplyCategory.GREETING,
        body: 'Hello {customer_name}! Welcome to {branch_name}. How can we help you today?',
      },
      {
        name: 'Ask budget',
        category: QuickReplyCategory.ASK_BUDGET,
        body: 'Hi {customer_name}, what budget range are you looking at for {product_name}?',
      },
      {
        name: 'Ask usage',
        category: QuickReplyCategory.ASK_USAGE,
        body: 'Hi {customer_name}, how do you plan to use {product_name}? This helps us recommend the best option.',
      },
      {
        name: 'Send price',
        category: QuickReplyCategory.SEND_PRICE,
        body: 'Hi {customer_name}, the price for {product_name} is {price}. Let us know if you have any questions!',
      },
      {
        name: 'Product available',
        category: QuickReplyCategory.PRODUCT_AVAILABLE,
        body: 'Good news {customer_name}! {product_name} is in stock at {branch_name}. Would you like to reserve it?',
      },
      {
        name: 'Out of stock',
        category: QuickReplyCategory.OUT_OF_STOCK,
        body: 'Hi {customer_name}, {product_name} is currently out of stock. We can suggest alternatives — interested?',
      },
      {
        name: 'Suggest alternative',
        category: QuickReplyCategory.SUGGEST_ALTERNATIVE,
        body: 'Hi {customer_name}, we have a similar option to {product_name} that might work for you. Shall I share details?',
      },
      {
        name: 'Payment instructions',
        category: QuickReplyCategory.PAYMENT_INSTRUCTIONS,
        body: 'Hi {customer_name}, please pay {price} to {payment_number}. Send confirmation once done. Thank you!',
      },
      {
        name: 'Delivery info',
        category: QuickReplyCategory.DELIVERY_INFO,
        body: 'Hi {customer_name}, delivery fee is {delivery_fee}. We can deliver {product_name} to your location. Please confirm your address.',
      },
      {
        name: 'Warranty info',
        category: QuickReplyCategory.WARRANTY,
        body: 'Hi {customer_name}, {product_name} comes with {warranty} warranty. Full terms available at {branch_name}.',
      },
      {
        name: 'Repair status',
        category: QuickReplyCategory.REPAIR_STATUS,
        body: 'Hi {customer_name}, here is your repair status update. Contact {branch_name} at {pickup_location} for details.',
      },
      {
        name: 'Follow up',
        category: QuickReplyCategory.FOLLOW_UP,
        body: 'Hi {customer_name}, just following up on {product_name}. Are you still interested?',
      },
      {
        name: 'Closing sale',
        category: QuickReplyCategory.CLOSING_SALE,
        body: 'Hi {customer_name}, great choice on {product_name}! Total: {price}. Pay to {payment_number} to complete your order.',
      },
      {
        name: 'Thank you',
        category: QuickReplyCategory.THANK_YOU,
        body: 'Thank you {customer_name}! We appreciate your business. — {staff_name}, {branch_name}',
      },
    ];

    for (const item of defaults) {
      await this.repo.save(
        this.repo.create({
          ...item,
          language: 'en',
          branchId: null,
          isActive: true,
        }),
      );
    }
    this.logger.log(`Seeded ${defaults.length} default quick reply templates`);
  }

  /** Admin settings: all templates (including inactive), optional branch filter. */
  async findAllForManage(branchId?: string | null): Promise<QuickReplyTemplate[]> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.category', 'ASC').addOrderBy('t.name', 'ASC');
    if (branchId === '') {
      qb.where('t.branchId IS NULL');
    } else if (branchId) {
      qb.where('t.branchId = :branchId OR t.branchId IS NULL', { branchId });
    }
    return qb.getMany();
  }

  /** Inbox picker: active templates with branch fallback. */
  async findForInbox(
    branchId?: string,
    category?: QuickReplyCategory,
    search?: string,
  ): Promise<QuickReplyTemplate[]> {
    const branchRows = branchId
      ? await this.repo.find({
          where: {
            branchId,
            isActive: true,
            ...(category ? { category } : {}),
          },
          order: { category: 'ASC', name: 'ASC' },
        })
      : [];

    const globalWhere = {
      branchId: IsNull(),
      isActive: true,
      ...(category ? { category } : {}),
    };
    const globalRows = await this.repo.find({
      where: globalWhere,
      order: { category: 'ASC', name: 'ASC' },
    });

    let merged: QuickReplyTemplate[];
    if (branchId && branchRows.length > 0) {
      const branchCategories = new Set(branchRows.map(r => r.category));
      const fallback = globalRows.filter(g => !branchCategories.has(g.category));
      merged = [...branchRows, ...fallback];
    } else {
      merged = globalRows;
    }

    if (search?.trim()) {
      const q = search.trim().toLowerCase();
      merged = merged.filter(
        t => t.name.toLowerCase().includes(q) || t.body.toLowerCase().includes(q),
      );
    }

    return merged;
  }

  async findById(id: string): Promise<QuickReplyTemplate> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Quick reply ${id} not found`);
    return row;
  }

  async create(dto: CreateQuickReplyDto, staffId?: string): Promise<QuickReplyTemplate> {
    const row = this.repo.create({
      ...dto,
      language: dto.language ?? 'en',
      isActive: dto.isActive ?? true,
      createdBy: staffId ?? null,
      updatedBy: staffId ?? null,
    });
    return this.repo.save(row);
  }

  async update(
    id: string,
    dto: UpdateQuickReplyDto,
    staffId?: string,
  ): Promise<QuickReplyTemplate> {
    const row = await this.findById(id);
    Object.assign(row, dto);
    row.updatedBy = staffId ?? row.updatedBy;
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findById(id);
    await this.repo.remove(row);
  }

  preview(id: string, variables: PreviewQuickReplyDto): Promise<{ body: string }> {
    return this.findById(id).then(t => ({
      body: renderTemplate(t.body, variables as TemplateVariables),
    }));
  }
}
