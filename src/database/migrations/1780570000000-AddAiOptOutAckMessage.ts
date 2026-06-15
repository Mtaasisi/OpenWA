import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiOptOutAckMessage1780570000000 implements MigrationInterface {
  name = 'AddAiOptOutAckMessage1780570000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'ai_config',
      new TableColumn({
        name: 'autoReplyOptOutMessage',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('ai_config', 'autoReplyOptOutMessage');
  }
}
