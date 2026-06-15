import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Align AI config master switch with WhatsApp safety defaults (aiAutoReplyEnabled defaults true).
 * Startup safe mode still applies on fresh QR links — master ON does not bypass safety pacing.
 */
export class AlignAutoReplyMasterDefault1781140000000 implements MigrationInterface {
  name = 'AlignAutoReplyMasterDefault1781140000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPg = queryRunner.connection.options.type === 'postgres';
    const b = (value: boolean) => (isPg ? (value ? 'TRUE' : 'FALSE') : value ? '1' : '0');

    const table = await queryRunner.getTable('ai_config');
    if (table) {
      await queryRunner.query(
        `UPDATE ai_config SET autoReplyEnabled = ${b(true)} WHERE id = 'default'`,
      );
    }
  }

  public async down(): Promise<void> {
    // Non-destructive: prior master switch state is not restored.
  }
}
