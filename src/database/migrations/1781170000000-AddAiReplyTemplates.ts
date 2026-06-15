import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import {
  migDateTime,
  migNowDefault,
  migPrimaryUuidColumn,
} from '../migration-utils';

export class AddAiReplyTemplates1781170000000 implements MigrationInterface {
  name = 'AddAiReplyTemplates1781170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);
    const isPg = queryRunner.connection.options.type === 'postgres';
    const boolDef = (v: boolean) => (isPg ? v : v ? 1 : 0);

    if (await queryRunner.hasTable('ai_reply_templates')) return;

    await queryRunner.createTable(
      new Table({
        name: 'ai_reply_templates',
        columns: [
          migPrimaryUuidColumn(queryRunner),
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'category', type: 'varchar', length: '64' },
          { name: 'message', type: 'text' },
          { name: 'language', type: 'varchar', default: "'mixed'" },
          { name: 'active', type: 'boolean', default: boolDef(true) },
          { name: 'isFavorite', type: 'boolean', default: boolDef(false) },
          { name: 'usageCount', type: 'int', default: 0 },
          { name: 'ratingPercent', type: 'int', default: 0 },
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'updatedBy', type: 'varchar', isNullable: true },
          { name: 'createdAt', type: dt, default: now },
          { name: 'updatedAt', type: dt, default: now },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'ai_reply_templates',
      new TableIndex({ name: 'IDX_ai_reply_tpl_category', columnNames: ['category'] }),
    );
    await queryRunner.createIndex(
      'ai_reply_templates',
      new TableIndex({ name: 'IDX_ai_reply_tpl_active', columnNames: ['active'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ai_reply_templates')) {
      await queryRunner.dropTable('ai_reply_templates');
    }
  }
}
