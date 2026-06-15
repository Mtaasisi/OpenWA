import {
  assertNotDevAdminKeyInProduction,
  DEV_ADMIN_KEY,
  expandLocalhostCorsOrigins,
  isSwaggerEnabled,
  maskApiKeyForLogs,
  resolveCorsOrigins,
} from './production-security.util';

describe('production-security.util', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterAll(() => {
    process.env = env;
  });

  it('masks api keys for logs', () => {
    expect(maskApiKeyForLogs('owa_k1_abcdef123456')).toBe('owa_k1_abcde…');
  });

  it('disables swagger in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_SWAGGER;
    expect(isSwaggerEnabled()).toBe(false);
    process.env.ENABLE_SWAGGER = 'true';
    expect(isSwaggerEnabled()).toBe(true);
  });

  it('rejects open cors in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = '*';
    delete process.env.ALLOW_OPEN_CORS;
    expect(() => resolveCorsOrigins()).toThrow(/CORS_ORIGINS=\*/);
  });

  it('mirrors localhost and 127.0.0.1 cors origins', () => {
    expect(expandLocalhostCorsOrigins(['http://localhost:2886'])).toEqual([
      'http://localhost:2886',
      'http://127.0.0.1:2886',
    ]);
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGINS = 'http://localhost:2886';
    expect(resolveCorsOrigins()).toContain('http://127.0.0.1:2886');
  });

  it('blocks dev-admin-key in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertNotDevAdminKeyInProduction(DEV_ADMIN_KEY)).toThrow(/not permitted/);
  });
});
