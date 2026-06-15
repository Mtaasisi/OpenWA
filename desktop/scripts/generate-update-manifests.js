#!/usr/bin/env node
/**
 * Generate latest-mac.yml / latest-mac-arm64.yml / latest.yml for electron-updater
 * from built installers in dist-desktop/.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const outDir = path.join(root, 'dist-desktop');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;

function sha512Base64(filePath) {
  const hash = crypto.createHash('sha512');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('base64');
}

function fileEntry(filePath) {
  const stat = fs.statSync(filePath);
  return {
    url: path.basename(filePath),
    sha512: sha512Base64(filePath),
    size: stat.size,
  };
}

function writeYaml(filePath, data) {
  const lines = [`version: ${data.version}`, 'files:'];
  for (const f of data.files) {
    lines.push(`  - url: ${f.url}`);
    lines.push(`    sha512: ${f.sha512}`);
    lines.push(`    size: ${f.size}`);
  }
  lines.push(`path: ${data.path}`);
  lines.push(`sha512: ${data.sha512}`);
  lines.push(`releaseDate: '${data.releaseDate}'`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  console.log('Wrote', path.basename(filePath));
}

if (!fs.existsSync(outDir)) {
  console.error('dist-desktop/ not found. Build installers first.');
  process.exit(1);
}

const releaseDate = new Date().toISOString();
const dmgs = fs.readdirSync(outDir).filter((f) => f.endsWith('.dmg'));
const exes = fs.readdirSync(outDir).filter((f) => f.endsWith('.exe') && !f.endsWith('.blockmap'));

if (dmgs.length === 0 && exes.length === 0) {
  console.error('No .dmg or .exe installers in dist-desktop/');
  process.exit(1);
}

for (const dmg of dmgs) {
  const full = path.join(outDir, dmg);
  const entry = fileEntry(full);
  const manifest = {
    version,
    files: [entry],
    path: entry.url,
    sha512: entry.sha512,
    releaseDate,
  };
  const isArm = /arm64/i.test(dmg);
  const name = isArm ? 'latest-mac-arm64.yml' : 'latest-mac.yml';
  writeYaml(path.join(outDir, name), manifest);
}

if (exes.length > 0) {
  const primary = exes.sort()[0];
  const full = path.join(outDir, primary);
  const entry = fileEntry(full);
  writeYaml(path.join(outDir, 'latest.yml'), {
    version,
    files: exes.map((f) => fileEntry(path.join(outDir, f))),
    path: entry.url,
    sha512: entry.sha512,
    releaseDate,
  });
}

console.log('Update manifests ready in dist-desktop/');
