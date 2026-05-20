import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageWaIdUniqueIndex1779400000000 implements MigrationInterface {
  name = 'AddMessageWaIdUniqueIndex1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_messages_session_wa_msg" ON "messages" ("sessionId", "waMessageId") WHERE "waMessageId" IS NOT NULL`,
      );
    } else {
      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_messages_session_wa_msg" ON "messages" ("sessionId", "waMessageId") WHERE "waMessageId" IS NOT NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_session_wa_msg"`);
  }
}
