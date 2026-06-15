#!/usr/bin/env node
/** Copy icon.png; electron-builder generates .ico/.icns from PNG when needed. */
const fs = require('fs');
const path = require('path');

const assets = path.resolve(__dirname, '..', 'assets');
const png = path.join(assets, 'icon.png');

if (!fs.existsSync(png)) {
  console.error('Missing desktop/assets/icon.png');
  process.exit(1);
}

// electron-builder generates platform icons from icon.png — do not copy PNG to .ico/.icns
console.log('Icons OK — using', png);
