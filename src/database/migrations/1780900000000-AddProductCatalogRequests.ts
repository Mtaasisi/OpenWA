import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddProductCatalogRequests1780900000000 implements MigrationInterface {
  name = 'AddProductCatalogRequests1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);

    await queryRunner.createTable(
      new Table({
        name: 'product_catalog_requests',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'productName', type: 'varchar' },
          { name: 'category', type: 'varchar', isNullable: true },
          { name: 'brand', type: 'varchar', isNullable: true },
          { name: 'suggestedSpecs', type: 'text', isNullable: true },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'customerCount', type: 'int', default: 1 },
          { name: 'exampleMessages', type: 'text', isNullable: true },
          { name: 'priority', type: 'varchar', length: '16', default: "'medium'" },
          { name: 'notes', type: 'text', isNullable: true },
          { name: 'assignedStaffId', type: 'varchar', isNullable: true },
          { name: 'dueDate', type: dt, isNullable: true },
          { name: 'missingProductRequestId', type: 'varchar', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'open'" },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    const summaryTable = await queryRunner.getTable('product_demand_summary');
    if (summaryTable && !summaryTable.findColumnByName('customerIds')) {
      await queryRunner.query(
        `ALTER TABLE "product_demand_summary" ADD COLUMN "customerIds" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('product_catalog_requests', true);
    const summaryTable = await queryRunner.getTable('product_demand_summary');
    if (summaryTable?.findColumnByName('customerIds')) {
      await queryRunner.query(`ALTER TABLE "product_demand_summary" DROP COLUMN "customerIds"`);
    }
  }
}
