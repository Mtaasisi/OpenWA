import type { BackendManager } from './backend-manager';
import type { HealthManager } from './health-manager';
import type { NotificationManager } from './notification-manager';

type HealthSnapshot = {
  serverStatus: string;
  databaseConnected: boolean;
  whatsappConnected: number;
};

const POLL_MS = 45_000;

export class HealthNotificationWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private last: HealthSnapshot | null = null;

  constructor(
    private readonly healthManager: HealthManager,
    private readonly backendManager: BackendManager,
    private readonly notificationManager: NotificationManager,
  ) {}

  start(): void {
    if (this.timer) return;
    void this.tick();
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    const health = await this.healthManager.checkHealth();
    const snapshot: HealthSnapshot = {
      serverStatus: health.serverStatus,
      databaseConnected: health.databaseConnected,
      whatsappConnected: health.whatsappConnected,
    };

    const prev = this.last;
    this.last = snapshot;
    if (!prev) return;

    if (prev.serverStatus === 'running' && snapshot.serverStatus !== 'running') {
      this.notificationManager.showForKind('system.serverDown', {
        title: 'Local server stopped',
        body: `The Inauzwa CRM server is ${snapshot.serverStatus}. Open desktop settings to restart.`,
        tag: 'system:server-down',
        deepLink: '/settings/desktop-app',
      });
    }

    if (prev.databaseConnected && !snapshot.databaseConnected && snapshot.serverStatus === 'running') {
      this.notificationManager.showForKind('system.databaseOffline', {
        title: 'Database offline',
        body: 'Could not reach the local database. Check desktop app settings.',
        tag: 'system:db-offline',
        deepLink: '/settings/desktop-app',
      });
    }

    if (prev.whatsappConnected > 0 && snapshot.whatsappConnected === 0 && snapshot.serverStatus === 'running') {
      this.notificationManager.showForKind('system.whatsappDisconnected', {
        title: 'WhatsApp disconnected',
        body: 'No WhatsApp sessions are connected. Scan QR or reconnect in Sessions.',
        tag: 'system:wa-disconnected',
        deepLink: '/sessions',
      });
    }
  }

  onBackendStatusChange(prev: string, next: string): void {
    if (prev === next) return;
    if (next === 'crashed' || next === 'stopped') {
      this.notificationManager.showForKind('system.serverDown', {
        title: 'Local server issue',
        body: `Server status changed to ${next}.`,
        tag: `system:backend:${next}`,
        deepLink: '/settings/desktop-app',
      });
    }
  }
}
