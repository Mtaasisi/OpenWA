import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InboxSavedView } from './entities/inbox-saved-view.entity';

export type InboxSavedViewConfig = {
  filter: string;
  hideGroups?: boolean;
  leadSourceFilter?: string;
  conversationSort?: 'newest' | 'oldest';
  channelFilter?: string;
};

export type InboxSavedViewDto = {
  id: string;
  name: string;
  config: InboxSavedViewConfig;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const MAX_SAVED_VIEWS = 16;

const ALLOWED_FILTERS = new Set([
  'all',
  'my_work',
  'unread',
  'needs_reply',
  'needs_human',
  'hot_leads',
  'waiting_payment',
  'waiting_stock',
  'followup_due',
  'unassigned',
  'ai_opt_out',
  'private',
  'groups',
  'resolved',
  'overdue',
  'failed_sends',
  'ai_active',
  'assigned_to_me',
]);

@Injectable()
export class InboxSavedViewService {
  constructor(
    @InjectRepository(InboxSavedView, 'data')
    private readonly repo: Repository<InboxSavedView>,
  ) {}

  async listForStaff(staffId: string): Promise<InboxSavedViewDto[]> {
    const rows = await this.repo.find({
      where: { staffId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
      take: MAX_SAVED_VIEWS,
    });
    return rows.map(row => this.toDto(row));
  }

  async create(staffId: string, name: string, config: InboxSavedViewConfig): Promise<InboxSavedViewDto> {
    const trimmedName = name?.trim();
    if (!trimmedName) throw new BadRequestException('name is required');
    if (trimmedName.length > 80) throw new BadRequestException('name is too long');

    const count = await this.repo.count({ where: { staffId } });
    if (count >= MAX_SAVED_VIEWS) {
      throw new BadRequestException(`Maximum ${MAX_SAVED_VIEWS} saved views allowed`);
    }

    const normalized = this.normalizeConfig(config);
    const row = await this.repo.save(
      this.repo.create({
        staffId,
        name: trimmedName,
        configJson: JSON.stringify(normalized),
        sortOrder: count,
      }),
    );
    return this.toDto(row);
  }

  async update(
    staffId: string,
    id: string,
    patch: { name?: string; config?: InboxSavedViewConfig },
  ): Promise<InboxSavedViewDto> {
    const row = await this.repo.findOne({ where: { id, staffId } });
    if (!row) throw new NotFoundException('Saved view not found');

    if (patch.name !== undefined) {
      const trimmedName = patch.name.trim();
      if (!trimmedName) throw new BadRequestException('name is required');
      if (trimmedName.length > 80) throw new BadRequestException('name is too long');
      row.name = trimmedName;
    }

    if (patch.config !== undefined) {
      row.configJson = JSON.stringify(this.normalizeConfig(patch.config));
    }

    const saved = await this.repo.save(row);
    return this.toDto(saved);
  }

  async remove(staffId: string, id: string): Promise<void> {
    const result = await this.repo.delete({ id, staffId });
    if (!result.affected) throw new NotFoundException('Saved view not found');
  }

  private normalizeConfig(config: InboxSavedViewConfig): InboxSavedViewConfig {
    const filter = config?.filter?.trim() || 'all';
    if (!ALLOWED_FILTERS.has(filter)) {
      throw new BadRequestException(`Invalid filter: ${filter}`);
    }

    const conversationSort =
      config.conversationSort === 'oldest' ? 'oldest' : config.conversationSort === 'newest' ? 'newest' : undefined;

    return {
      filter,
      hideGroups: config.hideGroups === true,
      leadSourceFilter: config.leadSourceFilter?.trim() || undefined,
      conversationSort,
      channelFilter: config.channelFilter?.trim() || undefined,
    };
  }

  private toDto(row: InboxSavedView): InboxSavedViewDto {
    let config: InboxSavedViewConfig = { filter: 'all' };
    try {
      const parsed = JSON.parse(row.configJson) as InboxSavedViewConfig;
      if (parsed && typeof parsed.filter === 'string') {
        config = parsed;
      }
    } catch {
      // keep default
    }

    return {
      id: row.id,
      name: row.name,
      config,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
