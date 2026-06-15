import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiTrainingScanSchedule1781090000000 implements MigrationInterface {
  name = 'AddAiTrainingScanSchedule1781090000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: TableColumn[] = [
      new TableColumn({ name: 'dailyScanTime', type: 'varchar', length: '5', default: "'02:00'" }),
      new TableColumn({ name: 'useLlmTrainingSuggestions', type: 'boolean', default: true }),
    ];

    for (const col of cols) {
      if (!(await queryRunner.hasColumn('ai_learning_settings', col.name))) {
        await queryRunner.addColumn('ai_learning_settings', col);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['dailyScanTime', 'useLlmTrainingSuggestions']) {
      if (await queryRunner.hasColumn('ai_learning_settings', name)) {
        await queryRunner.dropColumn('ai_learning_settings', name);
      }
    }
  }
}
