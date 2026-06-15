import { app, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { NotificationManager } from './notification-manager';

export type UpdateCheckResult = {
  status: 'dev' | 'disabled' | 'checking' | 'available' | 'none' | 'error';
  message: string;
  version?: string;
};

/**
 * Opt-in auto-update via GitHub Releases (electron-builder publish config)
 * or a custom feed URL in UPDATE_SERVER_URL.
 */
export class AutoUpdateManager {
  private initialized = false;
  private checking = false;

  constructor(private readonly notificationManager?: NotificationManager) {}

  init(): void {
    if (this.initialized || !app.isPackaged) return;

    const customFeed = process.env.UPDATE_SERVER_URL?.trim();
    if (customFeed) {
      autoUpdater.setFeedURL({ provider: 'generic', url: customFeed });
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('error', (err) => {
      console.error('[auto-update]', err.message);
    });

    autoUpdater.on('update-downloaded', (info) => {
      const version = info.version;
      const inBackground = this.notificationManager?.isAppInBackground() ?? false;

      if (inBackground) {
        this.notificationManager?.showSystem({
          title: 'Update ready',
          body: `Inauzwa CRM ${version} is ready. Click to restart and install.`,
          tag: `update:${version}`,
          deepLink: '/settings/desktop-app',
        });
      }

      if (!inBackground) {
        void dialog
          .showMessageBox({
            type: 'info',
            title: 'Update ready',
            message: `Inauzwa CRM ${version} has been downloaded.`,
            detail: 'Restart the app to install the update.',
            buttons: ['Restart now', 'Later'],
            defaultId: 0,
          })
          .then(({ response }) => {
            if (response === 0) {
              autoUpdater.quitAndInstall();
            }
          });
      }
    });

    this.initialized = true;
  }

  getVersionLabel(): string {
    return app.getVersion();
  }

  async checkForUpdates(manual = false): Promise<UpdateCheckResult> {
    if (!app.isPackaged) {
      return { status: 'dev', message: 'Updates are disabled in development builds.' };
    }

    const updatePage = process.env.UPDATE_SERVER_URL?.trim();
    if (updatePage && (updatePage.endsWith('/') || updatePage.includes('github.com'))) {
      if (manual) {
        await shell.openExternal(updatePage);
      }
      return {
        status: 'disabled',
        message: manual ? 'Opened update page in your browser.' : 'Check updates from the release page.',
      };
    }

    if (this.checking) {
      return { status: 'checking', message: 'Already checking for updates…' };
    }

    this.init();
    this.checking = true;

    try {
      const result = await autoUpdater.checkForUpdates();
      this.checking = false;

      if (!result?.updateInfo) {
        return { status: 'none', message: 'You are on the latest version.' };
      }

      const remoteVersion = result.updateInfo.version;
      const current = app.getVersion();
      if (remoteVersion === current) {
        return { status: 'none', message: 'You are on the latest version.' };
      }

      if (manual) {
        const { response } = await dialog.showMessageBox({
          type: 'info',
          title: 'Update available',
          message: `Version ${remoteVersion} is available (you have ${current}).`,
          detail: 'Download now? The app will prompt you to restart when ready.',
          buttons: ['Download', 'Cancel'],
          defaultId: 0,
        });
        if (response === 0) {
          await autoUpdater.downloadUpdate();
          return {
            status: 'available',
            message: 'Downloading update…',
            version: remoteVersion,
          };
        }
        return {
          status: 'available',
          message: `Update ${remoteVersion} is available.`,
          version: remoteVersion,
        };
      }

      await autoUpdater.downloadUpdate();
      return {
        status: 'available',
        message: `Update ${remoteVersion} is downloading.`,
        version: remoteVersion,
      };
    } catch (err) {
      this.checking = false;
      const message = err instanceof Error ? err.message : 'Update check failed';
      if (manual) {
        return { status: 'error', message };
      }
      return { status: 'error', message };
    }
  }
}
