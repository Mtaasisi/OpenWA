import { migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class ExtendFollowupConversationsPipeline1780100000000 implements MigrationInterface {
  name = 'ExtendFollowupConversationsPipeline1780100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols: TableColumn[] = [
      new TableColumn({ name: 'customerId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'customerHandle', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'channel', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'priority', type: 'varchar', default: "'normal'", isNullable: false }),
      new TableColumn({ name: 'firstMessageAt', type: migDateTime(queryRunner), isNullable: true }),
      new TableColumn({ name: 'firstResponseAt', type: migDateTime(queryRunner), isNullable: true }),
      new TableColumn({ name: 'responseTimeSeconds', type: 'int', isNullable: true }),
      new TableColumn({ name: 'followupRequired', type: 'boolean', default: false, isNullable: false }),
      new TableColumn({ name: 'followupCompleted', type: 'boolean', default: false, isNullable: false }),
      new TableColumn({ name: 'customerRefusedFollowup', type: 'boolean', default: false, isNullable: false }),
      new TableColumn({ name: 'closedAt', type: migDateTime(queryRunner), isNullable: true }),
      new TableColumn({ name: 'isManual', type: 'boolean', default: false, isNullable: false }),
      new TableColumn({ name: 'nextAction', type: 'varchar', isNullable: true }),
    ];

    for (const col of cols) {
      await queryRunner.addColumn('followup_conversations', col);
    }

    await queryRunner.createIndex(
      'followup_conversations',
      new TableIndex({ name: 'IDX_followup_conv_priority', columnNames: ['priority'] }),
    );
    await queryRunner.createIndex(
      'followup_conversations',
      new TableIndex({ name: 'IDX_followup_conv_source', columnNames: ['source'] }),
    );
    await queryRunner.createIndex(
      'followup_conversations',
      new TableIndex({ name: 'IDX_followup_conv_assigned', columnNames: ['assignedStaffId'] }),
    );

    // Migrate legacy stage value
    await queryRunner.query(
      `UPDATE followup_conversations SET stage = 'contacted' WHERE stage = 'replied'`,
    );
    if (queryRunner.connection.options.type === 'postgres') {
      await queryRunner.query(
        `UPDATE followup_conversations SET "followupCompleted" = "followupCompletedBeforeClose" WHERE "followupCompletedBeforeClose" = true`,
      );
    } else {
      await queryRunner.query(
        `UPDATE followup_conversations SET followupCompleted = followupCompletedBeforeClose WHERE followupCompletedBeforeClose = 1`,
      );
    }
    await queryRunner.query(
      `UPDATE followup_conversations SET channel = source WHERE channel IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('followup_conversations', 'IDX_followup_conv_assigned');
    await queryRunner.dropIndex('followup_conversations', 'IDX_followup_conv_source');
    await queryRunner.dropIndex('followup_conversations', 'IDX_followup_conv_priority');

    const names = [
      'customerId',
      'customerHandle',
      'channel',
      'priority',
      'firstMessageAt',
      'firstResponseAt',
      'responseTimeSeconds',
      'followupRequired',
      'followupCompleted',
      'customerRefusedFollowup',
      'closedAt',
      'isManual',
      'nextAction',
    ];
    for (const name of names) {
      await queryRunner.dropColumn('followup_conversations', name);
    }
  }
}
