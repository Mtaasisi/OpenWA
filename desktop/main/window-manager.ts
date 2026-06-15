import { app, BrowserWindow, dialog, shell, session, screen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from './config-manager';

const MAC_FRAMELESS_OPTIONS =
  process.platform === 'darwin'
    ? {
        titleBarStyle: 'hidden' as const,
        trafficLightPosition: { x: 16, y: 18 },
        titleBarOverlay: {
          color: '#f0f2f5',
          symbolColor: '#111b21',
          height: 52,
        },
      }
    : {};

function fitWindowToWorkArea(win: BrowserWindow): void {
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const area = display.workArea;
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  const x = Math.max(area.x, Math.min(bounds.x, area.x + area.width - width));
  const y = Math.max(area.y, Math.min(bounds.y, area.y + area.height - height));
  win.setBounds({ x, y, width, height });
}

const DESKTOP_DEV_MODE = !app.isPackaged;

function attachNativeWindowChrome(win: BrowserWindow): void {
  win.on('page-title-updated', (event) => {
    event.preventDefault();
  });
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private wizardWindow: BrowserWindow | null = null;

  constructor(
    private readonly configManager: ConfigManager,
    private readonly isQuitting: () => boolean,
  ) {}

  createWizardWindow(): BrowserWindow {
    if (this.wizardWindow) {
      this.wizardWindow.focus();
      return this.wizardWindow;
    }

    this.wizardWindow = new BrowserWindow({
      width: 720,
      height: 640,
      resizable: true,
      title: 'Inauzwa CRM Setup',
      ...MAC_FRAMELESS_OPTIONS,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    // Packaged: app.asar/renderer/setup-wizard/ (not under dist/)
    const wizardPath = path.join(app.getAppPath(), 'renderer', 'setup-wizard', 'index.html');
    if (!fs.existsSync(wizardPath)) {
      void dialog.showErrorBox(
        'Inauzwa CRM',
        `Setup wizard files are missing from the app package.\n\nExpected:\n${wizardPath}\n\nReinstall from a fresh build.`,
      );
      return this.wizardWindow;
    }
    void this.wizardWindow.loadFile(wizardPath);
    attachNativeWindowChrome(this.wizardWindow);

    this.wizardWindow.on('closed', () => {
      this.wizardWindow = null;
    });

    return this.wizardWindow;
  }

  createMainWindow(): BrowserWindow {
    if (this.mainWindow) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    const config = this.configManager.getConfig();
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      title: 'Inauzwa CRM',
      backgroundColor: '#f0f2f5',
      show: false,
      center: true,
      ...MAC_FRAMELESS_OPTIONS,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    const dashboardUrl = `http://127.0.0.1:${config.appPort}/`;
    const loadDashboard = () => {
      void this.mainWindow?.loadURL(dashboardUrl);
    };
    if (DESKTOP_DEV_MODE) {
      void session.defaultSession.clearCache().then(loadDashboard);
    } else {
      loadDashboard();
    }

    this.mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, url) => {
      if (errorCode === -3 || !url.startsWith(`http://127.0.0.1:${config.appPort}`)) return;
      setTimeout(loadDashboard, 1500);
    });

    this.mainWindow.once('ready-to-show', () => {
      if (!this.mainWindow) return;
      fitWindowToWorkArea(this.mainWindow);
      this.mainWindow.show();
      this.mainWindow.focus();
    });

    attachNativeWindowChrome(this.mainWindow);

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      void shell.openExternal(url);
      return { action: 'deny' };
    });

    this.mainWindow.on('close', (event) => {
      if (!this.isQuitting() && this.configManager.getConfig().minimizeToTray) {
        event.preventDefault();
        this.mainWindow?.hide();
      }
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  openDashboard(): void {
    const config = this.configManager.getConfig();
    if (!config.setupCompleted) {
      this.createWizardWindow();
      return;
    }
    this.createMainWindow();
  }

  private loadAppUrl(pathSuffix: string): void {
    const port = this.configManager.getConfig().appPort;
    const url = `http://127.0.0.1:${port}${pathSuffix}`;
    const win = this.mainWindow;
    if (!win) return;
    const load = () => {
      void win.loadURL(url);
    };
    if (DESKTOP_DEV_MODE) {
      void session.defaultSession.clearCache().then(load);
    } else {
      load();
    }
  }

  openSessions(): void {
    this.createMainWindow();
    this.loadAppUrl('/sessions');
  }

  openLogin(): void {
    this.createMainWindow();
    this.loadAppUrl('/login');
  }

  openSettings(): void {
    this.createMainWindow();
    this.loadAppUrl('/settings/desktop-app');
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  navigateTo(deepLink: string): void {
    this.createMainWindow();
    const win = this.mainWindow;
    if (!win) return;

    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();

    const path = deepLink.startsWith('/') ? deepLink : `/${deepLink}`;
    const sendNavigate = () => {
      win.webContents.send('desktop:navigate', path);
    };

    if (win.webContents.isLoading()) {
      win.webContents.once('did-finish-load', sendNavigate);
    } else {
      sendNavigate();
    }
  }

  closeWizard(): void {
    this.wizardWindow?.close();
    this.wizardWindow = null;
  }
}
