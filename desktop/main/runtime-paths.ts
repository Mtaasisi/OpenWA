import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { resolveDesktopRoot } from './paths';

const NODE_VERSION = '22.14.0';

function platformNodeFolder(): string {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'darwin') {
    return arch === 'arm64' ? `node-v${NODE_VERSION}-darwin-arm64` : `node-v${NODE_VERSION}-darwin-x64`;
  }
  if (platform === 'win32') {
    return `node-v${NODE_VERSION}-win-x64`;
  }
  return `node-v${NODE_VERSION}-linux-x64`;
}

function nodeBinaryName(): string {
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function isChromiumExecutable(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return (
    base === 'chrome' ||
    base === 'chrome.exe' ||
    base === 'chromium' ||
    base === 'google chrome for testing'
  );
}

function findChromiumInTree(root: string, depth = 0): string | null {
  if (!fs.existsSync(root) || depth > 12) return null;

  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isFile() && isChromiumExecutable(full)) {
      return full;
    }
    if (entry.isDirectory()) {
      const found = findChromiumInTree(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** Bundled Node 22 shipped in extraResources (production). */
export function resolveBundledNodeBinary(): string | null {
  if (!app.isPackaged) return null;
  const folder = platformNodeFolder();
  const candidate = path.join(
    process.resourcesPath,
    'runtimes',
    'node',
    folder,
    'bin',
    nodeBinaryName(),
  );
  return fs.existsSync(candidate) ? candidate : null;
}

function resolveDevBundledNodeBinary(): string | null {
  const folder = platformNodeFolder();
  const candidate = path.join(
    resolveDesktopRoot(),
    'runtimes',
    'node',
    folder,
    'bin',
    nodeBinaryName(),
  );
  return fs.existsSync(candidate) ? candidate : null;
}

/** Puppeteer Chrome shipped in extraResources or desktop/runtimes (dev). */
export function resolveBundledChromiumExecutable(): string | null {
  const roots: string[] = [];
  if (app.isPackaged) {
    roots.push(path.join(process.resourcesPath, 'runtimes', 'chromium'));
  } else {
    roots.push(path.join(resolveDesktopRoot(), 'runtimes', 'chromium'));
  }
  for (const root of roots) {
    const found = findChromiumInTree(root);
    if (found) return found;
  }
  return null;
}

/** Dev fallbacks: system Chrome paths. */
export function resolveDevChromiumExecutable(): string | null {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) return envPath;

  const bundled = resolveBundledChromiumExecutable();
  if (bundled) return bundled;

  const candidates =
    process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : process.platform === 'win32'
        ? [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          ]
        : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

export function resolveNodeBinary(): string {
  const bundled = resolveBundledNodeBinary() ?? resolveDevBundledNodeBinary();
  if (bundled) return bundled;
  if (process.env.NODE_BIN && fs.existsSync(process.env.NODE_BIN)) {
    return process.env.NODE_BIN;
  }
  return 'node';
}

export function resolveChromiumExecutable(): string | null {
  return resolveDevChromiumExecutable();
}
