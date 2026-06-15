import { app, ipcMain, shell, dialog, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager } from './config-manager';
import { BackendManager } from './backend-manager';
import { HealthManager } from './health-manager';
import { WindowManager } from './window-manager';
import { TrayManager } from './tray-manager';
import { AutoLaunchManager } from './auto-launch-manager';
import { AutoUpdateManager } from './auto-update-manager';
import { NotificationManager } from './notification-manager';
import { HealthNotificationWatcher } from './health-notification-watcher';
import { testPostgresDatabaseUrl } from './db-test';
import { ensureEmbeddedDatabaseReady } from './database-bootstrap';

app.setName('Inauzwa CRM');

let configManager: ConfigManager;
let backendManager: BackendManager;
let healthManager: HealthManager;
let windowManager: WindowManager;
let trayManager: TrayManager;
let autoLaunchManager: AutoLaunchManager;
let autoUpdateManager: AutoUpdateManager;
let notificationManager: NotificationManager;
let healthNotificationWatcher: HealthNotificationWatcher;
let isQuitting = false;
let quitCleanupStarted = false;

async function apiCall(
  config: ReturnType<ConfigManager['getConfig']>,
  endpoint: string,
  method = 'GET',
  body?: unknown,
): Promise<unknown> {
  const url = `http://127.0.0.1:${config.appPort}/api/${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Desktop-Setup-Token': config.setupToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `API error ${res.status}`);
  }
  return res.json();
}

function registerIpc(): void {
  ipcMain.handle('desktop:getConfig', () => configManager.getConfig());
  ipcMain.handle('desktop:getMaskedConfig', () => configManager.getMaskedConfig());
  ipcMain.handle('desktop:saveConfig', (_e, updates) => configManager.saveConfig(updates));
  ipcMain.handle('desktop:resetConfig', () => configManager.resetConfig());
  ipcMain.handle('desktop:checkStorage', () => configManager.checkStorageWritable());

  ipcMain.handle('desktop:ensureDatabaseReady', () =>
    ensureEmbeddedDatabaseReady(configManager, backendManager),
  );

  ipcMain.handle('desktop:testDatabase', async (_e, databaseUrl: string) => {
    const url = databaseUrl?.trim();
    if (!url) throw new Error('Database URL is required');

    const result = await testPostgresDatabaseUrl(url);

    if (result.ok) {
      configManager.saveConfig({
        databaseMode: 'external',
        databaseUrl: url,
        lastSuccessfulDbConnectionAt: new Date().toISOString(),
      });
      try {
        await backendManager.restartBackend();
        await ensureEmbeddedDatabaseReady(configManager, backendManager);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ...result,
          message: `${result.message} (Local server: ${msg})`,
        };
      }
    }

    return result;
  });

  ipcMain.handle('desktop:runMigrations', async (_e, databaseUrl?: string) => {
    await ensureEmbeddedDatabaseReady(configManager, backendManager);
    return apiCall(configManager.getConfig(), 'desktop/db/migrate', 'POST', { databaseUrl });
  });

  ipcMain.handle('desktop:seedDefaults', async () => {
    return apiCall(configManager.getConfig(), 'desktop/setup/seed', 'POST', {});
  });

  ipcMain.handle('desktop:getAdminSetupStatus', async () => {
    return apiCall(configManager.getConfig(), 'desktop/setup/admin/status', 'GET');
  });

  ipcMain.handle('desktop:createAdmin', async (_e, payload) => {
    return apiCall(configManager.getConfig(), 'desktop/setup/admin', 'POST', payload);
  });

  ipcMain.handle('desktop:listBranches', async () => {
    return apiCall(configManager.getConfig(), 'desktop/setup/branches', 'GET');
  });

  ipcMain.handle('desktop:setupBranch', async (_e, payload) => {
    return apiCall(configManager.getConfig(), 'desktop/setup/branch', 'POST', payload);
  });

  ipcMain.handle('desktop:registerDevice', async () => {
    const c = configManager.getConfig();
    return apiCall(configManager.getConfig(), 'desktop/device/register', 'POST', {
      deviceId: c.deviceId,
      deviceName: c.deviceName,
      branchId: c.branchId,
      businessId: c.businessName,
      appVersion: app.getVersion(),
      os: `${os.platform()} ${os.release()}`,
    });
  });

  ipcMain.handle('desktop:completeSetup', async () => {
    configManager.saveConfig({ setupCompleted: true });
    configManager.writeAppEnv();

    await ensureEmbeddedDatabaseReady(configManager, backendManager);

    await apiCall(configManager.getConfig(), 'desktop/setup/seed', 'POST', {});
    await apiCall(configManager.getConfig(), 'desktop/device/register', 'POST', {
      deviceId: configManager.getConfig().deviceId,
      deviceName: configManager.getConfig().deviceName,
      branchId: configManager.getConfig().branchId,
      appVersion: app.getVersion(),
      os: `${os.platform()} ${os.release()}`,
    });

    windowManager.closeWizard();
    windowManager.openLogin();
    return { ok: true };
  });

  ipcMain.handle('desktop:getHealth', () => healthManager.checkHealth());
  ipcMain.handle('desktop:getBackendStatus', () => backendManager.getBackendStatus());
  ipcMain.handle('desktop:getBackendLogs', () => backendManager.getBackendLogs());
  ipcMain.handle('desktop:startBackend', () => backendManager.ensureDesktopBackend());
  ipcMain.handle('desktop:stopBackend', () => backendManager.stopBackend());
  ipcMain.handle('desktop:restartBackend', () => backendManager.restartBackend());

  ipcMain.handle('desktop:openFolder', (_e, name: string) => {
    const c = configManager.getConfig();
    const map: Record<string, string> = {
      logs: c.logsPath,
      sessions: c.sessionsPath,
      media: c.mediaPath,
      config: path.join(configManager.getAppDataRoot(), 'config'),
      root: configManager.getAppDataRoot(),
    };
    const folder = map[name] || configManager.getAppDataRoot();
    void shell.openPath(folder);
  });

  ipcMain.handle('desktop:openDashboard', () => {
    windowManager.openDashboard();
  });

  ipcMain.handle('desktop:getAppVersion', () => app.getVersion());
  ipcMain.handle('desktop:checkForUpdates', () => autoUpdateManager.checkForUpdates(true));

  ipcMain.handle('desktop:showNotification', (_e, payload) => {
    return notificationManager.show(payload);
  });

  ipcMain.handle('desktop:isAppInBackground', () => notificationManager.isAppInBackground());

  ipcMain.handle('desktop:getNotificationPermission', () =>
    notificationManager.getNotificationPermission(),
  );

  ipcMain.handle('desktop:requestNotificationPermission', () =>
    notificationManager.requestNotificationPermission(),
  );

  ipcMain.handle('desktop:syncNotificationPrefs', (_e, prefs) => {
    notificationManager.setPrefs(prefs ?? {});
    return notificationManager.getPrefs();
  });

  ipcMain.handle('desktop:setDockBadge', (_e, count: string) => {
    notificationManager.setDockBadge(typeof count === 'string' ? count : '');
  });

  ipcMain.handle('desktop:exportDiagnostics', async () => {
    const health = await healthManager.checkHealth();
    const diag = {
      appVersion: app.getVersion(),
      os: `${os.platform()} ${os.release()}`,
      config: configManager.getMaskedConfig(),
      backendStatus: backendManager.getBackendStatus(),
      health,
      logs: backendManager.getBackendLogs(100),
    };
    const outPath = path.join(configManager.getConfig().logsPath, `diagnostics-${Date.now()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(diag, null, 2), 'utf8');
    return outPath;
  });
}

