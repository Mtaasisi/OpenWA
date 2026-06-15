import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Message } from '../message/entities/message.entity';
import { Session } from '../session/entities/session.entity';
import { BackupRecord } from '../backup/entities/backup-record.entity';
import { BackupSettings, BACKUP_SETTINGS_ID } from '../backup/entities/backup-settings.entity';
import { StorageService } from '../../common/storage/storage.service';
import { inferStorageChatType, messageTypeToMediaKind } from '../../common/utils/conversation-type.util';
import { StorageSettingsService } from './storage-settings.service';
import { jsonPathIsNotNull } from '../../common/utils/sql-dialect.util';

export interface StorageUsageBreakdown {
  totalBytes: number;
  messagesDbBytes: number;
  mediaBytes: number;
  imagesBytes: number;
  videosBytes: number;
  documentsBytes: number;
  audioVoiceBytes: number;
  stickersBytes: number;
  sessionDataBytes: number;
  backupBytes: number;
  bySession: Array<{ sessionId: string; sessionName: string; bytes: number }>;
  byChatType: Record<string, number>;
  byMediaType: Record<string, number>;
}

export interface StorageWarning {
  id: string;
  severity: 'high' | 'medium';
  message: string;
}

@Injectable()
export class StorageUsageService {
  constructor(
    @InjectRepository(Message, 'data')
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(Session, 'data')
    private readonly sessionRepo: Repository<Session>,
    @InjectRepository(BackupRecord, 'data')
    private readonly backupRepo: Repository<BackupRecord>,
    @InjectRepository(BackupSettings, 'data')
    private readonly backupSettingsRepo: Repository<BackupSettings>,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
    private readonly settingsService: StorageSettingsService,
  ) {}

  async getUsage(): Promise<StorageUsageBreakdown> {
    const sessions = await this.sessionRepo.find();
    const sessionMap = new Map(sessions.map(s => [s.id, s.name]));

    const messages = await this.messageRepo
      .createQueryBuilder('m')
      .where(jsonPathIsNotNull('m.metadata', '$.media.storagePath'))
      .orWhere("m.type IN ('image','video','document','audio','ptt','sticker')")
      .getMany();

    let mediaBytes = 0;
    let imagesBytes = 0;
    let videosBytes = 0;
    let documentsBytes = 0;
    let audioVoiceBytes = 0;
    let stickersBytes = 0;
    const bySession = new Map<string, number>();
    const byChatType: Record<string, number> = {};
    const byMediaType: Record<string, number> = {};

    for (const msg of messages) {
      const meta = (msg.metadata as { media?: { storagePath?: string; sizeBytes?: number } })?.media;
      const size = meta?.sizeBytes ?? 0;
      if (size <= 0) continue;

      mediaBytes += size;
      bySession.set(msg.sessionId, (bySession.get(msg.sessionId) ?? 0) + size);

      const chatType = inferStorageChatType(msg.chatId);
      byChatType[chatType] = (byChatType[chatType] ?? 0) + size;

      const kind = messageTypeToMediaKind(msg.type) ?? 'other';
      byMediaType[kind] = (byMediaType[kind] ?? 0) + size;

      switch (kind) {
        case 'image':
          imagesBytes += size;
          break;
        case 'video':
          videosBytes += size;
          break;
        case 'document':
          documentsBytes += size;
          break;
        case 'audio':
        case 'voice':
          audioVoiceBytes += size;
          break;
        case 'sticker':
          stickersBytes += size;
          break;
      }
    }

    const messagesDbBytes = this.getDbFileSize();
    const sessionDataBytes = this.getDirectorySize(
      this.configService.get<string>('engine.sessionPath') ?? './data/sessions',
    );
    const backupBytes = this.getDirectorySize(
      path.join(process.cwd(), 'data', 'backups'),
      '.tar.gz',
    );

    const fileStats = await this.storageService.getFileCount();
    const totalBytes = Math.max(mediaBytes, fileStats.sizeBytes) + messagesDbBytes + sessionDataBytes + backupBytes;

    return {
      totalBytes,
      messagesDbBytes,
      mediaBytes: Math.max(mediaBytes, fileStats.sizeBytes),
      imagesBytes,
      videosBytes,
      documentsBytes,
      audioVoiceBytes,
      stickersBytes,
      sessionDataBytes,
      backupBytes,
      bySession: [...bySession.entries()].map(([sessionId, bytes]) => ({
        sessionId,
        sessionName: sessionMap.get(sessionId) ?? sessionId,
        bytes,
      })),
      byChatType,
      byMediaType,
    };
  }

