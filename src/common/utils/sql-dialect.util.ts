/**
 * Raw SQL fragments that differ between SQLite (dev) and PostgreSQL (production).
 */

const isPostgres = (): boolean => process.env.DATABASE_TYPE === 'postgres';

/** TypeORM column type for nullable timestamps on the pluggable data database. */
export function dataDateTimeColumn(): 'datetime' | 'timestamp' {
  return isPostgres() ? 'timestamp' : 'datetime';
}

/**
 * Join a UUID primary-key column to a varchar FK that stores the same id.
 * PostgreSQL rejects `uuid = varchar` without an explicit cast.
 */
export function uuidVarcharJoin(uuidColumn: string, varcharColumn: string): string {
  return isPostgres() ? `${uuidColumn}::text = ${varcharColumn}` : `${uuidColumn} = ${varcharColumn}`;
}

/**
 * Check that a nested JSON path is present (non-null).
 * SQLite uses json_extract; PostgreSQL uses jsonb operators.
 */
export function jsonPathIsNotNull(columnRef: string, jsonPath: string): string {
  if (isPostgres()) {
    const segments = jsonPath.replace(/^\$\./, '').split('.');
    // messages.metadata is stored as text in Postgres migrations — cast before jsonb ops.
    let expr = `(${columnRef}::jsonb)`;
    for (let i = 0; i < segments.length - 1; i++) {
      expr += `->'${segments[i]}'`;
    }
    return `${expr}->>'${segments[segments.length - 1]}' IS NOT NULL`;
  }
  return `json_extract(${columnRef}, '${jsonPath}') IS NOT NULL`;
}
