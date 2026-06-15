import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddProductDemandCampaigns1780920000000 implements MigrationInterface {
  name = 'AddProductDemandCampaigns1780920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'product_demand_campaigns',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'title', type: 'varchar' },
          { name: 'message', type: 'text' },
          { name: 'channel', type: 'varchar', length: '16', default: "'sms'" },
          { name: 'status', type: 'varchar', length: '32', default: "'draft'" },
          { name: 'productNames', type: 'text', isNullable: true },
          { name: 'productIds', type: 'text', isNullable: true },
          { name: 'recommendationId', type: 'varchar', isNullable: true },
          { name: 'summaryId', type: 'varchar', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'sessionId', type: 'varchar', isNullable: true },
          { name: 'recipientCount', type: 'int', default: 0 },
          { name: 'sentCount', type: 'int', default: 0 },
          { name: 'recipients', type: 'text', isNullable: true },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'sentAt', type: dt, isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_demand_campaigns', true);
  }
}
