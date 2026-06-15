import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy group-lead escalations stored detail as "Group lead: {message}" with reason "other".
 * Normalize to reason group_lead and plain message text for staff context / reporting.
 */
export class NormalizeGroupLeadEscalations1781000000000 implements MigrationInterface {
  name = 'NormalizeGroupLeadEscalations1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    const table = isPostgres ? '"ai_escalations"' : 'ai_escalations';
    const detailCol = isPostgres ? '"detail"' : 'detail';
    const reasonCol = isPostgres ? '"reason"' : 'reason';
    const stripDetail = isPostgres
      ? `TRIM(SUBSTRING(${detailCol} FROM 12))`
      : `TRIM(SUBSTR(${detailCol}, 12))`;

    await queryRunner.query(
      `UPDATE ${table}
       SET ${reasonCol} = 'group_lead',
           ${detailCol} = ${stripDetail}
       WHERE ${detailCol} IS NOT NULL
         AND LOWER(${detailCol}) LIKE 'group lead:%'`,
    );
  }

  public async down(): Promise<void> {
    // Data normalization is not safely reversible.
  }
}
