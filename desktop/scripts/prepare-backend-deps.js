#!/usr/bin/env node
/**
 * Build a production-only node_modules tree for electron-builder packaging.
 * Keeps native modules (sqlite3, etc.) while dropping devDependencies.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..', '..');
const bundleDir = path.join(__dirname, '..', '.bundle', 'backend');
const lockFile = path.join(root, 'package-lock.json');

if (!fs.existsSync(lockFile)) {
  console.error('package-lock.json is required for reproducible desktop bundles');
  process.exit(1);
}

console.log('Preparing production backend dependencies…');
fs.rmSync(bundleDir, { recursive: true, force: true });
fs.mkdirSync(bundleDir, { recursive: true });

fs.copyFileSync(path.join(root, 'package.json'), path.join(bundleDir, 'package.json'));
fs.copyFileSync(lockFile, path.join(bundleDir, 'package-lock.json'));

execSync('npm ci --omit=dev', {
  cwd: bundleDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  },
});

const nmPath = path.join(bundleDir, 'node_modules');
if (!fs.existsSync(nmPath)) {
  console.error('Production node_modules was not created');
  process.exit(1);
}

const sizeMb = Math.round(
  execSync(`du -sm "${nmPath}"`, { encoding: 'utf8' }).trim().split('\t')[0],
);
console.log(`Production backend node_modules ready (${sizeMb} MB)`);
