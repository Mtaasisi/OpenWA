import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiUnrestrictedMode1781020000000 implements MigrationInterface {
  name = 'AddAiUnrestrictedMode1781020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('ai_config', 'aiUnrestrictedMode');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'ai_config',
        new TableColumn({
          name: 'aiUnrestrictedMode',
          type: 'boolean',
          default: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('ai_config', 'aiUnrestrictedMode');
    if (hasColumn) {
      await queryRunner.dropColumn('ai_config', 'aiUnrestrictedMode');
    }
  }
}
