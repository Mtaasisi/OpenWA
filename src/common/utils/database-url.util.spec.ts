import { maskDatabaseUrl, parseDatabaseUrl, isNeonPoolerDatabaseUrl } from './database-url.util';

describe('database-url.util', () => {
  it('parses a Neon-style postgresql URL', () => {
    const parsed = parseDatabaseUrl(
      'postgresql://user:secret@ep-test.us-east-1.aws.neon.tech/neondb?sslmode=require',
    );
    expect(parsed.host).toBe('ep-test.us-east-1.aws.neon.tech');
    expect(parsed.port).toBe(5432);
    expect(parsed.username).toBe('user');
    expect(parsed.password).toBe('secret');
    expect(parsed.database).toBe('neondb');
    expect(parsed.ssl).toBe(true);
  });

  it('masks password in database URL', () => {
    const masked = maskDatabaseUrl(
      'postgresql://user:secret@ep-test.us-east-1.aws.neon.tech/neondb?sslmode=require',
    );
    expect(masked).toContain('****');
    expect(masked).not.toContain('secret');
  });

  it('rejects invalid URLs', () => {
    expect(() => parseDatabaseUrl('')).toThrow('Database URL is required');
    expect(() => parseDatabaseUrl('mysql://localhost/db')).toThrow('Only PostgreSQL');
  });

  it('detects Neon pooler hostnames', () => {
    expect(
      isNeonPoolerDatabaseUrl(
        'postgresql://user:pass@ep-icy-mouse-adshjg5n-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe(true);
    expect(
      isNeonPoolerDatabaseUrl(
        'postgresql://user:pass@ep-test.us-east-1.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe(false);
  });
});
