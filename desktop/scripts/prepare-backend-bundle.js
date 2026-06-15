#!/usr/bin/env node
/**
 * Verifies backend and dashboard build outputs exist before electron-builder packaging.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const bundledModules = path.join(__dirname, '..', '.bundle', 'backend', 'node_modules');
const wizardIndex = path.join(__dirname, '..', 'renderer', 'setup-wizard', 'index.html');
const required = [
  path.join(root, 'dist', 'main.js'),
  path.join(root, 'dashboard', 'dist', 'index.html'),
  bundledModules,
  wizardIndex,
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required build artifact: ${file}`);
    console.error('Run: npm run build:backend && npm run build:dashboard');
    process.exit(1);
  }
}

const runtimesNode = path.join(__dirname, '..', 'runtimes', 'node');
if (!fs.existsSync(runtimesNode)) {
  console.log('desktop/runtimes/node not found — downloading bundled Node runtime…');
  const { execSync } = require('child_process');
  execSync('node scripts/download-runtime.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
}
if (!fs.existsSync(runtimesNode)) {
  console.error('Missing desktop/runtimes/node after download attempt.');
  console.error('Run from repo root: npm run prepare:desktop-runtime');
  process.exit(1);
} else {
  // electron-builder fails copying npm/npx symlinks in the Node runtime; only bin/node is used.
  for (const folder of fs.readdirSync(runtimesNode, { withFileTypes: true })) {
    if (!folder.isDirectory()) continue;
    const binDir = path.join(runtimesNode, folder.name, 'bin');
    if (!fs.existsSync(binDir)) continue;
    for (const name of ['npm', 'npx', 'corepack']) {
      const link = path.join(binDir, name);
      if (fs.existsSync(link)) fs.unlinkSync(link);
    }
  }
}

if (!fs.existsSync(bundledModules)) {
  console.error('Missing production backend dependencies.');
  console.error('Run: node desktop/scripts/prepare-backend-deps.js');
  process.exit(1);
}

console.log('Desktop bundle prerequisites OK');
