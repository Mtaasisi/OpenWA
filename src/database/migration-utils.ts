import { QueryRunner } from 'typeorm';
import type { TableColumnOptions } from 'typeorm';

/** Column type for date/time fields in migrations (Postgres vs SQLite). */
export function migDateTime(queryRunner: QueryRunner): string {
  return queryRunner.connection.options.type === 'postgres' ? 'timestamp' : 'datetime';
}

/** Default expression for created/updated timestamps in migrations. */
export function migNowDefault(queryRunner: QueryRunner): string {
  return queryRunner.connection.options.type === 'postgres' ? 'NOW()' : 'CURRENT_TIMESTAMP';
}

/** Primary key UUID column (Postgres native uuid vs SQLite generated varchar). */
export function migPrimaryUuidColumn(queryRunner: QueryRunner): TableColumnOptions {
  if (queryRunner.connection.options.type === 'postgres') {
    return {
      name: 'id',
      type: 'uuid',
      isPrimary: true,
      default: 'gen_random_uuid()',
    };
  }
  return {
    name: 'id',
    type: 'varchar',
    length: '36',
    isPrimary: true,
    isGenerated: true,
    generationStrategy: 'uuid',
  };
}

/** Foreign-key UUID column referencing migPrimaryUuidColumn tables. */
export function migUuidFkColumn(
  queryRunner: QueryRunner,
  name: string,
  nullable = false,
): TableColumnOptions {
  if (queryRunner.connection.options.type === 'postgres') {
    return { name, type: 'uuid', isNullable: nullable };
  }
  return { name, type: 'varchar', length: '36', isNullable: nullable };
}
