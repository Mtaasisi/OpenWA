import { migDateTime } from '../migration-utils';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductCatalogRequestProductLink1780910000000 implements MigrationInterface {
  name = 'AddProductCatalogRequestProductLink1780910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const table = await queryRunner.getTable('product_catalog_requests');
    if (!table) return;

    if (!table.findColumnByName('productId')) {
      await queryRunner.query(
        `ALTER TABLE "product_catalog_requests" ADD COLUMN "productId" varchar`,
      );
    }
    if (!table.findColumnByName('fulfilledAt')) {
      await queryRunner.query(
        `ALTER TABLE "product_catalog_requests" ADD COLUMN "fulfilledAt" ${dt}`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('product_catalog_requests');
    if (!table) return;
    if (table.findColumnByName('fulfilledAt')) {
      await queryRunner.query(`ALTER TABLE "product_catalog_requests" DROP COLUMN "fulfilledAt"`);
    }
    if (table.findColumnByName('productId')) {
      await queryRunner.query(`ALTER TABLE "product_catalog_requests" DROP COLUMN "productId"`);
    }
  }
}
