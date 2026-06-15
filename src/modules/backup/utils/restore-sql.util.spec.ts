import { buildRestoreInsertForDriver, getDbDriver } from './restore-sql.util';

function mockDataSource(type: string) {
  return { options: { type } } as import('typeorm').DataSource;
}

describe('restore-sql.util', () => {
  it('builds sqlite merge sql', () => {
    const sql = buildRestoreInsertForDriver(mockDataSource('sqlite'), 'messages', ['id', 'body'], 'merge');
    expect(sql).toContain('INSERT OR IGNORE INTO messages');
  });

  it('builds postgres merge sql', () => {
    const sql = buildRestoreInsertForDriver(mockDataSource('postgres'), 'messages', ['id', 'body'], 'merge');
    expect(sql).toContain('ON CONFLICT DO NOTHING');
  });

  it('builds postgres upsert sql when id is present', () => {
    const sql = buildRestoreInsertForDriver(mockDataSource('postgres'), 'messages', ['id', 'body'], 'upsert');
    expect(sql).toContain('ON CONFLICT (id) DO UPDATE SET');
    expect(sql).toContain('body = EXCLUDED.body');
  });

  it('falls back to merge when upsert has no id column', () => {
    const sql = buildRestoreInsertForDriver(mockDataSource('sqlite'), 'settings', ['key', 'value'], 'upsert');
    expect(sql).toContain('INSERT OR IGNORE');
  });

  it('reads driver type', () => {
    expect(getDbDriver(mockDataSource('postgres'))).toBe('postgres');
  });
});
