import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTrainingGroupChatsMode1781110000000 implements MigrationInterface {
  name = 'AddTrainingGroupChatsMode1781110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('ai_learning_settings', 'trainingGroupChatsMode'))) {
      await queryRunner.addColumn(
        'ai_learning_settings',
        new TableColumn({ name: 'trainingGroupChatsMode', type: 'varchar', default: "'skip'" }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('ai_learning_settings', 'trainingGroupChatsMode')) {
      await queryRunner.dropColumn('ai_learning_settings', 'trainingGroupChatsMode');
    }
  }
}
