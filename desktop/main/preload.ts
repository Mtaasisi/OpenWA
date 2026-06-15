import { contextBridge, ipcRenderer, shell, type IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('desktop', {
  getConfig: () => ipcRenderer.invoke('desktop:getConfig'),
  getMaskedConfig: () => ipcRenderer.invoke('desktop:getMaskedConfig'),
  saveConfig: (updates: Record<string, unknown>) => ipcRenderer.invoke('desktop:saveConfig', updates),
  resetConfig: () => ipcRenderer.invoke('desktop:resetConfig'),
  checkStorage: () => ipcRenderer.invoke('desktop:checkStorage'),
  testDatabase: (databaseUrl: string) => ipcRenderer.invoke('desktop:testDatabase', databaseUrl),
  ensureDatabaseReady: () => ipcRenderer.invoke('desktop:ensureDatabaseReady'),
  runMigrations: (databaseUrl?: string) => ipcRenderer.invoke('desktop:runMigrations', databaseUrl),
  seedDefaults: () => ipcRenderer.invoke('desktop:seedDefaults'),
  getAdminSetupStatus: () => ipcRenderer.invoke('desktop:getAdminSetupStatus'),
  createAdmin: (payload: { email?: string; password?: string; name?: string }) =>
    ipcRenderer.invoke('desktop:createAdmin', payload),
  listBranches: () => ipcRenderer.invoke('desktop:listBranches'),
  setupBranch: (payload: Record<string, unknown>) => ipcRenderer.invoke('desktop:setupBranch', payload),
  registerDevice: () => ipcRenderer.invoke('desktop:registerDevice'),
  completeSetup: () => ipcRenderer.invoke('desktop:completeSetup'),
  getHealth: () => ipcRenderer.invoke('desktop:getHealth'),
  getBackendStatus: () => ipcRenderer.invoke('desktop:getBackendStatus'),
  getBackendLogs: () => ipcRenderer.invoke('desktop:getBackendLogs'),
  startBackend: () => ipcRenderer.invoke('desktop:startBackend'),
  stopBackend: () => ipcRenderer.invoke('desktop:stopBackend'),
  restartBackend: () => ipcRenderer.invoke('desktop:restartBackend'),
  openFolder: (name: string) => ipcRenderer.invoke('desktop:openFolder', name),
  openDashboard: () => ipcRenderer.invoke('desktop:openDashboard'),
  exportDiagnostics: () => ipcRenderer.invoke('desktop:exportDiagnostics'),
  getAppVersion: () => ipcRenderer.invoke('desktop:getAppVersion'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:checkForUpdates'),
  showNotification: (payload: {
    title: string;
    body?: string;
    tag?: string;
    deepLink?: string;
    silent?: boolean;
  }) => ipcRenderer.invoke('desktop:showNotification', payload),
  isAppInBackground: () => ipcRenderer.invoke('desktop:isAppInBackground') as Promise<boolean>,
  getNotificationPermission: () =>
    ipcRenderer.invoke('desktop:getNotificationPermission') as Promise<'granted' | 'denied' | 'default'>,
  requestNotificationPermission: () =>
    ipcRenderer.invoke('desktop:requestNotificationPermission') as Promise<'granted' | 'denied' | 'default'>,
  syncNotificationPrefs: (prefs: Record<string, unknown>) =>
    ipcRenderer.invoke('desktop:syncNotificationPrefs', prefs),
  setDockBadge: (count: string) => ipcRenderer.invoke('desktop:setDockBadge', count),
  onNavigate: (callback: (path: string) => void) => {
    const listener = (_event: IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('desktop:navigate', listener);
    return () => ipcRenderer.removeListener('desktop:navigate', listener);
  },
  openExternal: (url: string) => shell.openExternal(url),
  isDesktopApp: true,
  platform: process.platform,
});
