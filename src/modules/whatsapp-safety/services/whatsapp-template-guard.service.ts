import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowupMessageTemplate } from '../../followup/entities/followup-message-template.entity';
import { WhatsAppTemplateStatus } from '../../followup/followup.enums';

@Injectable()
export class WhatsAppTemplateGuardService {
  constructor(
    @InjectRepository(FollowupMessageTemplate, 'data')
    private readonly templateRepo: Repository<FollowupMessageTemplate>,
  ) {}

  async findTemplate(templateId: string | null | undefined): Promise<FollowupMessageTemplate | null> {
    if (!templateId) return null;
    return this.templateRepo.findOne({ where: { id: templateId } });
  }

  isTemplateApproved(template: FollowupMessageTemplate | null): boolean {
    if (!template) return false;
    if (!template.requiresWhatsappApproval) return true;
    return template.whatsappTemplateStatus === WhatsAppTemplateStatus.APPROVED;
  }

  async validateOutsideWindow(templateId: string | null | undefined): Promise<{
    ok: boolean;
    reason: string;
  }> {
    if (!templateId) {
      return { ok: false, reason: 'Outside 24-hour window requires an approved template' };
    }
    const template = await this.findTemplate(templateId);
    if (!template) {
      return { ok: false, reason: 'Template not found' };
    }
    if (!this.isTemplateApproved(template)) {
      return { ok: false, reason: `Template "${template.name}" is not approved for WhatsApp` };
    }
    return { ok: true, reason: 'Approved template' };
  }
}
