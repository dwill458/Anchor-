'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { EXPECTED_PROJECT_ID, EXPECTED_APPLICATION_ID } = require('./diagnostic-config.cjs');

const secondary = process.argv.slice(2);
if (secondary.length > 1 || (secondary.length === 1 && !['--secondary', '--comped'].includes(secondary[0]))) {
  throw new Error('Usage: node setup-synthetic-account.cjs [--secondary|--comped]');
}
const accountMode = secondary[0] || 'free-primary';
const UID = accountMode === '--secondary'
  ? 'synthetic-account-b'
  : accountMode === '--comped'
    ? 'synthetic-account-c'
    : 'synthetic-account';
const EMULATOR_HOST = '127.0.0.1:9099';
const CREDENTIAL_DIR = path.join(os.tmpdir(), 'anchor-perf-release-20261012-auth-fixture');
const credentialName = accountMode === '--secondary'
  ? 'synthetic-account-b.credentials.json'
  : accountMode === '--comped'
    ? 'synthetic-account-c.credentials.json'
    : 'synthetic-account.credentials.json';
const CREDENTIAL_PATH = path.join(CREDENTIAL_DIR, credentialName);

async function main() {
  const tmpRoot = path.resolve(os.tmpdir());
  const resolvedDir = path.resolve(CREDENTIAL_DIR);
  if (!resolvedDir.startsWith(`${tmpRoot}${path.sep}`)) {
    throw new Error('Credential path escaped the task TEMP directory.');
  }
  if (fs.existsSync(CREDENTIAL_PATH)) {
    throw new Error('Synthetic account credential file already exists; refusing overwrite.');
  }

  process.env.FIREBASE_AUTH_EMULATOR_HOST = EMULATOR_HOST;
  process.env.GCLOUD_PROJECT = EXPECTED_PROJECT_ID;
  process.env.GOOGLE_CLOUD_PROJECT = EXPECTED_PROJECT_ID;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
  process.env.FIREBASE_TOKEN = '';
  const repoRoot = path.resolve(__dirname, '..', '..', '..', '..');
  const requireFromBackend = createRequire(path.join(repoRoot, 'backend', 'package.json'));
  const admin = requireFromBackend('firebase-admin');
  const app = admin.initializeApp(
    { projectId: EXPECTED_PROJECT_ID },
    `anchor-perf-account-setup-${process.pid}`,
  );
  const auth = app.auth();

  try {
    await auth.getUser(UID);
    throw new Error('Synthetic UID already exists in the Auth Emulator; refusing reset or overwrite.');
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
  }

  const email = `anchor-perf-${crypto.randomUUID()}@example.invalid`;
  const password = `T-${crypto.randomBytes(24).toString('base64url')}!9`;
  const credential = {
    projectId: EXPECTED_PROJECT_ID,
    authEmulatorHost: EMULATOR_HOST,
    applicationId: EXPECTED_APPLICATION_ID,
    uid: UID,
    email,
    password,
  };

  fs.mkdirSync(CREDENTIAL_DIR, { recursive: true, mode: 0o700 });
  const fd = fs.openSync(CREDENTIAL_PATH, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(credential, null, 2), 'utf8');
  } finally {
    fs.closeSync(fd);
  }

  try {
    const user = await auth.createUser({ uid: UID, email, password, emailVerified: false });
    if (user.uid !== UID) throw new Error('Auth Emulator returned an unexpected UID.');
    await auth.setCustomUserClaims(UID, {
      anchorPerfOnboarded: true,
      ...(accountMode === '--comped' ? { anchorPerfComped: true } : {}),
    });
    const verified = await auth.getUser(UID);
    if (verified.customClaims?.anchorPerfOnboarded !== true) {
      throw new Error('Auth Emulator did not retain the expected synthetic onboarding claim.');
    }
    if ((verified.customClaims?.anchorPerfComped === true) !== (accountMode === '--comped')) {
      throw new Error('Auth Emulator did not retain the expected synthetic comped claim.');
    }
  } catch {
    process.stderr.write('Synthetic account setup did not complete; no credentials were printed. Inspect local emulator status before recovery.\n');
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Created local demo account UID=${UID}; credentials saved to TEMP: ${CREDENTIAL_PATH}\n`);
}

main().catch(() => {
  process.stderr.write('Synthetic account setup failed; details and credentials were withheld.\n');
  process.exitCode = 1;
});
