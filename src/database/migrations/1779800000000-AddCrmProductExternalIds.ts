import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddCrmProductExternalIds1779800000000 implements MigrationInterface {
  name = 'AddCrmProductExternalIds1779800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'crm_products',
      new TableColumn({
        name: 'externalId',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'crm_product_variants',
      new TableColumn({
        name: 'externalId',
        type: 'varchar',
        isNullable: true,
      }),
    );
    await queryRunner.createIndex(
      'crm_products',
      new TableIndex({
        name: 'UQ_crm_products_externalId',
        columnNames: ['externalId'],
        isUnique: true,
        where: '"externalId" IS NOT NULL',
      }),
    );
    await queryRunner.createIndex(
      'crm_product_variants',
      new TableIndex({
        name: 'UQ_crm_product_variants_externalId',
        columnNames: ['externalId'],
        isUnique: true,
        where: '"externalId" IS NOT NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('crm_product_variants', 'UQ_crm_product_variants_externalId');
    await queryRunner.dropIndex('crm_products', 'UQ_crm_products_externalId');
    await queryRunner.dropColumn('crm_product_variants', 'externalId');
    await queryRunner.dropColumn('crm_products', 'externalId');
  }
}
