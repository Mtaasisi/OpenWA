import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAiLearningAnalysisFields1780860000000 implements MigrationInterface {
  name = 'AddAiLearningAnalysisFields1780860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_learning_imports" ADD COLUMN "intentBreakdown" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_learning_imports" ADD COLUMN "replySamples" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_learning_imports" ADD COLUMN "importFormat" varchar(32)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_learning_imports" DROP COLUMN "importFormat"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_learning_imports" DROP COLUMN "replySamples"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_learning_imports" DROP COLUMN "intentBreakdown"`,
    );
  }
}
