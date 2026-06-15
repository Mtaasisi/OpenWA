import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { createGunzip } from 'zlib';
import * as tar from 'tar-stream';
import { BackupService } from './backup.service';
import type { BackupRecord } from './entities/backup-record.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';
import {
  buildRestoreInsertForDriver,
  type RestoreInsertMode,
} from './utils/restore-sql.util';

export interface RestorePreviewMessage {
  id: string;
  params?: Record<string, string | number>;
}

export interface RestorePreviewResult {
  backupId: string;
  modules: string[];
  recordCounts: Record<string, number>;
  conflicts: RestorePreviewMessage[];
  warnings: RestorePreviewMessage[];
  supportedModes: RestoreInsertMode[];
}

@Injectable()
export class BackupRestoreService {
  private readonly backupDir: string;

  constructor(
    private readonly backupService: BackupService,
    @InjectDataSource('data')
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {
    this.backupDir = path.join(process.cwd(), 'data', 'backups');
  }

  async preview(backupId: string): Promise<RestorePreviewResult> {
    const record = await this.backupService.findRecord(backupId);
    const data = await this.readBackupJson(record);

    const recordCounts: Record<string, number> = {};
    const conflicts: RestorePreviewMessage[] = [];
    const warnings: RestorePreviewMessage[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        recordCounts[key] = value.length;
      }
    }

    const existingSessions = await this.countTableRows('sessions');
    if (existingSessions > 0 && (recordCounts.sessions ?? 0) > 0) {
      conflicts.push({
        id: 'sessions_merge',
        params: { count: existingSessions },
      });
    }

    if ((recordCounts.messages ?? 0) > 0) {
      warnings.push({ id: 'messages_duplicates' });
    }

    warnings.push({ id: 'never_deletes' });
    warnings.push({ id: 'upsert_hint' });

    return {
      backupId,
      modules: record.includedModules ?? [],
      recordCounts,
      conflicts,
      warnings,
      supportedModes: ['merge', 'upsert'],
    };
  }

  async restore(
    backupId: string,
    confirm: boolean,
    apiKeyId?: string,
    mode: RestoreInsertMode = 'merge',
  ): Promise<{ restored: boolean; imported: Record<string, number>; mode: RestoreInsertMode }> {
    if (!confirm) {
      throw new BadRequestException('Restore requires confirm=true after preview.');
    }
    if (mode !== 'merge' && mode !== 'upsert') {
      throw new BadRequestException('Restore mode must be merge or upsert.');
    }

    const record = await this.backupService.findRecord(backupId);
    const data = await this.readBackupJson(record);
    const imported: Record<string, number> = {};

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const [table, rows] of Object.entries(data)) {
        if (!Array.isArray(rows) || table === 'exportedAt' || table === 'modules') continue;
        let count = 0;
        for (const row of rows as Record<string, unknown>[]) {
          try {
            const columns = Object.keys(row);
            const values = columns.map(c => row[c]);
            const sql = buildRestoreInsertForDriver(this.dataSource, table, columns, mode);
            await queryRunner.query(sql, values);
            count += 1;
          } catch {
            // skip incompatible rows
          }
        }
        imported[table] = count;
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    await this.auditService.logWarn(AuditAction.BACKUP_RESTORED, {
      metadata: { backupId, imported, mode, apiKeyId },
    });

    return { restored: true, imported, mode };
  }

  private async countTableRows(table: string): Promise<number> {
    try {
      const rows = await this.dataSource.query(`SELECT COUNT(*) as count FROM ${table}`);
      return Number(rows?.[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async readBackupJson(record: BackupRecord): Promise<Record<string, unknown>> {
    const filePath = path.join(this.backupDir, record.filename);
    if (!fs.existsSync(filePath)) {
      const buffer = await this.backupService.readArchiveBuffer(record);
      fs.writeFileSync(filePath, buffer);
    }

    return new Promise((resolve, reject) => {
      const extract = tar.extract();
      const gunzip = createGunzip();
      const input = fs.createReadStream(filePath);

      extract.on('entry', (header, stream, next) => {
        if (header.name === 'data.json') {
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>);
            } catch (error) {
              reject(error);
            }
            next();
          });
          stream.resume();
        } else {
          stream.on('end', () => next());
          stream.resume();
        }
      });

      extract.on('finish', () => {
        reject(new NotFoundException('data.json not found in backup archive'));
      });
      extract.on('error', reject);

      input.pipe(gunzip).pipe(extract);
    });
  }
}
