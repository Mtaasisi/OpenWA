import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddWhatsAppSendAuditBodyHash1780950000000 implements MigrationInterface {
  name = 'AddWhatsAppSendAuditBodyHash1780950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('whatsapp_send_audit');
    if (!table) return;

    if (!table.findColumnByName('bodyHash')) {
      await queryRunner.addColumn(
        'whatsapp_send_audit',
        new TableColumn({
          name: 'bodyHash',
          type: 'varchar',
          length: '16',
          isNullable: true,
        }),
      );
    }

    const refreshed = await queryRunner.getTable('whatsapp_send_audit');
    const hasIndex = refreshed?.indices.some(i => i.name === 'IDX_whatsapp_send_audit_session_body_hash');
    if (!hasIndex) {
      await queryRunner.createIndex(
        'whatsapp_send_audit',
        new TableIndex({
          name: 'IDX_whatsapp_send_audit_session_body_hash',
          columnNames: ['sessionId', 'bodyHash', 'createdAt'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('whatsapp_send_audit');
    if (!table) return;

    const index = table.indices.find(i => i.name === 'IDX_whatsapp_send_audit_session_body_hash');
    if (index) {
      await queryRunner.dropIndex('whatsapp_send_audit', index);
    }

    if (table.findColumnByName('bodyHash')) {
      await queryRunner.dropColumn('whatsapp_send_audit', 'bodyHash');
    }
  }
}
