import { ConfigManager } from './config-manager';
import { BackendManager } from './backend-manager';

export interface EmbeddedDatabaseReadyResult {
  ok: boolean;
  message: string;
}

export async function ensureEmbeddedDatabaseReady(
  configManager: ConfigManager,
  backendManager: BackendManager,
  timeoutMs = 90000,
): Promise<EmbeddedDatabaseReadyResult> {
  const config = configManager.getConfig();
  if (config.databaseMode === 'external' && !config.databaseUrl?.trim()) {
    return { ok: false, message: 'External database URL is not configured' };
  }

  if (config.lastSuccessfulDbConnectionAt) {
    const healthy = await backendManager.isDesktopApiHealthy();
    if (healthy) {
      return { ok: true, message: 'Local database ready' };
    }
  }

  configManager.writeAppEnv();

  try {
    await backendManager.ensureDesktopBackend();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(
        `http://127.0.0.1:${config.appPort}/api/health/desktop`,
        {
          headers: { 'X-Desktop-Setup-Token': config.setupToken },
          signal: AbortSignal.timeout(3000),
        },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          database?: { connected?: boolean };
        };
        if (data.database?.connected === true) {
          configManager.saveConfig({
            lastSuccessfulDbConnectionAt: new Date().toISOString(),
          });
          return { ok: true, message: 'Local database ready' };
        }
      }
    } catch {
      // retry until timeout
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return {
    ok: false,
    message: `Local database did not become ready on port ${config.appPort}. Open Logs from the tray menu.`,
  };
}
