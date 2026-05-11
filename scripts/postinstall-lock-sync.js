#!/usr/bin/env node
/**
 * Post-install script to ensure package-lock.json is in sync
 * Runs after npm install to verify lock file matches package.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dirs = ['backend', 'anchor/mobile'];

dirs.forEach(dir => {
  const pkgPath = path.join(__dirname, '..', dir, 'package.json');
  const lockPath = path.join(__dirname, '..', dir, 'package-lock.json');

  if (!fs.existsSync(pkgPath)) {
    console.log(`⏭️  Skipping ${dir} (package.json not found)`);
    return;
  }

  try {
    console.log(`🔄 Syncing lock file for ${dir}...`);
    execSync('npm install --package-lock-only', {
      cwd: path.join(__dirname, '..', dir),
      stdio: 'inherit'
    });
    console.log(`✅ ${dir} lock file synced`);
  } catch (err) {
    console.error(`⚠️  Failed to sync lock file for ${dir}:`, err.message);
    process.exit(1);
  }
});
