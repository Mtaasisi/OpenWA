import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAiAutoReplyBusinessHours1780510000000 implements MigrationInterface {
  name = 'AddAiAutoReplyBusinessHours1780510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('ai_config', [
      new TableColumn({
        name: 'autoReplyOutsideHoursOnly',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'autoReplyTimezone',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'autoReplyStartHour',
        type: 'int',
        isNullable: false,
        default: 9,
      }),
      new TableColumn({
        name: 'autoReplyEndHour',
        type: 'int',
        isNullable: false,
        default: 17,
      }),
      new TableColumn({
        name: 'autoReplyWeekdays',
        type: 'text',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('ai_config', 'autoReplyWeekdays');
    await queryRunner.dropColumn('ai_config', 'autoReplyEndHour');
    await queryRunner.dropColumn('ai_config', 'autoReplyStartHour');
    await queryRunner.dropColumn('ai_config', 'autoReplyTimezone');
    await queryRunner.dropColumn('ai_config', 'autoReplyOutsideHoursOnly');
  }
}
