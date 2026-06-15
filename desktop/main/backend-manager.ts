import { ChildProcess, execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ConfigManager } from './config-manager';
import { resolveNodeBinary } from './runtime-paths';
import { resolveRepoRoot } from './paths';

export type BackendStatus = 'stopped' | 'starting' | 'running' | 'crashed';

export class BackendManager {
  private process: ChildProcess | null = null;
  private status: BackendStatus = 'stopped';
  private logStream: fs.WriteStream | null = null;
  private restartAttempts = 0;
  private readonly maxRestartsPerMinute = 5;
  private restartTimestamps: number[] = [];
  private shuttingDown = false;
  private statusListeners: Array<(prev: BackendStatus, next: BackendStatus) => void> = [];

  constructor(private readonly configManager: ConfigManager) {}

  onStatusChange(listener: (prev: BackendStatus, next: BackendStatus) => void): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter(l => l !== listener);
    };
  }

  private setStatus(next: BackendStatus): void {
    const prev = this.status;
    if (prev === next) return;
    this.status = next;
    for (const listener of this.statusListeners) {
      listener(prev, next);
    }
  }

  getBackendStatus(): BackendStatus {
    return this.status;
  }

  getBackendLogs(maxLines = 200): string {
    const logPath = path.join(this.configManager.getConfig().logsPath, 'backend.log');
    if (!fs.existsSync(logPath)) return '';
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    return lines.slice(-maxLines).join('\n');
  }

  private resolveBackendPaths(): { nodeBin: string; mainJs: string; cwd: string; staticPath: string } {
    const isDev = !app.isPackaged;
    if (isDev) {
      const repoRoot = resolveRepoRoot();
      return {
        nodeBin: process.execPath.includes('Electron') ? 'node' : process.execPath,
        mainJs: path.join(repoRoot, 'dist', 'main.js'),
        cwd: repoRoot,
        staticPath: path.join(repoRoot, 'dashboard', 'dist'),
      };
    }
    const resources = process.resourcesPath;
    return {
      nodeBin: process.execPath.includes('Electron') ? 'node' : process.execPath,
      mainJs: path.join(resources, 'backend', 'dist', 'main.js'),
      cwd: path.join(resources, 'backend'),
      staticPath: path.join(resources, 'dashboard', 'dist'),
    };
  }

  private buildEnv(): NodeJS.ProcessEnv {
    const config = this.configManager.getConfig();
    this.configManager.writeAppEnv();
    const envPath = path.join(this.configManager.getAppDataRoot(), 'config', 'app.env');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      APP_DESKTOP_MODE: 'true',
      OPENWA_DATA_ROOT: this.configManager.getAppDataRoot(),
      PORT: String(config.appPort),
      APP_HOST: '127.0.0.1',
      NODE_ENV: 'production',
      DESKTOP_DEVICE_ID: config.deviceId,
      DESKTOP_SETUP_TOKEN: config.setupToken,
      DESKTOP_STATIC_PATH: this.resolveBackendPaths().staticPath,
    };

    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1);
        env[key] = value;
      }
    }
    // Desktop-spawned backend must always run in desktop mode (app.env must not override).
    env.APP_DESKTOP_MODE = 'true';
    return env;
  }

  private killListenersOnPort(port: number): void {
    try {
      if (process.platform === 'win32') {
        const out = execSync(
          `netstat -ano | findstr :${port} | findstr LISTENING`,
          { encoding: 'utf8' },
        );
        const pids = new Set(
          out
            .split('\n')
            .map(line => line.trim().split(/\s+/).pop())
            .filter((pid): pid is string => !!pid && /^\d+$/.test(pid)),
        );
        for (const pid of pids) {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        }
        return;
      }
      const pids = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);
      for (const pid of pids) {
        process.kill(parseInt(pid, 10), 'SIGTERM');
      }
    } catch {
      // Port already free or could not resolve listener.
    }
  }

  /** True when our Nest backend responds on the desktop health endpoint. */
  async isDesktopApiHealthy(): Promise<boolean> {
    const port = this.configManager.getConfig().appPort;
    const token = this.configManager.getConfig().setupToken;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health/desktop`, {
        headers: { 'X-Desktop-Setup-Token': token },
        signal: AbortSignal.timeout(2000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Free the desktop port when another process (e.g. Vite dev server) is bound to it. */
  private async prepareDesktopPort(): Promise<void> {
    if (await this.isDesktopApiHealthy()) return;

    const port = this.configManager.getConfig().appPort;
    let foreignServer = false;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(1200),
      });
      foreignServer = res.ok;
    } catch {
      return;
    }

    if (!foreignServer) return;

    this.killListenersOnPort(port);
    await new Promise(r => setTimeout(r, 800));
  }

  /** Start or recover the desktop backend without manual port cleanup. */
  async ensureDesktopBackend(): Promise<void> {
    const port = this.configManager.getConfig().appPort;
    const devMode = !app.isPackaged;

    // Dev: reclaim port from orphan Nest processes so dashboard/dist + backend code reload.
    if (devMode && (await this.isDesktopApiHealthy()) && !this.process) {
      this.killListenersOnPort(port);
      await new Promise((r) => setTimeout(r, 800));
    } else if (devMode && this.process && (await this.isDesktopApiHealthy())) {
      await this.restartBackend();
      return;
    }

    if (await this.isDesktopApiHealthy()) {
      if (!this.process) {
        this.setStatus('running');
      }
      return;
    }

    if (this.process) {
      await this.restartBackend();
      return;
    }

    await this.prepareDesktopPort();
    if (await this.isDesktopApiHealthy()) {
      this.setStatus('running');
      return;
    }

    await this.startBackend();
  }

  async startBackend(): Promise<void> {
    this.shuttingDown = false;
    if (this.process) return;

    if (await this.isDesktopApiHealthy()) {
      this.setStatus('running');
      return;
    }

    await this.prepareDesktopPort();

    const { mainJs, cwd } = this.resolveBackendPaths();
    if (!fs.existsSync(mainJs)) {
      throw new Error(
        `Backend entry not found: ${mainJs}. From the repo root run: npm run build`,
      );
    }

    const logPath = path.join(this.configManager.getConfig().logsPath, 'backend.log');
    this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    this.logStream.write(`\n--- Backend start ${new Date().toISOString()} ---\n`);

    this.setStatus('starting');
    const nodeExecutable = resolveNodeBinary();
    this.logStream.write(`Using Node: ${nodeExecutable}\n`);

    this.process = spawn(nodeExecutable, [mainJs], {
      cwd,
      env: this.buildEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.logStream?.write(chunk);
    });
    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.logStream?.write(chunk);
    });

    this.process.on('exit', (code) => {
      this.logStream?.write(`\n--- Backend exited with code ${code} ---\n`);
      this.process = null;
      this.setStatus(code === 0 ? 'stopped' : 'crashed');
      if (!this.shuttingDown && code !== 0 && code !== null) {
        this.scheduleRestart();
      }
    });

    const healthy = await this.waitForHealthCheck(90000);
    if (!healthy) {
      this.setStatus('crashed');
      const port = this.configManager.getConfig().appPort;
      throw new Error(
        `Local API did not start on port ${port}. Open Logs (tray menu) and read backend.log for details.`,
      );
    }
    this.setStatus('running');
    this.restartAttempts = 0;
  }

  private scheduleRestart(): void {
    if (this.shuttingDown) return;
    const now = Date.now();
    this.restartTimestamps = this.restartTimestamps.filter(t => now - t < 60000);
    if (this.restartTimestamps.length >= this.maxRestartsPerMinute) return;
    this.restartTimestamps.push(now);
    const delay = Math.min(5000 * (this.restartAttempts + 1), 30000);
    this.restartAttempts++;
    setTimeout(() => {
      if (this.shuttingDown) return;
      void this.startBackend().catch(() => undefined);
    }, delay);
  }

  async stopBackend(): Promise<void> {
    this.shuttingDown = true;
    const port = this.configManager.getConfig().appPort;

    if (this.process) {
      const proc = this.process;
      this.process = null;
      proc.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          proc.kill('SIGKILL');
          resolve();
        }, 10000);
        proc.on('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
      this.logStream?.end();
      this.logStream = null;
    }

    // Reclaim the desktop port even when we did not spawn the listener (orphan process).
    this.killListenersOnPort(port);
    this.setStatus('stopped');
  }

  async restartBackend(): Promise<void> {
    await this.stopBackend();
    await this.prepareDesktopPort();
    await this.startBackend();
  }

  async waitForHealthCheck(timeoutMs = 60000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await this.isDesktopApiHealthy()) return true;
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }
}
