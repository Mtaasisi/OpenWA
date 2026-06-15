import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddStorageBackup1780799000000 implements MigrationInterface {
  name = 'AddStorageBackup1780799000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'storage_config',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'globalSettings', type: 'text', isNullable: true },
          { name: 'chatTypeSettings', type: 'text', isNullable: true },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'storage_session_override',
        columns: [
          { name: 'sessionId', type: 'varchar', isPrimary: true },
          { name: 'allowGroupAutoDownload', type: 'boolean', default: false, isNullable: false },
          { name: 'manualDownloadOnlyForGroups', type: 'boolean', default: true, isNullable: false },
          { name: 'autoDownloadImages', type: 'boolean', isNullable: true },
          { name: 'autoDownloadVideos', type: 'boolean', isNullable: true },
          { name: 'autoDownloadDocuments', type: 'boolean', isNullable: true },
          { name: 'autoDownloadAudio', type: 'boolean', isNullable: true },
          { name: 'autoDownloadVoice', type: 'boolean', isNullable: true },
          { name: 'autoDownloadStickers', type: 'boolean', isNullable: true },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'backup_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'schedule', type: 'varchar', default: "'manual'", isNullable: false },
          { name: 'backupTime', type: 'varchar', default: "'02:00'", isNullable: false },
          { name: 'includeMedia', type: 'boolean', default: false, isNullable: false },
          { name: 'mediaScope', type: 'varchar', default: "'exclude'", isNullable: false },
          { name: 'destination', type: 'varchar', default: "'local'", isNullable: false },
          { name: 's3Bucket', type: 'varchar', isNullable: true },
          { name: 's3Region', type: 'varchar', isNullable: true },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'backup_records',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'filename', type: 'varchar', isNullable: false },
          { name: 'backupType', type: 'varchar', isNullable: false },
          { name: 'includedModules', type: 'text', isNullable: true },
          { name: 'mediaIncluded', type: 'boolean', default: false, isNullable: false },
          { name: 'fileSizeBytes', type: 'bigint', default: 0, isNullable: false },
          { name: 'appVersion', type: 'varchar', isNullable: true },
          { name: 'dbVersion', type: 'varchar', isNullable: true },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', default: "'completed'", isNullable: false },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('backup_records');
    await queryRunner.dropTable('backup_settings');
    await queryRunner.dropTable('storage_session_override');
    await queryRunner.dropTable('storage_config');
  }
}
