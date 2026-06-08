#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ANDROID_PACKAGE = 'com.anchorintentions.app';
const ROOT = path.join(__dirname, '..');
const GOOGLE_SERVICES = path.join(ROOT, 'google-services.json');
const GOOGLE_SERVICES_ANDROID = path.join(ROOT, 'android', 'app', 'google-services.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--profile');
  return idx !== -1 ? args[idx + 1] : 'preview';
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function validateGoogleServices(filePath, profile) {
  if (!fs.existsSync(filePath)) {
    if (profile === 'development') {
      console.log(`Skipping ${filePath} (development profile)`);
      return;
    }
    fail(`${filePath} not found. Ensure FIREBASE_ANDROID_GOOGLE_SERVICES_JSON_B64 secret is set.`);
  }

  let config;
  try {
    config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    fail(`${filePath} is not valid JSON: ${e.message}`);
  }

  if (!config.project_info?.project_id) {
    fail(`${filePath} is missing project_info.project_id`);
  }

  if (!Array.isArray(config.client) || config.client.length === 0) {
    fail(`${filePath} is missing client array`);
  }

  const match = config.client.find(
    c => c.client_info?.android_client_info?.package_name === ANDROID_PACKAGE
  );
  if (!match) {
    fail(`${filePath} has no client entry for package "${ANDROID_PACKAGE}"`);
  }

  console.log(
    `  google-services.json OK — project: ${config.project_info.project_id}, package: ${ANDROID_PACKAGE}`
  );
}

const profile = parseArgs();
console.log(`Validating Firebase config (profile: ${profile})`);

validateGoogleServices(GOOGLE_SERVICES, profile);

// The materialization step copies the file here for EAS builds
if (fs.existsSync(GOOGLE_SERVICES_ANDROID)) {
  validateGoogleServices(GOOGLE_SERVICES_ANDROID, profile);
}

console.log('Firebase config validation passed.');
