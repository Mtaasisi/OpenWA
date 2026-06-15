import { app } from 'electron';

export class AutoLaunchManager {
  setEnabled(enabled: boolean): void {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: false,
      });
    }
  }

  isEnabled(): boolean {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      return app.getLoginItemSettings().openAtLogin;
    }
    return false;
  }
}
