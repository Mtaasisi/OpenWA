import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiToolAndRagToggles1780850000000 implements MigrationInterface {
  name = 'AddAiToolAndRagToggles1780850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'ai_config',
      new TableColumn({
        name: 'disabledTools',
        type: 'text',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'ai_config',
      new TableColumn({
        name: 'knowledgeRagEnabled',
        type: 'boolean',
        default: true,
      }),
    );
    await queryRunner.addColumn(
      'ai_config',
      new TableColumn({
        name: 'memoryRagEnabled',
        type: 'boolean',
        default: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('ai_config', 'memoryRagEnabled');
    await queryRunner.dropColumn('ai_config', 'knowledgeRagEnabled');
    await queryRunner.dropColumn('ai_config', 'disabledTools');
  }
}