async function startup(): Promise<void> {
  if (!app.isPackaged) {
    await session.defaultSession.clearCache();
  }

  configManager = new ConfigManager();
  backendManager = new BackendManager(configManager);
  healthManager = new HealthManager(configManager, backendManager);
  windowManager = new WindowManager(configManager, () => isQuitting);
  notificationManager = new NotificationManager(windowManager);
  healthNotificationWatcher = new HealthNotificationWatcher(
    healthManager,
    backendManager,
    notificationManager,
  );
  autoLaunchManager = new AutoLaunchManager();
  autoUpdateManager = new AutoUpdateManager(notificationManager);
  autoUpdateManager.init();
  healthNotificationWatcher.start();

  backendManager.onStatusChange((prev, next) => {
    healthNotificationWatcher.onBackendStatusChange(prev, next);
  });

  registerIpc();
  trayManager = new TrayManager(windowManager, backendManager, healthManager, autoUpdateManager, () => {
    isQuitting = true;
    app.quit();
  });
  trayManager.create();

  const config = configManager.getConfig();
  autoLaunchManager.setEnabled(config.startOnBoot);

  if (config.autoStartBackend) {
    const dbReady = await ensureEmbeddedDatabaseReady(configManager, backendManager);
    if (!dbReady.ok) {
      void dialog.showErrorBox('Inauzwa CRM', `Could not prepare local database:\n${dbReady.message}`);
    }
  }

  if (!config.setupCompleted) {
    windowManager.createWizardWindow();
  } else if (config.openDashboardOnLaunch) {
    if (config.autoStartBackend) {
      try {
        await backendManager.ensureDesktopBackend();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        void dialog.showErrorBox(
          'Inauzwa CRM',
          `Local server is not ready yet:\n${msg}\n\nUse the menu bar icon → Restart Server.`,
        );
      }
    }
    windowManager.openDashboard();
  }
}

app.whenReady().then(() => void startup());

app.on('window-all-closed', () => {
  if (isQuitting || !configManager?.getConfig().minimizeToTray) {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (quitCleanupStarted) return;
  event.preventDefault();
  isQuitting = true;
  quitCleanupStarted = true;
  void (async () => {
    trayManager?.destroy();
    await backendManager?.stopBackend();
    app.exit(0);
  })();
});

app.on('activate', () => {
  windowManager?.openDashboard();
});
