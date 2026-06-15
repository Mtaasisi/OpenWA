import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddQuickReplyTemplates1780200000000 implements MigrationInterface {
  name = 'AddQuickReplyTemplates1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const uuidCol = () => migPrimaryUuidColumn(queryRunner);
    const tsCols = [
      { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
      { name: 'updatedAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
    ];

    await queryRunner.createTable(
      new Table({
        name: 'quick_reply_templates',
        columns: [
          uuidCol(),
          { name: 'branchId', type: 'varchar', isNullable: true },
          { name: 'name', type: 'varchar', length: '200', isNullable: false },
          { name: 'category', type: 'varchar', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          { name: 'language', type: 'varchar', default: "'en'", isNullable: false },
          { name: 'isActive', type: 'boolean', default: true, isNullable: false },
          { name: 'createdBy', type: 'varchar', isNullable: true },
          { name: 'updatedBy', type: 'varchar', isNullable: true },
          ...tsCols,
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'quick_reply_templates',
      new TableIndex({ name: 'IDX_quick_reply_branch', columnNames: ['branchId'] }),
    );
    await queryRunner.createIndex(
      'quick_reply_templates',
      new TableIndex({ name: 'IDX_quick_reply_category', columnNames: ['category'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('quick_reply_templates');
  }
}
