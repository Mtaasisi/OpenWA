import * as fs from 'fs';
import * as path from 'path';

const LOCK_FILES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'] as const;

export function sessionProfileDir(sessionDataPath: string, sessionName: string): string {
  return path.join(path.resolve(sessionDataPath), `session-${sessionName}`);
}

function pathExistsIncludingSymlink(filePath: string): boolean {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Remove stale Chromium singleton locks left after container restarts or crashed browsers. */
export function clearChromiumProfileLocks(profileDir: string): void {
  if (!pathExistsIncludingSymlink(profileDir)) return;
  for (const name of LOCK_FILES) {
    const lockPath = path.join(profileDir, name);
    try {
      if (pathExistsIncludingSymlink(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    } catch {
      // ignore — another live process may hold the lock
    }
  }
}

/** Kill orphaned Chromium from a stale singleton lock, then clear lock files. */
export function releaseChromiumProfile(profileDir: string): void {
  if (!pathExistsIncludingSymlink(profileDir)) return;

  const socketPath = path.join(profileDir, 'SingletonSocket');
  try {
    if (pathExistsIncludingSymlink(socketPath)) {
      const socketTarget = fs.readlinkSync(socketPath);
      const tmpDir = path.dirname(socketTarget);
      if (tmpDir.startsWith('/tmp/') && fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  } catch {
    // ignore stale socket cleanup errors
  }

  const lockPath = path.join(profileDir, 'SingletonLock');
  try {
    if (pathExistsIncludingSymlink(lockPath)) {
      const target = fs.readlinkSync(lockPath);
      const pid = Number.parseInt(target.split('-').pop() ?? '', 10);
      if (Number.isFinite(pid) && pid > 0) {
        try {
          process.kill(pid, 0);
          process.kill(pid, 'SIGKILL');
        } catch {
          // process already exited
        }
      }
    }
  } catch {
    // ignore readlink / kill errors
  }

  clearChromiumProfileLocks(profileDir);
}

export function isChromiumProfileLockError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('profile appears to be in use') ||
    lower.includes('process_singleton') ||
    lower.includes('singletonlock') ||
    lower.includes('browser is already running')
  );
}

/** Release locks and delete the Chromium profile directory for a session. */
export function removeSessionProfileDir(sessionDataPath: string, sessionName: string): void {
  const profileDir = sessionProfileDir(sessionDataPath, sessionName);
  releaseChromiumProfile(profileDir);
  fs.rmSync(profileDir, { recursive: true, force: true });
}
