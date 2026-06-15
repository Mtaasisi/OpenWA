import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProductImageUrls1779980000000 implements MigrationInterface {
  name = 'AddProductImageUrls1779980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'crm_products',
      new TableColumn({
        name: 'imageUrls',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('crm_products', 'imageUrls');
  }
}
