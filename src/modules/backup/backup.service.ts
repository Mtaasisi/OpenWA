import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';
import { createGunzip } from 'zlib';
import * as tar from 'tar-stream';
import { Readable } from 'stream';
import {
  BackupRecord,
  BackupType,
  BackupStatus,
} from './entities/backup-record.entity';
import {
  BackupSettings,
  BACKUP_SETTINGS_ID,
  BackupMediaScope,
  BackupDestination,
} from './entities/backup-settings.entity';
import { StorageService } from '../../common/storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

import { CreateBackupDto, SaveBackupSettingsDto } from './dto/backup.dto';

export interface BackupMetadata {
  backupId: string;
  createdAt: string;
  createdBy: string | null;
  backupType: BackupType;
  includedModules: string[];
  mediaIncluded: boolean;
  fileSizeBytes: number;
  appVersion: string;
  dbVersion: string;
}

@Injectable()
export class BackupService {
  private readonly backupDir: string;

  constructor(
    @InjectRepository(BackupRecord, 'data')
    private readonly backupRepo: Repository<BackupRecord>,
    @InjectRepository(BackupSettings, 'data')
    private readonly settingsRepo: Repository<BackupSettings>,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async ensureSettings(): Promise<BackupSettings> {
    let row = await this.settingsRepo.findOne({ where: { id: BACKUP_SETTINGS_ID } });
    if (!row) {
      row = this.settingsRepo.create({ id: BACKUP_SETTINGS_ID });
      await this.settingsRepo.save(row);
    }
    return row;
  }

  async getSettings(): Promise<BackupSettings> {
    return this.ensureSettings();
  }

  async saveSettings(payload: SaveBackupSettingsDto): Promise<BackupSettings> {
    const row = await this.ensureSettings();
    const destination = (payload.destination ?? row.destination) as BackupDestination;

    if (destination === 's3' || destination === 'r2') {
      if (!this.storageService.hasS3Credentials()) {
        throw new BadRequestException(
          'Configure S3 credentials in Infrastructure before using a remote backup destination.',
        );
      }
    }

    if (destination === 'local') {
      payload.s3Bucket = null;
      payload.s3Region = null;
    } else {
      if (payload.s3Bucket !== undefined) {
        payload.s3Bucket = payload.s3Bucket?.trim() || null;
      }
      if (payload.s3Region !== undefined) {
        payload.s3Region = payload.s3Region?.trim() || null;
      }
    }

    Object.assign(row, payload);
    return this.settingsRepo.save(row);
  }

  private usesRemoteBackupDestination(settings: BackupSettings): boolean {
    return settings.destination === 's3' || settings.destination === 'r2';
  }

  private remoteBackupTarget(settings: BackupSettings): { bucket: string | null; region: string | null } {
    return {
      bucket: settings.s3Bucket?.trim() || null,
      region: settings.s3Region?.trim() || null,
    };
  }

  async readArchiveBuffer(record: BackupRecord): Promise<Buffer> {
    const filePath = path.join(this.backupDir, record.filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }

    if (!this.storageService.hasS3Credentials()) {
      throw new NotFoundException('Backup file not found');
    }

    const settings = await this.getSettings();
    return this.storageService.getBackupArchive(record.filename, this.remoteBackupTarget(settings));
  }

  async getHistory(): Promise<BackupRecord[]> {
    return this.backupRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
  }

  async getLastSuccessfulBackup(): Promise<BackupRecord | null> {
    return this.backupRepo.findOne({
      where: { status: 'completed' },
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateBackupDto, createdBy?: string): Promise<BackupRecord> {
    const record = this.backupRepo.create({
      filename: '',
      backupType: dto.backupType,
      includedModules: this.modulesForType(dto.backupType),
      mediaIncluded: dto.includeMedia ?? dto.mediaScope !== 'exclude',
      status: 'pending' as BackupStatus,
      createdBy: createdBy ?? null,
      appVersion: process.env.npm_package_version ?? '0.1.6',
      dbVersion: this.configService.get<string>('dataDatabase.type') ?? 'sqlite',
    });
    const saved = await this.backupRepo.save(record);

    const filename = `backup-${saved.id}.tar.gz`;
    const filePath = path.join(this.backupDir, filename);
    const metaPath = path.join(this.backupDir, `${saved.id}.meta.json`);

    try {
      const payload = await this.buildPayload(dto);
      await this.writeArchive(filePath, payload, dto);

      const stats = fs.statSync(filePath);
      const metadata: BackupMetadata = {
        backupId: saved.id,
        createdAt: new Date().toISOString(),
        createdBy: createdBy ?? null,
        backupType: dto.backupType,
        includedModules: saved.includedModules ?? [],
        mediaIncluded: saved.mediaIncluded,
        fileSizeBytes: stats.size,
        appVersion: saved.appVersion ?? '0.1.6',
        dbVersion: saved.dbVersion ?? 'sqlite',
      };
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

      saved.filename = filename;
      saved.fileSizeBytes = stats.size;
      saved.status = 'completed';
      await this.backupRepo.save(saved);

      const settings = await this.getSettings();
      if (this.usesRemoteBackupDestination(settings) && this.storageService.hasS3Credentials()) {
        const archiveBuffer = fs.readFileSync(filePath);
        await this.storageService.mirrorBackupArchive(
          filename,
          archiveBuffer,
          this.remoteBackupTarget(settings),
        );
      }

      await this.auditService.logInfo(AuditAction.BACKUP_CREATED, {
        metadata: { backupId: saved.id, backupType: dto.backupType, apiKeyId: createdBy },
      });

      return saved;
    } catch (error) {
      saved.status = 'failed';
      saved.error = error instanceof Error ? error.message : String(error);
      await this.backupRepo.save(saved);
      await this.auditService.logError(AuditAction.BACKUP_FAILED, {
        metadata: { backupId: saved.id, error: saved.error, apiKeyId: createdBy },
      });
      throw error;
    }
  }

  async findRecord(id: string): Promise<BackupRecord> {
    const record = await this.backupRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Backup not found');
    return record;
  }

  async getDownloadPath(id: string): Promise<{ filePath: string; filename: string; record: BackupRecord }> {
    const record = await this.findRecord(id);
    const filePath = path.join(this.backupDir, record.filename);
    if (!fs.existsSync(filePath)) {
      const buffer = await this.readArchiveBuffer(record);
      fs.writeFileSync(filePath, buffer);
    }
    return { filePath, filename: record.filename, record };
  }

  private modulesForType(type: BackupType): string[] {
    switch (type) {
      case 'messagesOnly':
        return ['sessions', 'messages'];
      case 'crmOnly':
        return ['followups', 'quotes', 'products', 'customers', 'templates', 'settings'];
      case 'messagesAndCrm':
        return ['sessions', 'messages', 'followups', 'quotes', 'products', 'templates', 'settings'];
      case 'mediaOnly':
        return ['media'];
      case 'full':
        return ['sessions', 'messages', 'followups', 'quotes', 'products', 'templates', 'settings', 'media', 'sms'];
      default:
        return [];
    }
  }

  private async buildPayload(dto: CreateBackupDto): Promise<Record<string, unknown>> {
    const modules = this.modulesForType(dto.backupType);
    const payload: Record<string, unknown> = { exportedAt: new Date().toISOString(), modules };

    const query = async (table: string): Promise<unknown[]> => {
      try {
        return await this.dataSource.query(`SELECT * FROM ${table}`);
      } catch {
        return [];
      }
    };

    if (modules.includes('sessions')) payload.sessions = await query('sessions');
    if (modules.includes('messages')) payload.messages = await query('messages');
    if (modules.includes('followups')) {
      payload.followup_conversations = await query('followup_conversations');
      payload.followup_rules = await query('followup_rules');
      payload.followup_message_templates = await query('followup_message_templates');
    }
    if (modules.includes('quotes')) {
      payload.crm_quotes = await query('crm_quotes');
      payload.crm_quote_items = await query('crm_quote_items');
    }
    if (modules.includes('products')) payload.crm_products = await query('crm_products');
    if (modules.includes('templates')) payload.quick_reply_templates = await query('quick_reply_templates');
    if (modules.includes('settings')) {
      payload.ai_config = await query('ai_config');
      payload.storage_config = await query('storage_config');
    }
    if (modules.includes('sms')) payload.sms_logs = await query('sms_logs');

    return payload;
  }

  private async writeArchive(
    filePath: string,
    payload: Record<string, unknown>,
    dto: CreateBackupDto,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(filePath);
      const archive = archiver.default('tar', { gzip: true, gzipOptions: { level: 6 } });

      output.on('close', () => resolve());
      archive.on('error', reject);
      archive.pipe(output);

      archive.append(JSON.stringify(payload, null, 2), { name: 'data.json' });

      void this.appendMedia(archive, dto).then(() => {
        archive.finalize();
      }).catch(reject);
    });
  }

  private async appendMedia(archive: archiver.Archiver, dto: CreateBackupDto): Promise<void> {
    const scope = dto.mediaScope ?? (dto.includeMedia ? 'all' : 'exclude');
    if (scope === 'exclude' && dto.backupType !== 'mediaOnly') return;

    const files = await this.storageService.listFiles();
    for (const file of files) {
      if (!file.startsWith('inbox/')) continue;
      const ext = path.extname(file).toLowerCase();
      if (scope === 'imagesOnly' && !['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        continue;
      }
      if (scope === 'documentsOnly' && !['.pdf', '.doc', '.docx', '.xls', '.xlsx'].includes(ext)) {
        continue;
      }
      try {
        const buffer = await this.storageService.getFile(file);
        archive.append(buffer, { name: `media/${file}` });
      } catch {
        // skip missing files
      }
    }
  }
}
