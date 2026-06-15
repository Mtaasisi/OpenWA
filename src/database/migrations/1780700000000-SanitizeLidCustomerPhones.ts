import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clear customerPhone values that store WhatsApp @lid internal user ids instead of real phones.
 */
export class SanitizeLidCustomerPhones1780700000000 implements MigrationInterface {
  name = 'SanitizeLidCustomerPhones1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const tables = ['inbox_thread_crm', 'followup_conversations', 'crm_quotes'];
    for (const table of tables) {
      const t = isPostgres ? `"${table}"` : table;
      const chatCol = isPostgres ? '"chatId"' : 'chatId';
      const phoneCol = isPostgres ? '"customerPhone"' : 'customerPhone';
      await queryRunner.query(
        `UPDATE ${t}
         SET ${phoneCol} = NULL
         WHERE ${chatCol} LIKE '%@lid'
           AND ${phoneCol} IS NOT NULL
           AND REPLACE(REPLACE(${phoneCol}, ' ', ''), '+', '') = REPLACE(${chatCol}, '@lid', '')`,
      );
    }
  }

  public async down(): Promise<void> {
    // Data cleanup is not reversible.
  }
}
