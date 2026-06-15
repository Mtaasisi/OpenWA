import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { migDateTime, migNowDefault, migPrimaryUuidColumn } from '../migration-utils';

export class AddAgentActionSystem1781040000000 implements MigrationInterface {
  name = 'AddAgentActionSystem1781040000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dt = migDateTime(queryRunner);
    const now = migNowDefault(queryRunner);
    const isPg = queryRunner.connection.options.type === 'postgres';
    const boolDef = (v: boolean) => (isPg ? v : v ? 1 : 0);

    if (!(await queryRunner.hasTable('agent_action_settings'))) {
      await queryRunner.createTable(
        new Table({
          name: 'agent_action_settings',
          columns: [
            { name: 'id', type: 'varchar', length: '36', isPrimary: true },
            { name: 'agentActionsEnabled', type: 'boolean', default: boolDef(true) },
            { name: 'allowSafeDirectExecution', type: 'boolean', default: boolDef(true) },
            { name: 'requireConfirmationForMediumRisk', type: 'boolean', default: boolDef(true) },
            { name: 'requireConfirmationForHighRisk', type: 'boolean', default: boolDef(true) },
            { name: 'adminOnlyHighRisk', type: 'boolean', default: boolDef(true) },
            { name: 'actionConfirmExpiryMinutes', type: 'int', default: 5 },
            { name: 'actionAuditEnabled', type: 'boolean', default: boolDef(true) },
            { name: 'showActionCardsInAiAssistant', type: 'boolean', default: boolDef(true) },
            { name: 'allowQuickLinks', type: 'boolean', default: boolDef(true) },
            { name: 'updatedAt', type: dt, default: now },
          ],
        }),
      );
      await queryRunner.query(`INSERT INTO agent_action_settings (id) VALUES ('default')`);
    }

    if (!(await queryRunner.hasTable('agent_action_confirmations'))) {
      await queryRunner.createTable(
        new Table({
          name: 'agent_action_confirmations',
          columns: [
            migPrimaryUuidColumn(queryRunner),
            { name: 'actionId', type: 'varchar', length: '80' },
            { name: 'requestedByUserId', type: 'varchar', length: '36' },
            { name: 'paramsJson', type: 'text', isNullable: true },
            { name: 'risk', type: 'varchar', length: '16' },
            { name: 'warningMessage', type: 'text', isNullable: true },
            { name: 'expiresAt', type: dt },
            { name: 'status', type: 'varchar', length: '16', default: "'pending'" },
            { name: 'createdAt', type: dt, default: now },
          ],
        }),
      );
      await queryRunner.createIndex(
        'agent_action_confirmations',
        new TableIndex({ name: 'IDX_agent_confirm_user', columnNames: ['requestedByUserId'] }),
      );
      await queryRunner.createIndex(
        'agent_action_confirmations',
        new TableIndex({ name: 'IDX_agent_confirm_status', columnNames: ['status'] }),
      );
    }

    if (!(await queryRunner.hasTable('agent_action_audit_logs'))) {
      await queryRunner.createTable(
        new Table({
          name: 'agent_action_audit_logs',
          columns: [
            migPrimaryUuidColumn(queryRunner),
            { name: 'actionId', type: 'varchar', length: '80' },
            { name: 'actionTitle', type: 'varchar', length: '200' },
            { name: 'category', type: 'varchar', length: '32' },
            { name: 'requestedByUserId', type: 'varchar', length: '36' },
            { name: 'requestedByRole', type: 'varchar', length: '32' },
            { name: 'businessId', type: 'varchar', length: '36', isNullable: true },
            { name: 'branchId', type: 'varchar', length: '36', isNullable: true },
            { name: 'currentPage', type: 'varchar', length: '500', isNullable: true },
            { name: 'targetEntityType', type: 'varchar', length: '64', isNullable: true },
            { name: 'targetEntityId', type: 'varchar', length: '64', isNullable: true },
            { name: 'oldValue', type: 'text', isNullable: true },
            { name: 'newValue', type: 'text', isNullable: true },
            { name: 'paramsSummary', type: 'text', isNullable: true },
            { name: 'risk', type: 'varchar', length: '16' },
            { name: 'requiredConfirmation', type: 'boolean', default: boolDef(false) },
            { name: 'confirmationId', type: 'varchar', length: '36', isNullable: true },
            { name: 'status', type: 'varchar', length: '32' },
            { name: 'errorMessage', type: 'text', isNullable: true },
            { name: 'source', type: 'varchar', length: '32', default: "'ai_assistant_agent'" },
            { name: 'createdAt', type: dt, default: now },
            { name: 'executedAt', type: dt, isNullable: true },
          ],
        }),
      );
      await queryRunner.createIndex(
        'agent_action_audit_logs',
        new TableIndex({ name: 'IDX_agent_audit_created', columnNames: ['createdAt'] }),
      );
      await queryRunner.createIndex(
        'agent_action_audit_logs',
        new TableIndex({ name: 'IDX_agent_audit_user', columnNames: ['requestedByUserId'] }),
      );
      await queryRunner.createIndex(
        'agent_action_audit_logs',
        new TableIndex({ name: 'IDX_agent_audit_action', columnNames: ['actionId'] }),
      );
    }

    if (!(await queryRunner.hasColumn('ai_chat_messages', 'agentActionJson'))) {
      await queryRunner.query(`ALTER TABLE ai_chat_messages ADD COLUMN agentActionJson text`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('ai_chat_messages', 'agentActionJson')) {
      await queryRunner.dropColumn('ai_chat_messages', 'agentActionJson');
    }
    await queryRunner.dropTable('agent_action_audit_logs', true);
    await queryRunner.dropTable('agent_action_confirmations', true);
    await queryRunner.dropTable('agent_action_settings', true);
  }
}
