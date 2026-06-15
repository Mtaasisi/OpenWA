import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageSessionChatIndex1780870000000 implements MigrationInterface {
  name = 'AddMessageSessionChatIndex1780870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_messages_session_chat_created" ON "messages" ("sessionId", "chatId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_session_chat_created"`);
  }
}
