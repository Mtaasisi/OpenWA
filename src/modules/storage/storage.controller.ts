import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { StorageSettingsService } from './storage-settings.service';
import { StorageUsageService } from './storage-usage.service';
import { StorageCleanupService } from './storage-cleanup.service';
import type { CleanupOptionsDto, CleanupRunDto } from './dto/cleanup.dto';
import { StoragePermission } from './storage.enums';
import {
  RequireStoragePermission,
  StoragePermissionGuard,
} from './guards/storage-permission.guard';
import { getEffectiveStoragePermissions } from './utils/permissions.util';
import { MessageService } from '../message/message.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import type { StorageSettingsResponse } from './storage.types';

@ApiTags('storage')
@Controller('storage')
@UseGuards(StoragePermissionGuard)
export class StorageController {
  constructor(
    private readonly settingsService: StorageSettingsService,
    private readonly usageService: StorageUsageService,
    private readonly cleanupService: StorageCleanupService,
    private readonly messageService: MessageService,
    private readonly auditService: AuditService,
  ) {}

  @Get('permissions')
  @RequireRole(ApiKeyRole.VIEWER)
  getPermissions(@CurrentApiKey() apiKey: ApiKey) {
    return { permissions: getEffectiveStoragePermissions(apiKey) };
  }

  @Get('usage')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.VIEW_USAGE)
  async getUsage() {
    const usage = await this.usageService.getUsage();
    const warnings = await this.usageService.getWarnings();
    return { usage, warnings };
  }

  @Get('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.VIEW_USAGE)
  getSettings(): Promise<StorageSettingsResponse> {
    return this.settingsService.getSettings();
  }

  @Post('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.MANAGE_SETTINGS)
  async saveSettings(
    @Body() body: Partial<StorageSettingsResponse>,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const saved = await this.settingsService.saveSettings(body);
    await this.auditService.logInfo(AuditAction.STORAGE_SETTINGS_UPDATED, {
      metadata: { apiKeyId: apiKey.id },
    });
    return saved;
  }

  @Post('media/:messageId/download')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.DOWNLOAD_MEDIA)
  async downloadMedia(
    @Param('messageId') messageId: string,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const result = await this.messageService.forceDownloadMedia(messageId);
    await this.auditService.logInfo(AuditAction.STORAGE_MEDIA_DOWNLOADED, {
      metadata: { messageId, apiKeyId: apiKey.id },
    });
    return result;
  }

  @Post('media/:messageId/star')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.DOWNLOAD_MEDIA)
  async starMedia(
    @Param('messageId') messageId: string,
    @Body() body: { starred?: boolean },
  ) {
    return this.messageService.setMessageMediaStarred(messageId, body.starred !== false);
  }

  @Post('cleanup/preview')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.RUN_CLEANUP)
  previewCleanup(@Body() body: CleanupOptionsDto) {
    return this.cleanupService.preview(body);
  }

  @Post('cleanup/run')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.RUN_CLEANUP)
  runCleanup(
    @Body() body: CleanupRunDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    const { confirmToken, ...options } = body;
    return this.cleanupService.run(options, confirmToken, apiKey.id);
  }
}
