#!/usr/bin/env node
/**
 * Downloads Node.js 22 and Puppeteer Chrome into desktop/runtimes/ for electron-builder.
 * Run before dist: npm run prepare:desktop-runtime (from repo root)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');

const NODE_VERSION = '22.14.0';
const root = path.resolve(__dirname, '..', '..');
const runtimesDir = path.resolve(__dirname, '..', 'runtimes');

function platformArchive() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'darwin') {
    const a = arch === 'arm64' ? 'arm64' : 'x64';
    return {
      url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${a}.tar.gz`,
      ext: 'tar.gz',
      folder: `node-v${NODE_VERSION}-darwin-${a}`,
    };
  }
  if (platform === 'win32') {
    return {
      url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`,
      ext: 'zip',
      folder: `node-v${NODE_VERSION}-win-x64`,
    };
  }
  return {
    url: `https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz`,
    ext: 'tar.xz',
    folder: `node-v${NODE_VERSION}-linux-x64`,
  };
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? https : http;
    getter
      .get(url, res => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed ${res.statusCode}: ${url}`));
          return;
        }
        const file = createWriteStream(dest);
        pipeline(res, file).then(resolve).catch(reject);
      })
      .on('error', reject);
  });
}

async function ensureNode() {
  const { url, ext, folder } = platformArchive();
  const nodeDest = path.join(runtimesDir, 'node', folder);
  const bin =
    process.platform === 'win32'
      ? path.join(nodeDest, 'node.exe')
      : path.join(nodeDest, 'bin', 'node');

  if (fs.existsSync(bin)) {
    console.log('Node runtime already present:', bin);
    return;
  }

  fs.mkdirSync(path.join(runtimesDir, 'node'), { recursive: true });
  const archivePath = path.join(runtimesDir, `node-download.${ext}`);
  console.log('Downloading Node', NODE_VERSION, 'from', url);
  await download(url, archivePath);

  fs.mkdirSync(nodeDest, { recursive: true });
  if (ext === 'zip') {
    execSync(
      `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${path.join(runtimesDir, 'node')}' -Force"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`tar -xf "${archivePath}" -C "${path.join(runtimesDir, 'node')}"`, {
      stdio: 'inherit',
    });
  }
  fs.unlinkSync(archivePath);
  console.log('Node installed to', nodeDest);
}

function findChromeBinary(root, depth = 0) {
  if (!fs.existsSync(root) || depth > 12) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isFile()) {
      const base = entry.name.toLowerCase();
      if (
        base === 'chrome' ||
        base === 'chrome.exe' ||
        base === 'google chrome for testing'
      ) {
        return full;
      }
    } else if (entry.isDirectory()) {
      const found = findChromeBinary(full, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function ensureChromium() {
  const chromeRoot = path.join(runtimesDir, 'chromium');
  if (fs.existsSync(chromeRoot) && findChromeBinary(chromeRoot)) {
    console.log('Chromium runtime already present');
    return;
  }

  fs.mkdirSync(chromeRoot, { recursive: true });
  console.log('Installing Puppeteer Chrome to', chromeRoot);
  execSync(
    `npx puppeteer browsers install chrome --path "${chromeRoot}"`,
    { cwd: root, stdio: 'inherit', env: { ...process.env, PUPPETEER_CACHE_DIR: chromeRoot } },
  );
  console.log('Chromium install complete');
}

async function main() {
  fs.mkdirSync(runtimesDir, { recursive: true });
  await ensureNode();
  try {
    await ensureChromium();
  } catch (err) {
    console.warn('Chromium download failed (WhatsApp may use system Chrome):', err.message);
  }
  console.log('Desktop runtimes ready in', runtimesDir);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
