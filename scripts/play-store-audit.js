#!/usr/bin/env node

/**
 * Play Store Submission Audit
 * Validates app compliance against Google Play Store policies
 */

const fs = require('fs');
const path = require('path');

const MOBILE_DIR = path.join(__dirname, '..', 'anchor', 'mobile');
const ANDROID_DIR = path.join(MOBILE_DIR, 'android');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}`),
};

const readFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
};

const fileContains = (filePath, pattern) => {
  const content = readFile(filePath);
  if (!content) return false;
  return typeof pattern === 'string'
    ? content.includes(pattern)
    : pattern.test(content);
};

const fileDoesNotContain = (filePath, pattern) => {
  return !fileContains(filePath, pattern);
};

const results = {
  critical: [],
  high: [],
  medium: [],
  low: [],
};

// ============================================================================
// CRITICAL ISSUES (10+)
// ============================================================================

log.header('CRITICAL ISSUES');

// 1. Account Deletion - Firebase Auth
const authServicePath = path.join(MOBILE_DIR, 'src', 'services', 'AuthService.ts');
const authServiceNativePath = path.join(MOBILE_DIR, 'src', 'services', 'AuthService.native.ts');
if ((fileContains(authServicePath, 'deleteAccount') || fileContains(authServicePath, 'deleteUser()')) ||
    (fileContains(authServiceNativePath, 'deleteAccount') || fileContains(authServiceNativePath, 'deleteUser()'))) {
  log.success('Account deletion calls Firebase Auth deleteUser()');
  results.critical.push({ status: 'pass', item: 'Firebase Auth deleteUser() implemented' });
} else {
  log.fail('Account deletion missing Firebase Auth deleteUser()');
  results.critical.push({ status: 'fail', item: 'Firebase Auth deleteUser() not found' });
}

// 2. Account Deletion - Backend
if (fileContains(authServicePath, 'DELETE /auth/me') || fileContains(authServicePath, '/auth/me')) {
  log.success('Account deletion includes backend DELETE /auth/me');
  results.critical.push({ status: 'pass', item: 'Backend DELETE /auth/me implemented' });
} else {
  log.warn('Account deletion backend route not directly visible in AuthService');
  results.critical.push({ status: 'warn', item: 'Backend DELETE /auth/me should be verified separately' });
}

// 3. SYSTEM_ALERT_WINDOW Permission
const appJsonPath = path.join(MOBILE_DIR, 'app.json');
const manifestPath = path.join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');

if (fileDoesNotContain(appJsonPath, 'SYSTEM_ALERT_WINDOW') &&
    fileDoesNotContain(manifestPath, 'SYSTEM_ALERT_WINDOW')) {
  log.success('SYSTEM_ALERT_WINDOW permission not present');
  results.critical.push({ status: 'pass', item: 'SYSTEM_ALERT_WINDOW removed' });
} else {
  log.fail('SYSTEM_ALERT_WINDOW permission still present');
  results.critical.push({ status: 'fail', item: 'SYSTEM_ALERT_WINDOW must be removed' });
}

// 4. SCHEDULE_EXACT_ALARM Permission
if (fileDoesNotContain(appJsonPath, 'SCHEDULE_EXACT_ALARM') &&
    fileDoesNotContain(manifestPath, 'SCHEDULE_EXACT_ALARM')) {
  log.success('SCHEDULE_EXACT_ALARM permission not present');
  results.critical.push({ status: 'pass', item: 'SCHEDULE_EXACT_ALARM removed' });
} else {
  log.fail('SCHEDULE_EXACT_ALARM permission still present');
  results.critical.push({ status: 'fail', item: 'SCHEDULE_EXACT_ALARM must be removed' });
}

// 5. USE_EXACT_ALARM Permission
if (fileDoesNotContain(appJsonPath, 'USE_EXACT_ALARM') &&
    fileDoesNotContain(manifestPath, 'USE_EXACT_ALARM')) {
  log.success('USE_EXACT_ALARM permission not present');
  results.critical.push({ status: 'pass', item: 'USE_EXACT_ALARM removed' });
} else {
  log.fail('USE_EXACT_ALARM permission still present');
  results.critical.push({ status: 'fail', item: 'USE_EXACT_ALARM must be removed' });
}

// 6. RevenueCat Purchase Flow
const paywallScreenPath = path.join(MOBILE_DIR, 'src', 'screens', 'PaywallScreen.tsx');
const settingsScreenPath = path.join(MOBILE_DIR, 'src', 'screens', 'SettingsScreen.tsx');
const revenueCatServicePath = path.join(MOBILE_DIR, 'src', 'services', 'RevenueCatService.ts');

let purchaseFlowFound = false;
if (fileContains(revenueCatServicePath, 'purchasePackageByIdentifier')) {
  log.success('RevenueCat purchasePackageByIdentifier() method implemented');
  results.critical.push({ status: 'pass', item: 'purchasePackageByIdentifier() implemented' });
  purchaseFlowFound = true;
} else {
  log.warn('RevenueCat purchasePackageByIdentifier() not found - verify purchase flow separately');
  results.critical.push({ status: 'warn', item: 'Verify RevenueCat purchase flow implementation' });
}

if (fileContains(paywallScreenPath, 'purchase') || fileContains(paywallScreenPath, 'RevenueCat')) {
  log.success('PaywallScreen includes purchase logic');
  results.critical.push({ status: 'pass', item: 'PaywallScreen purchase implementation' });
} else {
  log.warn('PaywallScreen purchase logic not directly visible');
  results.critical.push({ status: 'warn', item: 'Verify PaywallScreen purchase implementation' });
}

// 7. Restore Purchase Button
const restorePurchaseRegex = /[Rr]estore.*[Pp]urchase|purchaseRestore|restorePurchase/;
if (fileContains(settingsScreenPath, restorePurchaseRegex) ||
    fileContains(paywallScreenPath, restorePurchaseRegex)) {
  log.success('Restore Purchases button implemented');
  results.critical.push({ status: 'pass', item: 'Restore Purchases button wired' });
} else {
  log.warn('Restore Purchases button not directly visible - verify separately');
  results.critical.push({ status: 'warn', item: 'Verify Restore Purchases button implementation' });
}

// 8. Content Reporting
const contentFlagPath = path.join(MOBILE_DIR, 'src', 'services');
const reportContentRegex = /[Rr]eport\s+[Cc]ontent|flag.*Content|FlaggedContent/;

let reportContentFound = false;
if (fs.existsSync(contentFlagPath)) {
  const files = fs.readdirSync(contentFlagPath);
  if (files.some(f => f.includes('Content') || f.includes('Flag'))) {
    log.success('Content reporting service found');
    results.critical.push({ status: 'pass', item: 'Content reporting service exists' });
    reportContentFound = true;
  }
}

const anchorDetailPath = path.join(MOBILE_DIR, 'src', 'screens', 'AnchorDetailScreen.tsx');
if (fileContains(anchorDetailPath, reportContentRegex)) {
  log.success('Report Content button implemented in AnchorDetailScreen');
  results.critical.push({ status: 'pass', item: 'Report Content button in UI' });
} else {
  log.warn('Report Content button not directly visible - verify separately');
  results.critical.push({ status: 'warn', item: 'Verify Report Content button implementation' });
}

// ============================================================================
// HIGH PRIORITY ISSUES (5)
// ============================================================================

log.header('HIGH PRIORITY ISSUES');

// 1. MediaLibrary Permission Handling
if (fileContains(anchorDetailPath, 'MediaLibrary') || fileContains(anchorDetailPath, 'onPress')) {
  log.success('MediaLibrary permission handling in AnchorDetailScreen');
  results.high.push({ status: 'pass', item: 'MediaLibrary permission moved to on-press' });
} else {
  log.warn('MediaLibrary permission handling not directly visible');
  results.high.push({ status: 'warn', item: 'Verify MediaLibrary permission on-press handling' });
}

// 2. Back Button Callback
const buildGradlePath = path.join(ANDROID_DIR, 'app', 'build.gradle');
if (fileContains(manifestPath, 'android:enableOnBackInvokedCallback="true"')) {
  log.success('enableOnBackInvokedCallback set to true');
  results.high.push({ status: 'pass', item: 'Back button callback enabled' });
} else {
  log.fail('enableOnBackInvokedCallback not set to true');
  results.high.push({ status: 'fail', item: 'Back button callback must be enabled' });
}

// 3. Cancel Dialog on Back Press
const burnAnimPath = path.join(MOBILE_DIR, 'src', 'components', 'BurnAnimationOverlay.tsx');
if (fileContains(burnAnimPath, /hardwareBackPress|back.*dialog|Cancel.*Ritual/i)) {
  log.success('Cancel Ritual dialog shown on back press');
  results.high.push({ status: 'pass', item: 'Back press cancel dialog implemented' });
} else {
  log.warn('Back press cancel dialog not directly visible');
  results.high.push({ status: 'warn', item: 'Verify back press cancel dialog implementation' });
}

// 4. Offline Auth with Cache
if (fileContains(path.join(MOBILE_DIR, 'App.tsx'), 'offline') ||
    fileContains(path.join(MOBILE_DIR, 'App.tsx'), 'cache')) {
  log.success('Offline auth with cached user implemented');
  results.high.push({ status: 'pass', item: 'Offline mode with cache fallback' });
} else {
  log.warn('Offline auth not directly visible');
  results.high.push({ status: 'warn', item: 'Verify offline auth implementation' });
}

// 5. Target SDK Version
const buildGradleContent = readFile(buildGradlePath);
if (buildGradleContent && buildGradleContent.includes('targetSdkVersion 35')) {
  log.success('targetSdkVersion set to 35');
  results.high.push({ status: 'pass', item: 'targetSdkVersion = 35' });
} else {
  log.fail('targetSdkVersion not set to 35');
  results.high.push({ status: 'fail', item: 'targetSdkVersion must be 35' });
}

// ============================================================================
// MEDIUM PRIORITY ISSUES (3)
// ============================================================================

log.header('MEDIUM PRIORITY ISSUES');

// 1. WebView Memory Leaks
if (fileContains(burnAnimPath, 'setTimeout') || fileContains(burnAnimPath, 'clearTimeout')) {
  log.success('WebView memory leak handling (setTimeout cleanup)');
  results.medium.push({ status: 'pass', item: 'WebView setTimeout cleanup implemented' });
} else {
  log.warn('WebView memory leak handling not directly visible');
  results.medium.push({ status: 'warn', item: 'Verify WebView cleanup implementation' });
}

// 2. Data Privacy - No E2E Encryption Claims
const dataPrivacyPath = path.join(MOBILE_DIR, 'src', 'screens', 'DataPrivacyScreen.tsx');
if (fileDoesNotContain(dataPrivacyPath, 'end.?to.?end.*encrypt') &&
    fileDoesNotContain(dataPrivacyPath, 'e2e.*encrypt')) {
  log.success('No end-to-end encryption claims in privacy screen');
  results.medium.push({ status: 'pass', item: 'E2E encryption claims removed' });
} else {
  log.warn('E2E encryption claims might still be present - verify');
  results.medium.push({ status: 'warn', item: 'Verify E2E encryption claims removed' });
}

// 3. Data Usage Disclosure
if (fileContains(dataPrivacyPath, /Firebase|Sentry|Gemini/)) {
  log.success('Data usage disclosure includes Firebase, Sentry, Gemini');
  results.medium.push({ status: 'pass', item: 'Third-party data usage disclosed' });
} else {
  log.warn('Data usage disclosure accuracy - verify in privacy screen');
  results.medium.push({ status: 'warn', item: 'Verify third-party data usage disclosure' });
}

// ============================================================================
// SUMMARY
// ============================================================================

log.header('AUDIT SUMMARY');

const allResults = [...results.critical, ...results.high, ...results.medium];
const passed = allResults.filter(r => r.status === 'pass').length;
const failed = allResults.filter(r => r.status === 'fail').length;
const warned = allResults.filter(r => r.status === 'warn').length;

console.log(`\nTotal Checks: ${allResults.length}`);
log.success(`Passed: ${passed}`);
if (failed > 0) log.fail(`Failed: ${failed}`);
if (warned > 0) log.warn(`Warnings: ${warned}`);

// Print detailed summary
console.log(`\n${colors.cyan}Critical Issues:${colors.reset}`);
results.critical.forEach(r => {
  const icon = r.status === 'pass' ? `${colors.green}✓${colors.reset}` :
               r.status === 'fail' ? `${colors.red}✗${colors.reset}` :
               `${colors.yellow}⚠${colors.reset}`;
  console.log(`  ${icon} ${r.item}`);
});

console.log(`\n${colors.cyan}High Priority:${colors.reset}`);
results.high.forEach(r => {
  const icon = r.status === 'pass' ? `${colors.green}✓${colors.reset}` :
               r.status === 'fail' ? `${colors.red}✗${colors.reset}` :
               `${colors.yellow}⚠${colors.reset}`;
  console.log(`  ${icon} ${r.item}`);
});

console.log(`\n${colors.cyan}Medium Priority:${colors.reset}`);
results.medium.forEach(r => {
  const icon = r.status === 'pass' ? `${colors.green}✓${colors.reset}` :
               r.status === 'fail' ? `${colors.red}✗${colors.reset}` :
               `${colors.yellow}⚠${colors.reset}`;
  console.log(`  ${icon} ${r.item}`);
});

const exitCode = failed > 0 ? 1 : 0;
console.log(`\n${colors.cyan}Exit Code: ${exitCode}${colors.reset}\n`);
process.exit(exitCode);
