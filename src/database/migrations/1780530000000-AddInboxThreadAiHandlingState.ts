import { migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInboxThreadAiHandlingState1780530000000 implements MigrationInterface {
  name = 'AddInboxThreadAiHandlingState1780530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'aiHandlingState',
        type: 'varchar',
        length: '32',
        default: "'idle'",
        isNullable: false,
      }),
    );
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'aiEscalatedAt',
        type: migDateTime(queryRunner),
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'inbox_thread_crm',
      new TableColumn({
        name: 'aiFailureCount',
        type: 'integer',
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('inbox_thread_crm', 'aiFailureCount');
    await queryRunner.dropColumn('inbox_thread_crm', 'aiEscalatedAt');
    await queryRunner.dropColumn('inbox_thread_crm', 'aiHandlingState');
  }
}
