import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { QuickReplyService } from './quick-reply.service';
import {
  CreateQuickReplyDto,
  PreviewQuickReplyDto,
  UpdateQuickReplyDto,
} from './dto/quick-reply.dto';
import { QuickReplyCategory, QuickReplyPermission } from './quick-reply.enums';
import {
  QuickReplyPermissionGuard,
  RequireQuickReplyPermission,
} from './guards/quick-reply-permission.guard';
import { getEffectiveQuickReplyPermissions } from './utils/permissions.util';

@ApiTags('quick-reply')
@ApiBearerAuth()
@Controller('quick-reply')
@UseGuards(QuickReplyPermissionGuard)
export class QuickReplyController {
  constructor(private readonly quickReplyService: QuickReplyService) {}

  @Get('permissions')
  getPermissions(@CurrentApiKey() apiKey: ApiKey) {
    return { permissions: getEffectiveQuickReplyPermissions(apiKey) };
  }

  @Get('templates')
  @RequireQuickReplyPermission(QuickReplyPermission.VIEW_QUICK_REPLIES)
  async listTemplates(
    @Query('branchId') branchId?: string,
    @Query('category') category?: QuickReplyCategory,
    @Query('search') search?: string,
    @Query('manage') manage?: string,
  ) {
    if (manage === 'true') {
      return this.quickReplyService.findAllForManage(branchId);
    }
    return this.quickReplyService.findForInbox(branchId, category, search);
  }

  @Post('templates')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireQuickReplyPermission(QuickReplyPermission.MANAGE_QUICK_REPLIES)
  async createTemplate(@CurrentApiKey() apiKey: ApiKey, @Body() dto: CreateQuickReplyDto) {
    return this.quickReplyService.create(dto, apiKey.id);
  }

  @Patch('templates/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireQuickReplyPermission(QuickReplyPermission.MANAGE_QUICK_REPLIES)
  async updateTemplate(
    @Param('id') id: string,
    @CurrentApiKey() apiKey: ApiKey,
    @Body() dto: UpdateQuickReplyDto,
  ) {
    return this.quickReplyService.update(id, dto, apiKey.id);
  }

  @Delete('templates/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireQuickReplyPermission(QuickReplyPermission.MANAGE_QUICK_REPLIES)
  async deleteTemplate(@Param('id') id: string) {
    await this.quickReplyService.remove(id);
    return { ok: true };
  }

  @Post('templates/:id/preview')
  @RequireQuickReplyPermission(QuickReplyPermission.VIEW_QUICK_REPLIES)
  async previewTemplate(@Param('id') id: string, @Body() variables: PreviewQuickReplyDto) {
    return this.quickReplyService.preview(id, variables);
  }
}
