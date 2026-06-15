import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';
import {
  migDateTime,
  migNowDefault,
  migPrimaryUuidColumn,
  migUuidFkColumn,
} from '../migration-utils';

export class AddAiTrainingCenter1781080000000 implements MigrationInterface {
  name = 'AddAiTrainingCenter1781080000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);
    const isPg = queryRunner.connection.options.type === 'postgres';
    const boolDef = (v: boolean) => (isPg ? v : v ? 1 : 0);

    const itemCols: TableColumn[] = [
      new TableColumn({ name: 'issueType', type: 'varchar', length: '48', isNullable: true }),
      new TableColumn({ name: 'sourceType', type: 'varchar', length: '48', isNullable: true }),
      new TableColumn({ name: 'sourceId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'messageId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'productId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'relatedEntityType', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'relatedEntityId', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'title', type: 'varchar', length: '300', isNullable: true }),
      new TableColumn({ name: 'conversationExcerpt', type: 'text', isNullable: true }),
      new TableColumn({ name: 'suggestedMemoryType', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'suggestedRuleCategory', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'suggestedQuestionType', type: 'varchar', isNullable: true }),
      new TableColumn({ name: 'createdByAi', type: 'boolean', default: boolDef(true), isNullable: true }),
      new TableColumn({ name: 'reviewedAt', type: dt, isNullable: true }),
      new TableColumn({ name: 'appliedAt', type: dt, isNullable: true }),
      new TableColumn({ name: 'metadata', type: 'text', isNullable: true }),
    ];

    for (const col of itemCols) {
      if (!(await queryRunner.hasColumn('ai_learning_items', col.name))) {
        await queryRunner.addColumn('ai_learning_items', col);
      }
    }

    const settingsCols: TableColumn[] = [
      new TableColumn({ name: 'trainingCenterEnabled', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'autoCreateFromLowConfidence', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'autoCreateFromHumanReplies', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'dailyInboxScan', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'scanLastDays', type: 'int', default: 7 }),
      new TableColumn({ name: 'autoClusterRepeated', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'autoReindexAfterApproval', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'allowMarkdownWrites', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'allowMemoryWrites', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'allowDbTrainingRules', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'maskPrivateDataInExports', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'autoReindexSmallUpdatesOnly', type: 'boolean', default: boolDef(true) }),
      new TableColumn({ name: 'knowledgeIndexStale', type: 'boolean', default: boolDef(false) }),
    ];

    for (const col of settingsCols) {
      if (!(await queryRunner.hasColumn('ai_learning_settings', col.name))) {
        await queryRunner.addColumn('ai_learning_settings', col);
      }
    }

    if (!(await queryRunner.hasTable('ai_training_suggestions'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_training_suggestions',
          columns: [
            migPrimaryUuidColumn(queryRunner),
            migUuidFkColumn(queryRunner, 'trainingItemId'),
            { name: 'optionLabel', type: 'varchar', length: '8', isNullable: true },
            { name: 'optionText', type: 'varchar', length: '200', isNullable: true },
            { name: 'responseText', type: 'text', isNullable: true },
            { name: 'actionType', type: 'varchar', length: '48' },
            { name: 'targetFile', type: 'varchar', isNullable: true },
            { name: 'targetSection', type: 'varchar', isNullable: true },
            { name: 'targetKey', type: 'varchar', isNullable: true },
            { name: 'confidence', type: 'real', default: 0.5 },
            { name: 'reasoning', type: 'text', isNullable: true },
            { name: 'risks', type: 'text', isNullable: true },
            { name: 'isRecommended', type: 'boolean', default: boolDef(false) },
            { name: 'createdAt', type: dt, default: now },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'ai_training_suggestions',
        new TableIndex({ name: 'IDX_ai_training_sugg_item', columnNames: ['trainingItemId'] }),
      );
    }

    if (!(await queryRunner.hasTable('ai_training_approvals'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_training_approvals',
          columns: [
            migPrimaryUuidColumn(queryRunner),
            migUuidFkColumn(queryRunner, 'trainingItemId'),
            migUuidFkColumn(queryRunner, 'selectedSuggestionId', true),
            { name: 'customAnswer', type: 'text', isNullable: true },
            { name: 'customInstruction', type: 'text', isNullable: true },
            { name: 'targetFile', type: 'varchar', isNullable: true },
            { name: 'targetSection', type: 'varchar', isNullable: true },
            { name: 'updateMode', type: 'varchar', length: '32', default: "'append'" },
            { name: 'status', type: 'varchar', length: '16', default: "'pending'" },
            { name: 'approvedBy', type: 'varchar', isNullable: true },
            { name: 'appliedBy', type: 'varchar', isNullable: true },
            { name: 'oldContentSnapshot', type: 'text', isNullable: true },
            { name: 'newContentSnapshot', type: 'text', isNullable: true },
            { name: 'fileBackupPath', type: 'varchar', isNullable: true },
            { name: 'reindexRequested', type: 'boolean', default: boolDef(false) },
            { name: 'reindexStatus', type: 'varchar', length: '32', isNullable: true },
            { name: 'error', type: 'text', isNullable: true },
            { name: 'createdAt', type: dt, default: now },
            { name: 'appliedAt', type: dt, isNullable: true },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'ai_training_approvals',
        new TableIndex({ name: 'IDX_ai_training_appr_item', columnNames: ['trainingItemId'] }),
      );
      await queryRunner.createIndex(
        'ai_training_approvals',
        new TableIndex({ name: 'IDX_ai_training_appr_status', columnNames: ['status'] }),
      );
    }

    if (!(await queryRunner.hasTable('ai_training_audit_logs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'ai_training_audit_logs',
          columns: [
            migPrimaryUuidColumn(queryRunner),
            migUuidFkColumn(queryRunner, 'trainingItemId'),
            { name: 'action', type: 'varchar', length: '32' },
            { name: 'actorType', type: 'varchar', length: '16' },
            { name: 'actorId', type: 'varchar', isNullable: true },
            { name: 'summary', type: 'text' },
            { name: 'details', type: 'text', isNullable: true },
            { name: 'createdAt', type: dt, default: now },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'ai_training_audit_logs',
        new TableIndex({ name: 'IDX_ai_training_audit_item', columnNames: ['trainingItemId', 'createdAt'] }),
      );
      await queryRunner.createIndex(
        'ai_training_audit_logs',
        new TableIndex({ name: 'IDX_ai_training_audit_action', columnNames: ['action'] }),
      );
    }

    const extraIndexes: Array<{ table: string; name: string; cols: string[] }> = [
      { table: 'ai_learning_items', name: 'IDX_ai_learning_issue', cols: ['issueType'] },
      { table: 'ai_learning_items', name: 'IDX_ai_learning_source_type', cols: ['sourceType'] },
      { table: 'ai_learning_items', name: 'IDX_ai_learning_product', cols: ['productId'] },
      { table: 'ai_learning_items', name: 'IDX_ai_learning_message', cols: ['messageId'] },
    ];
    for (const idx of extraIndexes) {
      try {
        await queryRunner.createIndex(
          idx.table,
          new TableIndex({ name: idx.name, columnNames: idx.cols }),
        );
      } catch {
        // index may already exist
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of ['ai_training_audit_logs', 'ai_training_approvals', 'ai_training_suggestions']) {
      if (await queryRunner.hasTable(t)) await queryRunner.dropTable(t);
    }
    const itemDrop = [
      'issueType', 'sourceType', 'sourceId', 'messageId', 'productId',
      'relatedEntityType', 'relatedEntityId', 'title', 'conversationExcerpt',
      'suggestedMemoryType', 'suggestedRuleCategory', 'suggestedQuestionType',
      'createdByAi', 'reviewedAt', 'appliedAt', 'metadata',
    ];
    for (const c of itemDrop) {
      if (await queryRunner.hasColumn('ai_learning_items', c)) {
        await queryRunner.dropColumn('ai_learning_items', c);
      }
    }
    const settingsDrop = [
      'trainingCenterEnabled', 'autoCreateFromLowConfidence', 'autoCreateFromHumanReplies',
      'dailyInboxScan', 'scanLastDays', 'autoClusterRepeated', 'autoReindexAfterApproval',
      'allowMarkdownWrites', 'allowMemoryWrites', 'allowDbTrainingRules',
      'maskPrivateDataInExports', 'autoReindexSmallUpdatesOnly', 'knowledgeIndexStale',
    ];
    for (const c of settingsDrop) {
      if (await queryRunner.hasColumn('ai_learning_settings', c)) {
        await queryRunner.dropColumn('ai_learning_settings', c);
      }
    }
  }
}
