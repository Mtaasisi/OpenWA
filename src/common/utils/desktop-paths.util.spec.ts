import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  applyDesktopPathEnvDefaults,
  ensureDesktopDirectories,
  getDesktopDataRoot,
  isDesktopMode,
  pathExistsAndWritable,
} from './desktop-paths.util';

describe('desktop-paths.util', () => {
  const originalEnv = { ...process.env };
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'inauzwa-desktop-test-'));
    process.env = { ...originalEnv };
    process.env.APP_DESKTOP_MODE = 'true';
    process.env.OPENWA_DATA_ROOT = tempRoot;
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('detects desktop mode', () => {
    expect(isDesktopMode()).toBe(true);
    process.env.APP_DESKTOP_MODE = 'false';
    expect(isDesktopMode()).toBe(false);
  });

  it('creates desktop subdirectories', () => {
    ensureDesktopDirectories();
    expect(fs.existsSync(path.join(tempRoot, 'sessions'))).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, 'logs'))).toBe(true);
  });

  it('applies path env defaults', () => {
    applyDesktopPathEnvDefaults();
    expect(process.env.SESSION_DATA_PATH).toBe(path.join(tempRoot, 'sessions'));
    expect(process.env.STORAGE_LOCAL_PATH).toBe(path.join(tempRoot, 'media'));
    expect(getDesktopDataRoot()).toBe(tempRoot);
  });

  it('checks writable paths', () => {
    expect(pathExistsAndWritable(path.join(tempRoot, 'media'))).toBe(true);
  });
});
