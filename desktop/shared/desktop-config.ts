export interface DesktopAppConfig {
  appInstalledAt: string;
  deviceId: string;
  deviceName: string;
  appPort: number;
  databaseMode: 'embedded' | 'external';
  databaseUrl: string;
  businessName: string;
  branchId: string;
  branchName: string;
  adminEmail: string;
  setupCompleted: boolean;
  storagePath: string;
  sessionsPath: string;
  mediaPath: string;
  logsPath: string;
  aiKnowledgePath: string;
  autoStartBackend: boolean;
  openDashboardOnLaunch: boolean;
  startOnBoot: boolean;
  minimizeToTray: boolean;
  lastSuccessfulDbConnectionAt: string | null;
  appVersion: string;
  setupToken: string;
  jwtSecret: string;
  apiMasterKey: string;
}

export const DEFAULT_CONFIG: DesktopAppConfig = {
  appInstalledAt: '',
  deviceId: '',
  deviceName: '',
  appPort: 2886,
  databaseMode: 'embedded',
  databaseUrl: '',
  businessName: '',
  branchId: '',
  branchName: '',
  adminEmail: '',
  setupCompleted: false,
  storagePath: '',
  sessionsPath: '',
  mediaPath: '',
  logsPath: '',
  aiKnowledgePath: '',
  autoStartBackend: true,
  openDashboardOnLaunch: true,
  startOnBoot: false,
  minimizeToTray: true,
  lastSuccessfulDbConnectionAt: null,
  appVersion: '0.1.6',
  setupToken: '',
  jwtSecret: '',
  apiMasterKey: '',
};
