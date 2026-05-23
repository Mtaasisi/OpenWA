import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class AddCrmProducts1779700000000 implements MigrationInterface {
  name = 'AddCrmProducts1779700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'crm_products',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'sku', type: 'varchar', isNullable: true },
          { name: 'category', type: 'varchar', isNullable: true },
          { name: 'imageUrl', type: 'varchar', isNullable: true },
          { name: 'currency', type: 'varchar', length: '16', isNullable: true },
          { name: 'sellingPrice', type: 'real', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true, isNullable: false },
          { name: 'sortOrder', type: 'int', default: 0, isNullable: false },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'crm_products',
      new TableIndex({
        name: 'IDX_crm_products_active_name',
        columnNames: ['isActive', 'name'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'crm_product_variants',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'productId', type: 'varchar', length: '36', isNullable: false },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'sku', type: 'varchar', isNullable: true },
          { name: 'sellingPrice', type: 'real', isNullable: true },
          { name: 'quantity', type: 'int', default: 0, isNullable: false },
          { name: 'variantType', type: 'varchar', length: '32', default: "'standard'", isNullable: false },
          { name: 'isParent', type: 'boolean', default: false, isNullable: false },
          { name: 'parentVariantId', type: 'varchar', length: '36', isNullable: true },
          { name: 'attributes', type: 'text', isNullable: true },
          { name: 'isActive', type: 'boolean', default: true, isNullable: false },
          { name: 'sortOrder', type: 'int', default: 0, isNullable: false },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'crm_product_variants',
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'crm_products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'crm_product_variants',
      new TableIndex({
        name: 'IDX_crm_product_variants_product_parent',
        columnNames: ['productId', 'parentVariantId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('crm_product_variants');
    await queryRunner.dropTable('crm_products');
  }
}
