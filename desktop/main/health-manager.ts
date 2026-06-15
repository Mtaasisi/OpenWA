import { ConfigManager } from './config-manager';
import { BackendManager } from './backend-manager';

export interface DesktopHealthSnapshot {
  serverStatus: string;
  databaseConnected: boolean;
  whatsappConnected: number;
  whatsappSessionCount: number;
  safetyGuardEnabled: boolean;
  raw?: Record<string, unknown>;
}

export class HealthManager {
  constructor(
    private readonly configManager: ConfigManager,
    private readonly backendManager: BackendManager,
  ) {}

  async checkHealth(): Promise<DesktopHealthSnapshot> {
    const config = this.configManager.getConfig();
    const serverStatus = this.backendManager.getBackendStatus();
    const fallback: DesktopHealthSnapshot = {
      serverStatus,
      databaseConnected: false,
      whatsappConnected: 0,
      whatsappSessionCount: 0,
      safetyGuardEnabled: true,
    };

    if (serverStatus !== 'running') return fallback;

    try {
      const res = await fetch(`http://127.0.0.1:${config.appPort}/api/health/desktop`, {
        headers: {
          'X-Desktop-Setup-Token': config.setupToken,
        },
      });
      if (!res.ok) return fallback;
      const data = (await res.json()) as Record<string, unknown>;
      const db = data.database as { connected?: boolean } | undefined;
      const wa = data.whatsapp as { connectedCount?: number; sessionCount?: number } | undefined;
      return {
        serverStatus: 'running',
        databaseConnected: db?.connected === true,
        whatsappConnected: wa?.connectedCount ?? 0,
        whatsappSessionCount: wa?.sessionCount ?? 0,
        safetyGuardEnabled: data.safetyGuardEnabled !== false,
        raw: data,
      };
    } catch {
      return fallback;
    }
  }
}
