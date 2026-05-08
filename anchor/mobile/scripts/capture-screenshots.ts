// @ts-nocheck
/**
 * Store screenshot capture runner for the current Anchor Android app.
 *
 * Run from `anchor/mobile` with a connected Android device or emulator:
 *   npx tsx scripts/capture-screenshots.ts
 *
 * This script is intentionally standalone and only drives the existing app via
 * `adb` plus persisted dev flags. Removing it does not affect runtime code.
 *
 * Current-screen mappings used here:
 * - Requested `SigilSelectionScreen` maps to the live `StructureForgeScreen`.
 * - Requested tracing capture maps to `ManualReinforcementScreen`, which is the
 *   real tracing surface in this codebase.
 * - Requested ambient "Sanctuary" glow capture maps to `ChargeSetupScreen`,
 *   because that is where the current deep-purple prime aura lives.
 * - Requested `Profile/Settings` Thread Strength capture maps to
 *   `AnchorDetailScreen`, because the current profile/settings surfaces do not
 *   render that metric.
 * - Requested inline distillation preview on `IntentionInputScreen` does not
 *   exist in the current implementation, so step 2 captures the filled input
 *   state immediately before distillation.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const PACKAGE_NAME = process.env.ANCHOR_PACKAGE ?? 'com.anchorintentions.app';
const SERIAL_FROM_ENV = process.env.ADB_SERIAL ?? '';
const OUTPUT_DIR = path.resolve(__dirname, '../assets/store-screenshots');
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 2400;
const INTENTION = 'Build something that lasts';

const SCREENSHOTS = [
  { name: 'VaultScreen — empty state', file: '01_vault.png' },
  { name: 'IntentionInputScreen — filled intention', file: '02_intention.png' },
  { name: 'LetterDistillationScreen — mid animation', file: '03_distillation.png' },
  { name: 'StructureForgeScreen — contained selected', file: '04_sigil.png' },
  { name: 'ManualReinforcementScreen — tracing in progress', file: '05_focus.png' },
  { name: 'ChargeSetupScreen — ambient glow', file: '06_sanctuary.png' },
  { name: 'AnchorDetailScreen — Thread Strength visible', file: '07_profile.png' },
  { name: 'PaywallScreen — trial CTA', file: '08_paywall.png' },
] as const;

function fail(message: string): never {
  throw new Error(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string | undefined | null): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function adb(serial: string, args: string[], options: { binary?: boolean; allowFailure?: boolean } = {}) {
  const finalArgs = serial ? ['-s', serial, ...args] : args;
  const result = spawnSync('adb', finalArgs, {
    encoding: options.binary ? 'buffer' : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  if (!options.allowFailure && result.status !== 0) {
    const stderr = options.binary
      ? result.stderr?.toString?.('utf8') ?? ''
      : result.stderr ?? '';
    fail(`adb ${finalArgs.join(' ')} failed: ${stderr || 'unknown error'}`);
  }

  return options.binary ? result.stdout : String(result.stdout ?? '');
}

function resolveSerial(): string {
  if (SERIAL_FROM_ENV) {
    return SERIAL_FROM_ENV;
  }

  const output = adb('', ['devices']);
  const devices = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /\tdevice$/.test(line))
    .map((line) => line.split('\t')[0]);

  if (devices.length === 0) {
    fail('No Android device detected. Connect one or set ADB_SERIAL.');
  }

  if (devices.length > 1) {
    fail(`Multiple Android devices detected (${devices.join(', ')}). Set ADB_SERIAL.`);
  }

  return devices[0];
}

function resolveLaunchActivity(serial: string): string {
  const output = adb(serial, ['shell', 'cmd', 'package', 'resolve-activity', '--brief', PACKAGE_NAME]);
  const candidate = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .reverse()
    .find((line) => line.includes('/'));

  if (!candidate) {
    fail(`Could not resolve launch activity for ${PACKAGE_NAME}.`);
  }

  return candidate;
}

function ensureInstalled(serial: string): void {
  const packages = adb(serial, ['shell', 'pm', 'list', 'packages', PACKAGE_NAME]);
  if (!packages.includes(PACKAGE_NAME)) {
    fail(`Package ${PACKAGE_NAME} is not installed on ${serial}.`);
  }
}

function ensureWritableAppStorage(serial: string): void {
  adb(serial, ['shell', 'run-as', PACKAGE_NAME, 'true']);

  const sqliteCheck = adb(
    serial,
    ['shell', 'run-as', PACKAGE_NAME, 'sh', '-c', 'command -v sqlite3 >/dev/null 2>&1 && echo ok || echo missing']
  ).trim();

  if (sqliteCheck !== 'ok') {
    fail(
      `sqlite3 is not available inside run-as for ${PACKAGE_NAME}. ` +
      'Install a debug/dev build that exposes AsyncStorage through run-as.'
    );
  }
}

function ensureTargetResolution(serial: string): { width: number; height: number } {
  const output = adb(serial, ['shell', 'wm', 'size']);
  const match = output.match(/Physical size:\s*(\d+)x(\d+)/i);
  if (!match) {
    fail(`Could not read device resolution: ${output}`);
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (width !== TARGET_WIDTH || height !== TARGET_HEIGHT) {
    fail(
      `Expected a ${TARGET_WIDTH}x${TARGET_HEIGHT} device, found ${width}x${height}. ` +
      'Use the target Android device requested for the store assets.'
    );
  }

  return { width, height };
}

function clearAppData(serial: string): void {
  adb(serial, ['shell', 'pm', 'clear', PACKAGE_NAME]);
}

function forceStop(serial: string): void {
  adb(serial, ['shell', 'am', 'force-stop', PACKAGE_NAME], { allowFailure: true });
}

function launchApp(serial: string): void {
  const activity = resolveLaunchActivity(serial);
  adb(serial, ['shell', 'am', 'start', '-n', activity]);
}

function tap(serial: string, x: number, y: number): void {
  adb(serial, ['shell', 'input', 'tap', String(Math.round(x)), String(Math.round(y))]);
}

function swipe(serial: string, x1: number, y1: number, x2: number, y2: number, durationMs = 300): void {
  adb(serial, [
    'shell',
    'input',
    'swipe',
    String(Math.round(x1)),
    String(Math.round(y1)),
    String(Math.round(x2)),
    String(Math.round(y2)),
    String(Math.round(durationMs)),
  ]);
}

function inputText(serial: string, value: string): void {
  const escaped = value
    .replace(/ /g, '%s')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/&/g, '\\&');
  adb(serial, ['shell', 'input', 'text', escaped]);
}

function pressBack(serial: string): void {
  adb(serial, ['shell', 'input', 'keyevent', '4']);
}

function upsertAsyncStorageEntry(serial: string, key: string, value: string): void {
  const sql =
    'CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);' +
    `INSERT OR REPLACE INTO catalystLocalStorage(key, value) VALUES (${sqlLiteral(key)}, ${sqlLiteral(value)});`;

  adb(serial, [
    'shell',
    'run-as',
    PACKAGE_NAME,
    'sh',
    '-c',
    `mkdir -p databases && sqlite3 databases/RKStorage "${sql}"`,
  ]);
}

function removeAsyncStorageEntry(serial: string, key: string): void {
  const sql =
    'CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);' +
    `DELETE FROM catalystLocalStorage WHERE key = ${sqlLiteral(key)};`;

  adb(serial, [
    'shell',
    'run-as',
    PACKAGE_NAME,
    'sh',
    '-c',
    `mkdir -p databases && sqlite3 databases/RKStorage "${sql}"`,
  ]);
}

function seedDevelopmentState(serial: string): void {
  const settingsState = {
    state: {
      defaultCharge: { mode: 'ritual', preset: '2m' },
      defaultActivation: { type: 'visual', value: 30, unit: 'seconds', mode: 'silent' },
      developerModeEnabled: true,
      developerMasterAccountEnabled: true,
      developerSkipOnboardingEnabled: true,
      guideMode: true,
    },
    version: 9,
  };

  const subscriptionState = {
    state: {
      devOverrideEnabled: false,
      devTierOverride: 'pro',
      trialStartDate: new Date().toISOString(),
      subscriptionStatus: 'trial',
    },
    version: 2,
  };

  // Persist the zustand store snapshots.
  upsertAsyncStorageEntry(serial, 'anchor-settings-storage', JSON.stringify(settingsState));
  upsertAsyncStorageEntry(
    serial,
    'anchor-subscription-override-storage',
    JSON.stringify(subscriptionState)
  );

  // Persist the bridge keys consumed by `loadSettingsSnapshot()` on app start.
  upsertAsyncStorageEntry(serial, 'anchor:dev:developerModeEnabled', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:dev:masterAccount', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:dev:skipOnboarding', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:settings:practiceGuidance', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:settings:focusDuration', JSON.stringify(30));
  upsertAsyncStorageEntry(serial, 'anchor:settings:focusDefaultMode', JSON.stringify('silent'));
}

function seedExpiredPaywallState(serial: string): void {
  const settingsState = {
    state: {
      defaultCharge: { mode: 'ritual', preset: '2m' },
      defaultActivation: { type: 'visual', value: 30, unit: 'seconds', mode: 'silent' },
      developerModeEnabled: true,
      developerMasterAccountEnabled: false,
      developerSkipOnboardingEnabled: true,
      guideMode: true,
    },
    version: 9,
  };

  const subscriptionState = {
    state: {
      devOverrideEnabled: true,
      devTierOverride: 'expired',
      trialStartDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionStatus: 'expired',
    },
    version: 2,
  };

  upsertAsyncStorageEntry(serial, 'anchor-settings-storage', JSON.stringify(settingsState));
  upsertAsyncStorageEntry(
    serial,
    'anchor-subscription-override-storage',
    JSON.stringify(subscriptionState)
  );
  upsertAsyncStorageEntry(serial, 'anchor:dev:developerModeEnabled', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:dev:masterAccount', JSON.stringify(false));
  upsertAsyncStorageEntry(serial, 'anchor:dev:skipOnboarding', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:dev:overridesEnabled', JSON.stringify(true));
  upsertAsyncStorageEntry(serial, 'anchor:dev:simulatedTier', JSON.stringify('expired'));
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n');
}

function dumpUi(serial: string) {
  const raw = adb(serial, ['exec-out', 'uiautomator', 'dump', '/dev/tty']);
  const xmlStart = raw.indexOf('<?xml');
  const xml = xmlStart >= 0 ? raw.slice(xmlStart) : raw;
  const nodes: Array<{
    text: string;
    contentDesc: string;
    className: string;
    resourceId: string;
    clickable: boolean;
    enabled: boolean;
    bounds: { left: number; top: number; right: number; bottom: number };
  }> = [];

  const nodeRegex = /<node\b([^>]*)\/>/g;
  const attrRegex = /([^\s=]+)="([^"]*)"/g;
  let nodeMatch: RegExpExecArray | null;

  while ((nodeMatch = nodeRegex.exec(xml))) {
    const attrMap: Record<string, string> = {};
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrRegex.exec(nodeMatch[1]))) {
      attrMap[attrMatch[1]] = decodeXmlEntities(attrMatch[2]);
    }

    const boundsMatch = (attrMap.bounds ?? '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!boundsMatch) {
      continue;
    }

    nodes.push({
      text: attrMap.text ?? '',
      contentDesc: attrMap['content-desc'] ?? '',
      className: attrMap.class ?? '',
      resourceId: attrMap['resource-id'] ?? '',
      clickable: attrMap.clickable === 'true',
      enabled: attrMap.enabled !== 'false',
      bounds: {
        left: Number(boundsMatch[1]),
        top: Number(boundsMatch[2]),
        right: Number(boundsMatch[3]),
        bottom: Number(boundsMatch[4]),
      },
    });
  }

  return nodes;
}

function centerOf(node: { bounds: { left: number; top: number; right: number; bottom: number } }) {
  return {
    x: Math.round((node.bounds.left + node.bounds.right) / 2),
    y: Math.round((node.bounds.top + node.bounds.bottom) / 2),
  };
}

function findNodeByLabel(
  nodes: ReturnType<typeof dumpUi>,
  labels: string[],
  opts: { exact?: boolean; className?: string } = {}
) {
  const wanted = labels.map(normalize);
  const candidates = nodes.filter((node) => {
    if (!node.enabled) return false;
    if (opts.className && node.className !== opts.className) return false;
    const haystacks = [normalize(node.text), normalize(node.contentDesc)];
    return haystacks.some((haystack) =>
      wanted.some((label) => (opts.exact ? haystack === label : haystack.includes(label)))
    );
  });

  candidates.sort((left, right) => {
    if (left.clickable !== right.clickable) return left.clickable ? -1 : 1;
    return left.bounds.top - right.bounds.top;
  });

  return candidates[0] ?? null;
}

function findFirstByClass(nodes: ReturnType<typeof dumpUi>, className: string) {
  return nodes.find((node) => node.className === className && node.enabled) ?? null;
}

async function waitForNode(
  serial: string,
  labels: string[],
  timeoutMs = 20000,
  opts: { exact?: boolean; className?: string } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const nodes = dumpUi(serial);
      const node = findNodeByLabel(nodes, labels, opts);
      if (node) {
        return node;
      }
    } catch {
      // UI dump can briefly fail while Android is redrawing; retry.
    }

    await sleep(500);
  }

  fail(`Timed out waiting for any of: ${labels.join(', ')}`);
}

async function waitForClass(serial: string, className: string, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const nodes = dumpUi(serial);
      const node = findFirstByClass(nodes, className);
      if (node) {
        return node;
      }
    } catch {
      // Retry on transient dump failures.
    }

    await sleep(500);
  }

  fail(`Timed out waiting for class ${className}`);
}

async function tapLabel(serial: string, labels: string[], timeoutMs = 15000): Promise<void> {
  const node = await waitForNode(serial, labels, timeoutMs);
  const { x, y } = centerOf(node);
  tap(serial, x, y);
}

function capture(serial: string, screenshot: (typeof SCREENSHOTS)[number]): void {
  const targetPath = path.join(OUTPUT_DIR, screenshot.file);
  const png = adb(serial, ['exec-out', 'screencap', '-p'], { binary: true });
  fs.writeFileSync(targetPath, png);
  console.log(`${screenshot.name} -> ${targetPath}`);
}

async function openAnchorDetailFromVault(serial: string, device: { width: number; height: number }) {
  // Use the anchor intention first because it is the most stable label on the
  // hero card. If that misses, fall back to the hero-card area itself.
  try {
    await tapLabel(serial, [INTENTION], 6000);
  } catch {
    tap(serial, device.width * 0.5, device.height * 0.43);
  }

  try {
    await waitForNode(serial, ['Thread Strength', 'ANCHOR DETAILS'], 12000);
  } catch {
    // One more attempt against the hero card if the first tap landed on a
    // non-pressable child.
    tap(serial, device.width * 0.5, device.height * 0.43);
    await waitForNode(serial, ['Thread Strength', 'ANCHOR DETAILS'], 12000);
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const serial = resolveSerial();
  ensureInstalled(serial);
  ensureWritableAppStorage(serial);
  const device = ensureTargetResolution(serial);

  // Reset the app into a clean dev-master state so the run starts on the live
  // `VaultScreen` empty state without touching any production routes.
  forceStop(serial);
  clearAppData(serial);
  seedDevelopmentState(serial);

  launchApp(serial);

  // 1. VaultScreen — empty state.
  await waitForNode(serial, ['FORGE YOUR FIRST ANCHOR', 'SANCTUARY'], 30000);
  await sleep(1200);
  capture(serial, SCREENSHOTS[0]);

  // 2. IntentionInputScreen — prefill the requested intention.
  await tapLabel(serial, ['FORGE YOUR FIRST ANCHOR'], 10000);
  await waitForNode(serial, ['What are you anchoring right now?', 'Continue'], 15000);
  const input = await waitForClass(serial, 'android.widget.EditText', 15000);
  const inputCenter = centerOf(input);
  tap(serial, inputCenter.x, inputCenter.y);
  await sleep(400);
  inputText(serial, INTENTION);
  tap(serial, device.width * 0.5, device.height * 0.18);
  await sleep(900);
  capture(serial, SCREENSHOTS[1]);

  // 3. LetterDistillationScreen — wait into the middle of the live animation
  // sequence so we avoid the loading / initial typing frames.
  await tapLabel(serial, ['Continue'], 10000);
  await waitForNode(
    serial,
    ['YOUR INTENTION', 'UNIQUE LETTERS', 'CONSONANTS REMAIN', 'THE SEED LETTERS', 'FORGING'],
    15000
  );
  await sleep(4300);
  capture(serial, SCREENSHOTS[2]);

  // 4. StructureForgeScreen (requested "SigilSelection") — select the middle
  // contained variant and capture the gold-selected state.
  await waitForNode(serial, ['Contained', 'Available Structures', 'Choose Your'], 15000);
  await tapLabel(serial, ['Contained'], 10000);
  await sleep(500);
  capture(serial, SCREENSHOTS[3]);

  // 5. ManualReinforcementScreen — draw three strokes so the current fidelity
  // lands around the requested 40% range before capture.
  await tapLabel(serial, ['Begin Forging'], 10000);
  await waitForNode(serial, ['Lock Structure', 'Continue without tracing'], 15000);
  await sleep(900);
  swipe(serial, device.width * 0.28, device.height * 0.33, device.width * 0.72, device.height * 0.58, 280);
  await sleep(250);
  swipe(serial, device.width * 0.72, device.height * 0.33, device.width * 0.28, device.height * 0.58, 280);
  await sleep(250);
  swipe(serial, device.width * 0.30, device.height * 0.46, device.width * 0.70, device.height * 0.46, 280);
  await sleep(800);
  capture(serial, SCREENSHOTS[4]);

  // Finish the forge flow without editing the app so the anchor is persisted
  // and available for the later ambient / thread-strength captures.
  await tapLabel(serial, ['Lock Structure'], 10000);
  await waitForNode(serial, ['Choose Expression', 'Keep as Forged'], 15000);
  await tapLabel(serial, ['Keep as Forged'], 10000);
  await waitForNode(serial, ['Your Anchor', 'BEGIN PRIMING'], 15000);
  await tapLabel(serial, ['Begin Priming', 'BEGIN PRIMING'], 10000);
  await waitForNode(serial, ['Maybe later', 'SET AS WALLPAPER'], 20000);
  await tapLabel(serial, ['Maybe later'], 10000);

  // 6. ChargeSetupScreen (requested "SanctuaryScreen") — this is the current
  // deep-purple ambient prime surface in the app.
  await waitForNode(serial, ['Prime Your Anchor', 'Quick Prime', 'Deep Prime'], 20000);
  await sleep(1800);
  capture(serial, SCREENSHOTS[5]);

  // 7. AnchorDetailScreen (requested "Profile/Settings Thread Strength") —
  // back to Vault, then open the new anchor and capture the thread card.
  pressBack(serial);
  await waitForNode(serial, [INTENTION, 'SANCTUARY', 'CURRENT ANCHOR'], 20000);
  await sleep(1200);
  await openAnchorDetailFromVault(serial, device);
  await sleep(1200);
  capture(serial, SCREENSHOTS[6]);

  // 8. PaywallScreen — swap only persisted dev state, relaunch, and wait until
  // the expired-trial paywall is the active root overlay.
  forceStop(serial);
  seedExpiredPaywallState(serial);
  removeAsyncStorageEntry(serial, 'anchor:dev:masterAccount');
  launchApp(serial);
  await waitForNode(serial, ['Forge Free for 7 Days', 'Monthly', 'BEST VALUE'], 25000);
  await sleep(1500);
  capture(serial, SCREENSHOTS[7]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
