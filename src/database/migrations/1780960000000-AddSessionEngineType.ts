import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSessionEngineType1780960000000 implements MigrationInterface {
  name = 'AddSessionEngineType1780960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'sessions',
      new TableColumn({
        name: 'engineType',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('sessions', 'engineType');
  }
}
