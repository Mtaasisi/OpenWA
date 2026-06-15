import { migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddCrmInauzwaSyncSettings1779900000000 implements MigrationInterface {
  name = 'AddCrmInauzwaSyncSettings1779900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'crm_inauzwa_sync_settings',
        columns: [
          { name: 'id', type: 'varchar', isPrimary: true, default: "'default'" },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'vendorId', type: 'varchar', isNullable: true },
          { name: 'autoSyncEnabled', type: 'boolean', default: false, isNullable: false },
          { name: 'autoSyncIntervalMinutes', type: 'int', default: 60, isNullable: false },
          { name: 'refreshBeforeSend', type: 'boolean', default: true, isNullable: false },
          { name: 'lastSyncAt', type: migDateTime(queryRunner), isNullable: true },
          { name: 'lastSyncResultJson', type: 'text', isNullable: true },
          { name: 'lastSyncError', type: 'text', isNullable: true },
          { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('crm_inauzwa_sync_settings');
  }
}
