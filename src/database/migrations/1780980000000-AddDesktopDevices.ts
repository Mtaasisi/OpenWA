import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault } from '../migration-utils';

export class AddDesktopDevices1780980000000 implements MigrationInterface {
  name = 'AddDesktopDevices1780980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('desktop_devices');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'desktop_devices',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default:
                queryRunner.connection.options.type === 'postgres'
                  ? 'gen_random_uuid()'
                  : undefined,
            },
            { name: 'deviceId', type: 'varchar', length: '64' },
            { name: 'deviceName', type: 'varchar', length: '255' },
            { name: 'businessId', type: 'varchar', length: '64', isNullable: true },
            { name: 'branchId', type: 'varchar', length: '64', isNullable: true },
            { name: 'appVersion', type: 'varchar', length: '32', isNullable: true },
            { name: 'os', type: 'varchar', length: '64', isNullable: true },
            { name: 'status', type: 'varchar', length: '16', default: "'active'" },
            { name: 'lastSeenAt', type: migDateTime(queryRunner), isNullable: true },
            { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
            { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner) },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'desktop_devices',
        new TableIndex({ name: 'IDX_desktop_devices_deviceId', columnNames: ['deviceId'], isUnique: true }),
      );
    }

    const sessionsTable = await queryRunner.getTable('sessions');
    if (sessionsTable && !sessionsTable.findColumnByName('controlledByDeviceId')) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'controlledByDeviceId',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'controlledAt',
          type: migDateTime(queryRunner),
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const sessionsTable = await queryRunner.getTable('sessions');
    if (sessionsTable?.findColumnByName('controlledByDeviceId')) {
      await queryRunner.dropColumn('sessions', 'controlledAt');
      await queryRunner.dropColumn('sessions', 'controlledByDeviceId');
    }
    await queryRunner.dropTable('desktop_devices', true);
  }
}
