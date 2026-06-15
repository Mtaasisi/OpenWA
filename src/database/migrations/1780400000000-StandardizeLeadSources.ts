import { migPrimaryUuidColumn, migDateTime, migNowDefault } from '../migration-utils';
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { LEAD_SOURCE_VALUES } from '../../modules/followup/utils/lead-source.util';

export class StandardizeLeadSources1780400000000 implements MigrationInterface {
  name = 'StandardizeLeadSources1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const validSources = LEAD_SOURCE_VALUES.map((s) => `'${s}'`).join(', ');

    // Normalize unknown source values on conversations
    await queryRunner.query(`
      UPDATE followup_conversations
      SET source = 'other'
      WHERE source IS NULL OR TRIM(source) = ''
         OR LOWER(source) NOT IN (${validSources}, 'wa', 'fb', 'ig', 'web', 'phone', 'walkin', 'repeat', 'gmb')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'whatsapp' WHERE LOWER(source) IN ('wa', 'whatsapp_business')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'facebook' WHERE LOWER(source) IN ('fb', 'meta')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'instagram' WHERE LOWER(source) = 'ig'
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'website' WHERE LOWER(source) IN ('web', 'online')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'phone_call' WHERE LOWER(source) IN ('phone', 'call')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'walk_in' WHERE LOWER(source) IN ('walkin', 'walk-in')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'repeat_customer' WHERE LOWER(source) IN ('repeat', 'returning')
    `);
    await queryRunner.query(`
      UPDATE followup_conversations SET source = 'google' WHERE LOWER(source) IN ('gmb', 'google_maps', 'google_ads')
    `);

    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const quotesHasLeadSource = await queryRunner.hasColumn('crm_quotes', 'leadSource');
    if (!quotesHasLeadSource) {
      await queryRunner.query(
        isPostgres
          ? `ALTER TABLE crm_quotes ADD COLUMN "leadSource" varchar NULL`
          : `ALTER TABLE crm_quotes ADD COLUMN leadSource varchar NULL`,
      );
    }

    // Backfill quote leadSource from linked conversation
    if (isPostgres) {
      await queryRunner.query(`
        UPDATE crm_quotes
        SET "leadSource" = (
          SELECT fc.source FROM followup_conversations fc WHERE fc.id::text = crm_quotes."conversationId"
        )
        WHERE "conversationId" IS NOT NULL AND ("leadSource" IS NULL OR TRIM("leadSource") = '')
      `);
      await queryRunner.query(`
        UPDATE crm_quotes SET "leadSource" = 'whatsapp'
        WHERE ("leadSource" IS NULL OR TRIM("leadSource") = '') AND "sessionId" IS NOT NULL
      `);
    } else {
      await queryRunner.query(`
        UPDATE crm_quotes
        SET leadSource = (
          SELECT fc.source FROM followup_conversations fc WHERE fc.id = crm_quotes.conversationId
        )
        WHERE conversationId IS NOT NULL AND (leadSource IS NULL OR TRIM(leadSource) = '')
      `);
      await queryRunner.query(`
        UPDATE crm_quotes SET leadSource = 'whatsapp'
        WHERE (leadSource IS NULL OR TRIM(leadSource) = '') AND sessionId IS NOT NULL
      `);
    }

    const hasTable = await queryRunner.hasTable('crm_sale_attributions');
    if (!hasTable) {
      await queryRunner.createTable(
        new Table({
          name: 'crm_sale_attributions',
          columns: [
            migPrimaryUuidColumn(queryRunner),
            { name: 'saleId', type: 'varchar', isNullable: false },
            { name: 'leadSource', type: 'varchar', isNullable: false },
            { name: 'conversationId', type: 'varchar', isNullable: true },
            { name: 'quoteId', type: 'varchar', isNullable: true },
            { name: 'customerId', type: 'varchar', isNullable: true },
            { name: 'assignedStaffId', type: 'varchar', isNullable: true },
            { name: 'branchId', type: 'varchar', isNullable: true },
            { name: 'amount', type: 'real', isNullable: true },
            { name: 'grossProfit', type: 'real', isNullable: true },
            { name: 'createdAt', type: migDateTime(queryRunner), default: migNowDefault(queryRunner), isNullable: false },
          ],
        }),
        true,
      );
      await queryRunner.createIndex(
        'crm_sale_attributions',
        new TableIndex({ name: 'IDX_sale_attr_sale', columnNames: ['saleId'] }),
      );
      await queryRunner.createIndex(
        'crm_sale_attributions',
        new TableIndex({ name: 'IDX_sale_attr_source_branch', columnNames: ['leadSource', 'branchId'] }),
      );
    }

    // Existing linkedSaleId rows: npm run backfill:sale-attributions
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('crm_sale_attributions')) {
      await queryRunner.dropTable('crm_sale_attributions');
    }
    if (await queryRunner.hasColumn('crm_quotes', 'leadSource')) {
      await queryRunner.dropColumn('crm_quotes', 'leadSource');
    }
  }
}
