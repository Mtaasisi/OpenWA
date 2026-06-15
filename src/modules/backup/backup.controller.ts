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
import type { Response } from 'express';
import * as fs from 'fs';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { BackupService } from './backup.service';
import { BackupRestoreService } from './backup-restore.service';
import { BackupSettings } from './entities/backup-settings.entity';
import { CreateBackupDto, RestoreBackupDto, SaveBackupSettingsDto } from './dto/backup.dto';
import { StoragePermission } from '../storage/storage.enums';
import {
  RequireStoragePermission,
  StoragePermissionGuard,
} from '../storage/guards/storage-permission.guard';

@ApiTags('backup')
@Controller('backup')
@UseGuards(StoragePermissionGuard)
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly restoreService: BackupRestoreService,
  ) {}

  @Get('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.VIEW_USAGE)
  getSettings(): Promise<BackupSettings> {
    return this.backupService.getSettings();
  }

  @Post('settings')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.MANAGE_SETTINGS)
  saveSettings(@Body() body: SaveBackupSettingsDto): Promise<BackupSettings> {
    return this.backupService.saveSettings(body);
  }

  @Post('create')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.CREATE_BACKUP)
  create(@Body() body: CreateBackupDto, @CurrentApiKey() apiKey: ApiKey) {
    return this.backupService.create(body, apiKey.id);
  }

  @Get('history')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.VIEW_USAGE)
  history() {
    return this.backupService.getHistory();
  }

  @Get(':id/download')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.CREATE_BACKUP)
  async download(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { filePath, filename, record } = await this.backupService.getDownloadPath(id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(record.fileSizeBytes));
    fs.createReadStream(filePath).pipe(res);
  }

  @Post(':id/restore-preview')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.RESTORE_BACKUP)
  restorePreview(@Param('id') id: string) {
    return this.restoreService.preview(id);
  }

  @Post(':id/restore')
  @RequireRole(ApiKeyRole.OPERATOR)
  @RequireStoragePermission(StoragePermission.RESTORE_BACKUP)
  restore(
    @Param('id') id: string,
    @Body() body: RestoreBackupDto,
    @CurrentApiKey() apiKey: ApiKey,
  ) {
    return this.restoreService.restore(
      id,
      body.confirm === true,
      apiKey.id,
      body.mode ?? 'merge',
    );
  }
}