  async getWarnings(): Promise<StorageWarning[]> {
    const warnings: StorageWarning[] = [];
    const usage = await this.getUsage();
    const settings = await this.settingsService.getSettings();

    const softCapBytes = 10 * 1024 * 1024 * 1024;
    if (usage.totalBytes >= softCapBytes * 0.85) {
      warnings.push({
        id: 'storage_almost_full',
        severity: 'high',
        message: 'Storage is almost full. Review media cleanup or backup options.',
      });
    }

    const groupBytes = usage.byChatType.group ?? 0;
    if (usage.mediaBytes > 0 && groupBytes / usage.mediaBytes > 0.5) {
      warnings.push({
        id: 'group_media_high',
        severity: 'medium',
        message: 'Group media is using more than half of stored media.',
      });
    }

    const lastBackupMeta = this.getLatestBackupMeta();
    if (lastBackupMeta?.status === 'failed') {
      warnings.push({
        id: 'backup_failed',
        severity: 'high',
        message: 'The last backup failed. Check Storage & Backup settings.',
      });
    }

    const backupSettings = await this.getBackupScheduleHint();
    if (backupSettings.overdue) {
      warnings.push({
        id: 'backup_overdue',
        severity: 'medium',
        message: 'Scheduled backup is overdue.',
      });
    }

    void settings;
    return warnings;
  }

  private getLatestBackupMeta(): { status?: string } | null {
    try {
      const backupDir = path.join(process.cwd(), 'data', 'backups');
      if (!fs.existsSync(backupDir)) return null;
      const metas = fs
        .readdirSync(backupDir)
        .filter(f => f.endsWith('.meta.json'))
        .map(f => {
          const raw = fs.readFileSync(path.join(backupDir, f), 'utf8');
          return JSON.parse(raw) as { status?: string; createdAt?: string };
        })
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      return metas[0] ?? null;
    } catch {
      return null;
    }
  }

  private async getBackupScheduleHint(): Promise<{ overdue: boolean }> {
    try {
      const settings =
        (await this.backupSettingsRepo.findOne({ where: { id: BACKUP_SETTINGS_ID } })) ??
        null;
      if (!settings || settings.schedule === 'manual') return { overdue: false };

      const last = await this.backupRepo.findOne({
        where: { status: 'completed' },
        order: { createdAt: 'DESC' },
      });

      const now = new Date();
      const [hhRaw, mmRaw] = (settings.backupTime ?? '02:00').split(':');
      const slot = new Date(now);
      slot.setHours(Number(hhRaw) || 2, Number(mmRaw) || 0, 0, 0);
      if (now < slot) return { overdue: false };

      if (!last) return { overdue: true };

      const lastAt = new Date(last.createdAt);
      switch (settings.schedule) {
        case 'daily':
          return { overdue: lastAt < slot };
        case 'weekly':
          return {
            overdue:
              now.getTime() - lastAt.getTime() >= 7 * 24 * 60 * 60 * 1000 && lastAt < slot,
          };
        case 'monthly':
          return {
            overdue:
              lastAt.getFullYear() < now.getFullYear() ||
              lastAt.getMonth() < now.getMonth(),
          };
        default:
          return { overdue: false };
      }
    } catch {
      return { overdue: false };
    }
  }

  private getDbFileSize(): number {
    const dbPath =
      this.configService.get<string>('dataDatabase.database') ?? './data/openwa.sqlite';
    try {
      return fs.statSync(dbPath).size;
    } catch {
      return 0;
    }
  }

  private getDirectorySize(dirPath: string, suffix?: string): number {
    try {
      if (!fs.existsSync(dirPath)) return 0;
      let total = 0;
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (!suffix || entry.name.endsWith(suffix)) {
            total += fs.statSync(full).size;
          }
        }
      };
      walk(dirPath);
      return total;
    } catch {
      return 0;
    }
  }
}
