import { app, Menu, Tray, nativeImage } from 'electron';
import * as path from 'path';
import { resolveDesktopRoot } from './paths';
import { WindowManager } from './window-manager';
import { BackendManager } from './backend-manager';
import { HealthManager } from './health-manager';
import { AutoUpdateManager } from './auto-update-manager';

export class TrayManager {
  private tray: Tray | null = null;

  constructor(
    private readonly windowManager: WindowManager,
    private readonly backendManager: BackendManager,
    private readonly healthManager: HealthManager,
    private readonly autoUpdateManager: AutoUpdateManager,
    private readonly onQuit: () => void,
  ) {}

  create(): void {
    const iconPath = path.join(resolveDesktopRoot(), 'assets', 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    this.tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
    this.tray.setToolTip('Inauzwa CRM');
    this.updateMenu();
    this.tray.on('double-click', () => this.windowManager.openDashboard());
    setInterval(() => void this.refreshTooltip(), 30000);
  }

  private async refreshTooltip(): Promise<void> {
    const health = await this.healthManager.checkHealth();
    const parts = [
      `Server: ${health.serverStatus}`,
      `DB: ${health.databaseConnected ? 'connected' : 'disconnected'}`,
      `WA: ${health.whatsappConnected}/${health.whatsappSessionCount}`,
    ];
    this.tray?.setToolTip(`Inauzwa CRM\n${parts.join(' | ')}`);
  }

  updateMenu(): void {
    if (!this.tray) return;
    const status = this.backendManager.getBackendStatus();
    const menu = Menu.buildFromTemplate([
      { label: 'Open Dashboard', click: () => this.windowManager.openDashboard() },
      { type: 'separator' },
      {
        label: 'Start Server',
        enabled: status === 'stopped' || status === 'crashed',
        click: () => void this.backendManager.startBackend().then(() => this.updateMenu()),
      },
      {
        label: 'Stop Server',
        enabled: status === 'running' || status === 'starting',
        click: () => void this.backendManager.stopBackend().then(() => this.updateMenu()),
      },
      {
        label: 'Restart Server',
        click: () => void this.backendManager.restartBackend().then(() => this.updateMenu()),
      },
      { type: 'separator' },
      { label: 'WhatsApp Sessions', click: () => this.windowManager.openSessions() },
      {
        label: 'View Logs',
        click: () => this.windowManager.openSettings(),
      },
      { label: 'Settings', click: () => this.windowManager.openSettings() },
      {
        label: 'Check Health',
        click: () => void this.refreshTooltip(),
      },
      {
        label: 'Check for Updates',
        click: () => void this.autoUpdateManager.checkForUpdates(true),
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.onQuit(),
      },
    ]);
    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
