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

// Read the ports currently reverse-forwarded for a device.
// Returns null when the list cannot be read, so callers can skip rather than guess.
function getActiveForwards(serial) {
  try {
    const out = execSync(`"${ADB_PATH}" -s ${serial} reverse --list`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const ports = new Set();
    for (const line of out.split('\n')) {
      const match = line.match(/tcp:(\d+)\s+tcp:(\d+)/);
      if (match) ports.add(parseInt(match[1], 10));
    }
    return ports;
  } catch (e) {
    return null;
  }
}

// Forwards can be dropped without the device ever disconnecting — an adb server
// restart or another tool cycling `adb reverse` wipes them silently. Re-apply any
// that went missing so a still-connected device does not sit there unreachable.
function reapplyMissingForwards(serial, deviceName) {
  const active = getActiveForwards(serial);
  if (!active) return;

  const missing = targetPorts.filter(port => !active.has(port));
  if (missing.length === 0) return;

  console.log(`\n${COLORS.bright}${COLORS.magenta}[♻ RESTORE]${COLORS.reset} Forwards missing on ${COLORS.bright}${deviceName}${COLORS.reset} — re-applying...`);
  for (const port of missing) {
    try {
      execSync(`"${ADB_PATH}" -s ${serial} reverse tcp:${port} tcp:${port}`);
      console.log(`  ${COLORS.green}✔${COLORS.reset} Port ${COLORS.bright}${port}${COLORS.reset} restored`);
    } catch (err) {
      console.log(`  ${COLORS.red}✘${COLORS.reset} Failed to restore port ${COLORS.bright}${port}${COLORS.reset}: ${err.message.split('\n')[0]}`);
    }
  }
  console.log('');
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

let lastKnownIp = null;
let wifiReconnectAttempts = 0;

// Verifying forwards costs an `adb reverse --list` per device, so do it every
// few polls rather than every one.
const VERIFY_EVERY_N_POLLS = 5;
let verifyTick = 0;

function getDeviceIp(serial) {
  try {
    const output = execSync(`"${ADB_PATH}" -s ${serial} shell ip address show wlan0`, { encoding: 'utf8' });
    const match = output.match(/inet\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    return match ? match[1] : null;
  } catch (e) {
    try {
      const output = execSync(`"${ADB_PATH}" -s ${serial} shell ip route`, { encoding: 'utf8' });
      const match = output.match(/src\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
      return match ? match[1] : null;
    } catch (err) {
      return null;
    }
  }
}

function enableWifiAdb(serial) {
  try {
    console.log(`\n${COLORS.bright}${COLORS.yellow}[📶 WI-FI SETUP]${COLORS.reset} Enabling wireless ADB on ${serial}...`);
    execSync(`"${ADB_PATH}" -s ${serial} tcpip 5555`);
    
    // Give ADB a brief moment to cycle the connection
    let ip = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      ip = getDeviceIp(serial);
      if (ip) break;
      execSync('node -e "setTimeout(() => {}, 1000)"'); // sync wait
    }
    
    if (ip) {
      lastKnownIp = ip;
      console.log(`  ${COLORS.green}✔${COLORS.reset} Device IP found: ${COLORS.bright}${ip}${COLORS.reset}`);
      console.log(`  Connecting to ${ip}:5555...`);
      try {
        execSync(`"${ADB_PATH}" connect ${ip}:5555`, { stdio: 'inherit' });
      } catch (err) {
        // sometimes the first connect attempt fails right after tcpip command, try once more
        execSync('node -e "setTimeout(() => {}, 1000)"');
        execSync(`"${ADB_PATH}" connect ${ip}:5555`, { stdio: 'inherit' });
      }
    } else {
      console.log(`  ${COLORS.red}✘${COLORS.reset} Could not find device Wi-Fi IP address.`);
    }
  } catch (e) {
    console.log(`  ${COLORS.red}✘${COLORS.reset} Wi-Fi setup failed: ${e.message.split('\n')[0]}`);
  }
}

// Check devices
function checkDevices() {
  try {
    const stdout = execSync(`"${ADB_PATH}" devices`, { encoding: 'utf8' });
    const lines = stdout.split('\n');
    
    // Parse serials
    const currentDevices = new Map();
    let hasUsbDevice = false;
    let hasWifiDevice = false;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts[1] === 'device') {
        const serial = parts[0];
        currentDevices.set(serial, true);
        if (serial.includes(':5555') || serial.includes('.')) {
          hasWifiDevice = true;
          // Extract IP to save as last known
          const ipPart = serial.split(':')[0];
          if (ipPart) lastKnownIp = ipPart;
        } else {
          hasUsbDevice = true;
        }
      }
    }

    // If a USB device is plugged in but not connected wirelessly, set it up
    if (hasUsbDevice && !hasWifiDevice) {
      for (const serial of currentDevices.keys()) {
        if (!serial.includes(':5555') && !serial.includes('.')) {
          enableWifiAdb(serial);
          // Recheck devices after a short pause to pick up the new wireless connection
          setTimeout(checkDevices, 1500);
          return;
        }
      }
    }

    // If no devices are connected but we have a lastKnownIp, try to reconnect
    if (currentDevices.size === 0 && lastKnownIp) {
      wifiReconnectAttempts++;
      if (wifiReconnectAttempts % 5 === 1) { // Try to connect every ~10s to avoid spamming too fast
        process.stdout.write(`\r${COLORS.yellow}🔄${COLORS.reset} Reconnecting to ${lastKnownIp}:5555...`);
        try {
          execSync(`"${ADB_PATH}" connect ${lastKnownIp}:5555`, { stdio: 'ignore' });
        } catch (e) {}
      }
    } else if (currentDevices.size > 0) {
      wifiReconnectAttempts = 0;
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
    verifyTick++;
    const shouldVerify = verifyTick % VERIFY_EVERY_N_POLLS === 0;
    for (const serial of currentDevices.keys()) {
      if (!knownDevices.has(serial)) {
        const deviceName = getDeviceMetadata(serial);
        knownDevices.set(serial, deviceName);
        applyReverseForward(serial, deviceName);
      } else if (shouldVerify) {
        // Already-known device: confirm its forwards are still bound
        reapplyMissingForwards(serial, knownDevices.get(serial));
      }
    }

    // Update terminal status line
    if (knownDevices.size === 0) {
      const spinner = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length];
      spinnerIndex++;
      let msg = `No devices connected. Plug in your device via USB...`;
      if (lastKnownIp) {
        msg = `No devices connected. Auto-reconnecting to last known IP: ${lastKnownIp}...`;
      }
      process.stdout.write(`\r${COLORS.yellow}${spinner}${COLORS.reset} Monitoring ADB: ${COLORS.dim}${msg}${COLORS.reset}`);
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
