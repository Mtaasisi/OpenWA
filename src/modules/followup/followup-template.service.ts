import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupMessageTemplate } from './entities/followup-message-template.entity';
import { TemplateCategory, WhatsAppTemplateStatus } from './followup.enums';
import { renderTemplate, TemplateVariables } from './utils/template.util';

export interface CreateTemplateDto {
  name: string;
  category: TemplateCategory;
  body: string;
  smsBody?: string | null;
  channel?: string;
  language?: string;
  requiresWhatsappApproval?: boolean;
  whatsappTemplateName?: string | null;
  whatsappTemplateStatus?: WhatsAppTemplateStatus;
  branchId?: string | null;
  isActive?: boolean;
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

@Injectable()
export class FollowupTemplateService {
  constructor(
    @InjectRepository(FollowupMessageTemplate, 'data')
    private readonly repo: Repository<FollowupMessageTemplate>,
  ) {}

  async findAll(branchId?: string): Promise<FollowupMessageTemplate[]> {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.name', 'ASC');
    if (branchId) {
      qb.where('t.branchId = :branchId OR t.branchId IS NULL', { branchId });
    }
    return qb.getMany();
  }

  async findById(id: string): Promise<FollowupMessageTemplate> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Template ${id} not found`);
    return row;
  }

  async create(dto: CreateTemplateDto): Promise<FollowupMessageTemplate> {
    const row = this.repo.create({
      ...dto,
      channel: dto.channel ?? 'whatsapp',
      language: dto.language ?? 'en',
      requiresWhatsappApproval: dto.requiresWhatsappApproval ?? false,
      whatsappTemplateStatus:
        dto.whatsappTemplateStatus ??
        (dto.requiresWhatsappApproval
          ? WhatsAppTemplateStatus.PENDING
          : WhatsAppTemplateStatus.NOT_REQUIRED),
      isActive: dto.isActive ?? true,
    });
    return this.repo.save(row);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<FollowupMessageTemplate> {
    const row = await this.findById(id);
    Object.assign(row, dto);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const row = await this.findById(id);
    await this.repo.remove(row);
  }

  preview(id: string, variables: TemplateVariables): Promise<{ body: string; smsBody: string | null }> {
    return this.findById(id).then(t => ({
      body: renderTemplate(t.body, variables),
      smsBody: t.smsBody ? renderTemplate(t.smsBody, variables) : null,
    }));
  }
}
