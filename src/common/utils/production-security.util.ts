export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isSwaggerEnabled(): boolean {
  if (!isProductionEnv()) return true;
  return process.env.ENABLE_SWAGGER === 'true';
}

export function isOpenCorsAllowed(): boolean {
  return process.env.ALLOW_OPEN_CORS === 'true';
}

function localhostMirrorOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
      return url.origin;
    }
    if (url.hostname === '127.0.0.1') {
      url.hostname = 'localhost';
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

/** When localhost is allowed, also allow 127.0.0.1 (and vice versa) for local dev. */
export function expandLocalhostCorsOrigins(origins: string[]): string[] {
  const expanded = new Set(origins);
  for (const origin of origins) {
    const mirror = localhostMirrorOrigin(origin);
    if (mirror) expanded.add(mirror);
  }
  return [...expanded];
}

export function isDesktopMode(): boolean {
  return process.env.APP_DESKTOP_MODE === 'true';
}

export function resolveCorsOrigins(): string[] {
  if (isDesktopMode()) {
    const port = process.env.PORT || '2886';
    const host = process.env.APP_HOST || '127.0.0.1';
    return expandLocalhostCorsOrigins([
      `http://${host}:${port}`,
      `http://localhost:${port}`,
    ]);
  }
  const raw = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
  if (!raw || raw.length === 0) {
    return isProductionEnv() ? [] : ['*'];
  }
  if (raw.includes('*') && isProductionEnv() && !isOpenCorsAllowed()) {
    throw new Error(
      'CORS_ORIGINS=* is not allowed in production. Set explicit origins or ALLOW_OPEN_CORS=true.',
    );
  }
  return expandLocalhostCorsOrigins(raw);
}

export function maskApiKeyForLogs(rawKey: string): string {
  if (!rawKey || rawKey.length < 12) return '(redacted)';
  return `${rawKey.slice(0, 12)}…`;
}

export const DEV_ADMIN_KEY = 'dev-admin-key';

export function assertNotDevAdminKeyInProduction(rawKey: string): void {
  if (isProductionEnv() && rawKey === DEV_ADMIN_KEY) {
    throw new Error('dev-admin-key is not permitted in production');
  }
}
