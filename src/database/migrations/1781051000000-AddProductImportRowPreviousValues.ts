import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductImportRowPreviousValues1781051000000 implements MigrationInterface {
  name = 'AddProductImportRowPreviousValues1781051000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('product_import_rows');
    if (table && !table.findColumnByName('previousValues')) {
      const colType = queryRunner.connection.options.type === 'postgres' ? 'jsonb' : 'text';
      await queryRunner.query(
        `ALTER TABLE product_import_rows ADD COLUMN previousValues ${colType} NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('product_import_rows');
    if (table?.findColumnByName('previousValues')) {
      await queryRunner.dropColumn('product_import_rows', 'previousValues');
    }
  }
}
