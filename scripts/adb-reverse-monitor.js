#!/usr/bin/env node

/**
 * ADB Reverse Port Forward Monitor
 * 
 * Automatically detects when an Android device is plugged in or reconnected
 * and applies ADB reverse port forwarding for development ports (Metro, API).
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Terminal Colors (ANSI escape sequences)
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m'
};

// Configuration
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds for ultra-responsive reconnection
let targetPorts = [8081, 8000]; // Default ports: Metro (8081) and API (8000)

// Parse command line arguments for custom ports
const args = process.argv.slice(2);
if (args.length > 0) {
  const customPorts = args.map(p => parseInt(p, 10)).filter(p => !isNaN(p) && p > 0);
  if (customPorts.length > 0) {
    targetPorts = customPorts;
  }
}

// Find ADB path
function findAdbPath() {
  const possiblePaths = [
    // Direct verified path on this user's machine
    'C:\\Users\\dwill\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
    // Environment variables
    process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe') : null,
    process.env.ANDROID_SDK_ROOT ? path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe') : null,
    // Typical windows home directory path
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    // Default fallback (relies on PATH)
    'adb'
  ].filter(Boolean);

  for (const adbPath of possiblePaths) {
    if (adbPath === 'adb') return 'adb';
    try {
      if (fs.existsSync(adbPath)) {
        return adbPath;
      }
    } catch (e) {
      // Ignore read errors
    }
  }
  return 'adb';
}

const ADB_PATH = findAdbPath();
const knownDevices = new Map(); // Keep track of active devices and their connection status
let spinnerIndex = 0;
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Query device metadata (brand, model)
function getDeviceMetadata(serial) {
  try {
    const brand = execSync(`"${ADB_PATH}" -s ${serial} shell getprop ro.product.manufacturer`, { encoding: 'utf8' }).trim();
    const model = execSync(`"${ADB_PATH}" -s ${serial} shell getprop ro.product.model`, { encoding: 'utf8' }).trim();
    const name = [brand, model].filter(Boolean).join(' ');
    return name || 'Unknown Android Device';
  } catch (e) {
    return 'Android Device';
  }
}

// Apply reverse port forwarding for a single device
function applyReverseForward(serial, deviceName) {
  console.log(`\n${COLORS.bright}${COLORS.cyan}[⚡ CONNECTION]${COLORS.reset} ${COLORS.bright}${deviceName}${COLORS.reset} (${COLORS.dim}${serial}${COLORS.reset}) detected!`);
  console.log(`${COLORS.dim}Applying reverse port forwards...${COLORS.reset}`);

  let successCount = 0;
  for (const port of targetPorts) {
    try {
      execSync(`"${ADB_PATH}" -s ${serial} reverse tcp:${port} tcp:${port}`);
      console.log(`  ${COLORS.green}✔${COLORS.reset} Port ${COLORS.bright}${port}${COLORS.reset} forwarded successfully`);
      successCount++;
    } catch (err) {
      console.log(`  ${COLORS.red}✘${COLORS.reset} Failed to forward port ${COLORS.bright}${port}${COLORS.reset}: ${err.message.split('\n')[0]}`);
    }
  }

  if (successCount === targetPorts.length) {
    console.log(`${COLORS.green}✨ All reverse port forwards successfully applied!${COLORS.reset}\n`);
  } else if (successCount > 0) {
    console.log(`${COLORS.yellow}⚠ Port forwarding completed with some warnings.${COLORS.reset}\n`);
  } else {
    console.log(`${COLORS.red}❌ All port forwarding attempts failed.${COLORS.reset}\n`);
  }
}

// Print header
function printHeader() {
  console.clear();
  console.log(`${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}     🔄  ADB REVERSE PORT FORWARD MONITOR  🔄${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}`);
  console.log(`${COLORS.blue}ADB Path:${COLORS.reset} ${COLORS.dim}${ADB_PATH}${COLORS.reset}`);
  console.log(`${COLORS.blue}Target Ports:${COLORS.reset} ${COLORS.bright}${targetPorts.join(', ')}${COLORS.reset}`);
  console.log(`${COLORS.blue}Interval:${COLORS.reset} ${POLL_INTERVAL_MS / 1000} seconds`);
  console.log(`${COLORS.dim}Press Ctrl+C to stop the monitor and exit.${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.cyan}====================================================${COLORS.reset}\n`);
}

// Check devices
function checkDevices() {
  try {
    const stdout = execSync(`"${ADB_PATH}" devices`, { encoding: 'utf8' });
    const lines = stdout.split('\n');
    
    // Parse serials
    const currentDevices = new Map();
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        const serial = parts[0];
        currentDevices.set(serial, true);
      }
    }

    // Handle disconnected devices
    for (const [serial, deviceName] of knownDevices.entries()) {
      if (!currentDevices.has(serial)) {
        console.log(`\n${COLORS.bright}${COLORS.yellow}[🔌 DISCONNECT]${COLORS.reset} ${COLORS.bright}${deviceName}${COLORS.reset} (${COLORS.dim}${serial}${COLORS.reset}) disconnected!`);
        console.log(`${COLORS.dim}Waiting for reconnection...${COLORS.reset}\n`);
        knownDevices.delete(serial);
      }
    }

    // Handle connected/newly detected devices
    for (const serial of currentDevices.keys()) {
      if (!knownDevices.has(serial)) {
        const deviceName = getDeviceMetadata(serial);
        knownDevices.set(serial, deviceName);
        applyReverseForward(serial, deviceName);
      }
    }

    // Update terminal status line
    if (knownDevices.size === 0) {
      const spinner = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
      spinnerIndex++;
      process.stdout.write(`\r${COLORS.yellow}${spinner}${COLORS.reset} Monitoring ADB: ${COLORS.dim}No devices connected. Plug in your device via USB...${COLORS.reset}`);
    } else {
      const spinner = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
      spinnerIndex++;
      const list = Array.from(knownDevices.values()).map(n => `${COLORS.bright}${COLORS.green}${n}${COLORS.reset}`).join(', ');
      process.stdout.write(`\r${COLORS.green}${spinner}${COLORS.reset} Monitoring ADB: ${COLORS.dim}Forwarding active on${COLORS.reset} [${list}] `);
    }

  } catch (err) {
    process.stdout.write(`\r${COLORS.red}⚠ Error checking ADB devices:${COLORS.reset} ${err.message.split('\n')[0]}`);
  }
}

// Start
printHeader();
checkDevices();
setInterval(checkDevices, POLL_INTERVAL_MS);

// Handle exit cleanly
process.on('SIGINT', () => {
  console.log(`\n\n${COLORS.cyan}Stopping ADB Reverse Monitor...${COLORS.reset}`);
  console.log(`${COLORS.dim}Reverse port forwards will remain active on your device until disconnected.${COLORS.reset}`);
  console.log(`${COLORS.bright}${COLORS.green}Goodbye!${COLORS.reset}\n`);
  process.exit(0);
});
