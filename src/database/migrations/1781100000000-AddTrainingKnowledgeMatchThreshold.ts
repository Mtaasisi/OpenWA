import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTrainingKnowledgeMatchThreshold1781100000000 implements MigrationInterface {
  name = 'AddTrainingKnowledgeMatchThreshold1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('ai_learning_settings', 'trainingKnowledgeMatchThreshold'))) {
      await queryRunner.addColumn(
        'ai_learning_settings',
        new TableColumn({ name: 'trainingKnowledgeMatchThreshold', type: 'real', default: 0.65 }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('ai_learning_settings', 'trainingKnowledgeMatchThreshold')) {
      await queryRunner.dropColumn('ai_learning_settings', 'trainingKnowledgeMatchThreshold');
    }
  }
}
