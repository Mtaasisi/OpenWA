import { jsonPathIsNotNull, uuidVarcharJoin } from './sql-dialect.util';

describe('sql-dialect.util', () => {
  const originalDbType = process.env.DATABASE_TYPE;

  afterEach(() => {
    if (originalDbType === undefined) {
      delete process.env.DATABASE_TYPE;
    } else {
      process.env.DATABASE_TYPE = originalDbType;
    }
  });

  it('uses text cast for postgres uuid joins', () => {
    process.env.DATABASE_TYPE = 'postgres';
    expect(uuidVarcharJoin('c.id', 'q.conversationId')).toBe('c.id::text = q.conversationId');
  });

  it('uses plain equality for sqlite uuid joins', () => {
    process.env.DATABASE_TYPE = 'sqlite';
    expect(uuidVarcharJoin('c.id', 'q.conversationId')).toBe('c.id = q.conversationId');
  });

  it('uses jsonb path for postgres metadata checks', () => {
    process.env.DATABASE_TYPE = 'postgres';
    expect(jsonPathIsNotNull('m.metadata', '$.media.storagePath')).toBe(
      "(m.metadata::jsonb)->'media'->>'storagePath' IS NOT NULL",
    );
  });

  it('uses json_extract for sqlite metadata checks', () => {
    process.env.DATABASE_TYPE = 'sqlite';
    expect(jsonPathIsNotNull('m.metadata', '$.media.storagePath')).toBe(
      "json_extract(m.metadata, '$.media.storagePath') IS NOT NULL",
    );
  });
});
