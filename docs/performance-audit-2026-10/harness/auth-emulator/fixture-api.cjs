'use strict';

const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');
const { createRequire } = require('node:module');
const zlib = require('node:zlib');
const {
  EXPECTED_PROJECT_ID,
  EXPECTED_API_URL,
  validateDiagnosticConfig,
} = require('./diagnostic-config.cjs');
const motionReadFixtures = require('../diagnostic-src/motion-read-fixtures.json');

const HOST = '127.0.0.1';
const PORT = 39999;
const MAX_BODY_BYTES = 16 * 1024;
const ALLOWED_MODES = new Set(['deep_prime', 'visualize', 'focus', 'release']);
const ALLOWED_PROVIDERS = new Set(['email']);
const SYNTHETIC_COMPED_UID = 'synthetic-account-c';
const ALLOWED_SYNTHETIC_UIDS = new Set(['synthetic-account', 'synthetic-account-b', SYNTHETIC_COMPED_UID]);
const SYNTHETIC_FIXTURE_INTENTION = 'I build a synthetic test routine';
const SYNTHETIC_DEFAULT_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
const SYNTHETIC_MOTION_ASSETS = new Map([
  ['vision-future-desk.jpg', path.resolve(__dirname, '..', '..', '..', '..', 'anchor', 'mobile', 'src', 'assets', 'vision', 'vision-future-desk.jpg')],
  ['vision-future-window.jpg', path.resolve(__dirname, '..', '..', '..', '..', 'anchor', 'mobile', 'src', 'assets', 'vision', 'vision-future-window.jpg')],
  ['vision-future-family.jpg', path.resolve(__dirname, '..', '..', '..', '..', 'anchor', 'mobile', 'src', 'assets', 'vision', 'vision-future-family.jpg')],
]);
const SYNTHETIC_CATEGORIES = ['desire', 'health', 'career', 'creativity'];

function makeDeterministicUuid(uid, sequence) {
  const digest = crypto.createHash('sha256').update(`${uid}:${sequence}`).digest('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function buildDefaultUserSettings(uid, timestampIso) {
  return {
    id: `settings-${uid}`,
    userId: uid,
    primaryPracticeMode: 'focus',
    defaultChargeDuration: 300,
    QuickFocusDurationSeconds: 60,
    deepPrimeDurationSeconds: 180,
    focusSessionMode: 'quick',
    focusSessionDuration: 60,
    focusSessionAudio: 'ambient',
    primeSessionDuration: 180,
    primeSessionAudio: 'ambient',
    sessionAudioDefaults: {
      focus: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      deep_prime: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
      visualize: { guidanceVoice: 'female', backgroundAudio: 'ambient' },
    },
    hapticIntensity: 70,
    practiceGuidanceEnabled: true,
    vaultViewType: 'grid',
    dailyReminderEnabled: false,
    dailyReminderTime: '09:00',
    streakProtection: true,
    weeklyReportEnabled: false,
    ReduceMotionOverride: null,
    theme: 'zen_architect',
    selectedVaultBackground: 'obsidian',
    unlockedThemes: ['zen_architect'],
    unlockedBackgrounds: ['obsidian'],
    updatedAt: timestampIso,
  };
}

function serializeUserRecord(userRecord) {
  const trialEndsAt = new Date(Date.parse(userRecord.createdAt) + 7 * 86400000).toISOString();
  return {
    id: userRecord.id,
    email: userRecord.email,
    displayName: userRecord.displayName,
    authProvider: 'email',
    hasCompletedOnboarding: userRecord.hasCompletedOnboarding,
    isComped: userRecord.isComped,
    subscriptionStatus: userRecord.subscriptionStatus,
    totalAnchorsCreated: userRecord.totalAnchorsCreated,
    freeAnchorConsumed: userRecord.totalAnchorsCreated >= 1,
    totalActivations: userRecord.totalActivations,
    currentStreak: userRecord.currentStreak,
    longestStreak: userRecord.longestStreak,
    stabilizesTotal: userRecord.stabilizesTotal,
    stabilizeStreakDays: userRecord.stabilizeStreakDays,
    lastStabilizeAt: userRecord.lastStabilizeAt,
    createdAt: userRecord.createdAt,
    trialStartedAt: userRecord.createdAt,
    trialConsumedAt: userRecord.createdAt,
    trialDurationDays: 7,
    trialEndsAt,
    isTrialActive: false,
    isTrialExpired: true,
    daysRemainingInTrial: 0,
    hasUsedTrial: true,
    requiresSubscription: !userRecord.isComped && userRecord.subscriptionStatus === 'free',
    legacyMigrationAccess: false,
  };
}

function serializeAnchorForList(anchor) {
  return {
    id: anchor.id,
    userId: anchor.userId,
    intentionText: anchor.intentionText,
    category: anchor.category,
    distilledLetters: anchor.distilledLetters,
    baseSigilSvg: anchor.baseSigilSvg,
    enhancedImageUrl: anchor.enhancedImageUrl,
    structureVariant: anchor.structureVariant,
    isCharged: anchor.isCharged,
    chargedAt: anchor.chargedAt,
    firstChargedAt: anchor.firstChargedAt,
    ignitedAt: anchor.ignitedAt,
    activationCount: anchor.activationCount,
    chargeCount: anchor.chargeCount,
    lastActivatedAt: anchor.lastActivatedAt,
    isReleased: anchor.isArchived === true,
    isArchived: anchor.isArchived === true,
    releasedAt: anchor.releasedAt,
    archivedAt: anchor.archivedAt,
    createdAt: anchor.createdAt,
    updatedAt: anchor.updatedAt,
  };
}

function buildMotionFixture(kind, anchorId) {
  const index = Number(anchorId.slice(-3)) - 1;
  const intentionText = `Synthetic intention fixture ${anchorId.slice(-3)}; no real user writing.`;
  const category = SYNTHETIC_CATEGORIES[index % SYNTHETIC_CATEGORIES.length];
  const serialized = JSON.stringify(kind === 'vision' ? motionReadFixtures.vision : motionReadFixtures.chart)
    .replaceAll('__ANCHOR_ID__', anchorId)
    .replaceAll('__INTENTION_TEXT__', intentionText)
    .replaceAll('__CATEGORY__', category);
  return JSON.parse(serialized);
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function createSyntheticAnchorPng() {
  const side = 192;
  const rows = Buffer.alloc((side * 4 + 1) * side);
  const drawLine = (x, y, x1, y1, x2, y2, width, color) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
    const px = x1 + ratio * dx;
    const py = y1 + ratio * dy;
    return (x - px) ** 2 + (y - py) ** 2 <= (width / 2) ** 2 ? color : null;
  };
  const lineSegments = [
    { a: [96, 34], b: [96, 158], w: 8, c: [40, 65, 78, 255] },
    { a: [57, 58], b: [135, 58], w: 6, c: [173, 133, 82, 255] },
    { a: [57, 134], b: [135, 134], w: 6, c: [173, 133, 82, 255] },
    { a: [57, 58], b: [135, 134], w: 5, c: [93, 125, 132, 255] },
  ];
  const ring = { x: 96, y: 96, radius: 66, width: 4 };
  for (let y = 0; y < side; y += 1) {
    const rowStart = y * (side * 4 + 1);
    rows[rowStart] = 0;
    for (let x = 0; x < side; x += 1) {
      let color = null;
      const radius = Math.hypot(x - ring.x, y - ring.y);
      if (Math.abs(radius - ring.radius) <= ring.width / 2) color = [182, 145, 92, 255];
      for (const segment of lineSegments) {
        color = drawLine(x + 0.5, y + 0.5, ...segment.a, ...segment.b, segment.w, segment.c) || color;
      }
      if (color) {
        const offset = rowStart + 1 + x * 4;
        rows.set(color, offset);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const syntheticAnchorPng = createSyntheticAnchorPng();

function validateEmulatorClaims(decoded, expectedProjectId = EXPECTED_PROJECT_ID) {
  if (!decoded || typeof decoded !== 'object') return false;
  const uid = typeof decoded.uid === 'string' ? decoded.uid : decoded.sub;
  return (
    decoded.aud === expectedProjectId &&
    decoded.iss === `https://securetoken.google.com/${expectedProjectId}` &&
    typeof uid === 'string' && uid.length > 0 && uid.length <= 128 &&
    decoded.sub === uid
  );
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('body too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('invalid body'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const encoded = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': encoded.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Connection': 'close',
  });
  res.end(encoded);
}

function sendSyntheticImage(res) {
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': syntheticAnchorPng.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Connection': 'close',
  });
  res.end(syntheticAnchorPng);
}

function sendMotionAsset(res, assetPath) {
  const image = require('node:fs').readFileSync(assetPath);
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': image.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Connection': 'close',
  });
  res.end(image);
}

function getLoopbackBaseUrl(server) {
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== HOST) {
    throw new Error('Fixture API must bind its exact loopback address.');
  }
  return `http://${HOST}:${address.port}`;
}

function createFixtureServer({ verifyIdToken, projectId = EXPECTED_PROJECT_ID }) {
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error('Fixture project ID must remain the fixed demo project.');
  }
  if (typeof verifyIdToken !== 'function') {
    throw new Error('A Firebase Admin ID-token verifier is required.');
  }

  const users = new Map();
  const anchorsByUser = new Map();
  const activationsByUser = new Map();
  const chargesByUser = new Map();
  const anchorCreateByIdempotencyKey = new Map();
  const idempotencyResults = new Map();
  const sessions = new Map();

  function getOrCreateUserRecord(decoded, overrides = {}) {
    const uid = decoded.uid || decoded.sub;
    const existing = users.get(uid);
    const epochIso = new Date(0).toISOString();
    const isComped = uid === SYNTHETIC_COMPED_UID && decoded.anchorPerfComped === true;
    const hasCompletedOnboarding = Boolean(
      (existing && existing.hasCompletedOnboarding === true) ||
      decoded.anchorPerfOnboarded === true
    );
    const record = existing
      ? {
          ...existing,
          email: typeof decoded.email === 'string' ? decoded.email : existing.email,
          displayName:
            typeof overrides.displayName === 'string'
              ? overrides.displayName.slice(0, 80)
              : existing.displayName,
          hasCompletedOnboarding,
          isComped,
        }
      : {
          id: uid,
          email: typeof decoded.email === 'string' ? decoded.email : null,
          displayName:
            typeof overrides.displayName === 'string'
              ? overrides.displayName.slice(0, 80)
              : null,
          hasCompletedOnboarding,
          isComped,
          subscriptionStatus: 'free',
          totalAnchorsCreated: 0,
          totalActivations: 0,
          currentStreak: 0,
          longestStreak: 0,
          stabilizesTotal: 0,
          stabilizeStreakDays: 0,
          lastStabilizeAt: null,
          notificationState: null,
          createdAt: epochIso,
          updatedAt: epochIso,
          settings: buildDefaultUserSettings(uid, epochIso),
        };
    users.set(uid, record);
    if (!anchorsByUser.has(uid)) anchorsByUser.set(uid, new Map());
    if (!activationsByUser.has(uid)) activationsByUser.set(uid, []);
    if (!chargesByUser.has(uid)) chargesByUser.set(uid, []);
    return record;
  }

  async function authenticate(req) {
    const authorization = req.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
    const token = authorization.slice('Bearer '.length);
    if (!token || token.length > 8192) return null;
    try {
      const decoded = await verifyIdToken(token);
      return validateEmulatorClaims(decoded, projectId) ? decoded : null;
    } catch {
      return null;
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        return send(res, 200, { success: true, data: { status: 'fixture-only' } });
      }
      if (req.method === 'GET' && url.pathname === '/__fixture/stats') {
        return send(res, 200, { success: true, data: { userCount: users.size, sessionCount: sessions.size } });
      }

      if (req.method === 'GET' && url.pathname === '/__fixture/synthetic-anchor.png' && !url.search) {
        return sendSyntheticImage(res);
      }

      const motionAsset = req.method === 'GET' && !url.search
        ? /^\/perf-assets\/(vision-future-(?:desk|window|family)\.jpg)$/.exec(url.pathname)
        : null;
      if (motionAsset) return sendMotionAsset(res, SYNTHETIC_MOTION_ASSETS.get(motionAsset[1]));

      const motionRead = req.method === 'GET' && !url.search
        ? /^\/api\/v2\/anchors\/(synthetic-anchor-\d{3})\/(vision|chart)$/.exec(url.pathname)
        : null;
      if (motionRead) {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        if ((decoded.uid || decoded.sub) !== SYNTHETIC_COMPED_UID ||
            decoded.anchorPerfOnboarded !== true || decoded.anchorPerfComped !== true) {
          return send(res, 403, { success: false, error: 'Synthetic motion fixture account required' });
        }
        const index = Number(motionRead[1].slice(-3));
        if (index < 1 || index > 72) return send(res, 404, { success: false, error: 'Not found' });
        return send(res, 200, { success: true, data: buildMotionFixture(motionRead[2], motionRead[1]) });
      }

      if (req.method === 'POST' && url.pathname === '/api/ai/enhance') {
        let decoded = null;
        if (req.headers.authorization !== undefined) {
          decoded = await authenticate(req);
          if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
          const uid = decoded.uid || decoded.sub;
          const validSyntheticIdentity = ALLOWED_SYNTHETIC_UIDS.has(uid) &&
            decoded.anchorPerfOnboarded === true &&
            (uid !== SYNTHETIC_COMPED_UID || decoded.anchorPerfComped === true);
          if (!validSyntheticIdentity) {
            return send(res, 403, { success: false, error: 'Synthetic fixture account required' });
          }
        }

        const body = await readJson(req);
        const validSyntheticRequest = body && typeof body === 'object' &&
          typeof body.sigilSvg === 'string' && body.sigilSvg.length > 0 && body.sigilSvg.length <= 12_000 &&
          typeof body.styleChoice === 'string' && /^[a-z0-9_]{1,48}$/i.test(body.styleChoice) &&
          body.intentionText === SYNTHETIC_FIXTURE_INTENTION &&
          typeof body.anchorId === 'string' && /^temp-[a-z0-9-]{1,96}$/i.test(body.anchorId) &&
          body.provider === 'gemini' && body.tier === 'premium' &&
          Number.isInteger(body.generationAttempt) && body.generationAttempt >= 1 && body.generationAttempt <= 9;
        if (!validSyntheticRequest) return send(res, 422, { success: false, error: 'Synthetic fixture request required' });

        const baseUrl = getLoopbackBaseUrl(server);
        const imageUrl = `${baseUrl}/__fixture/synthetic-anchor.png`;
        return send(res, 200, {
          success: true,
          variations: [{
            variationId: 'synthetic-fixture-variation',
            imageUrl,
            classification: 'Synthetic fixture',
            wasComposited: false,
            seed: 0,
            reusedFromPool: false,
          }],
          variationUrls: [imageUrl],
          prompt: '',
          negativePrompt: '',
          generationTime: 0,
          model: 'synthetic-fixture',
          controlMethod: 'lineart',
          styleApplied: body.styleChoice,
          provider: 'local-fixture',
          bestVariationIndex: 0,
          passingCount: 1,
          reuseRequestId: 'synthetic-fixture-request',
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/auth/sync') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const body = await readJson(req);
        if (!body || typeof body !== 'object' || !ALLOWED_PROVIDERS.has(body.authProvider)) {
          return send(res, 422, { success: false, error: 'Invalid fixture request' });
        }
        const userRecord = getOrCreateUserRecord(decoded, {
          displayName: body.displayName,
        });
        return send(res, 200, {
          success: true,
          data: {
            id: userRecord.id,
            email: userRecord.email,
            displayName: userRecord.displayName,
            hasCompletedOnboarding: userRecord.hasCompletedOnboarding,
            isComped: userRecord.isComped,
            subscriptionStatus: userRecord.subscriptionStatus,
            totalAnchorsCreated: userRecord.totalAnchorsCreated,
            freeAnchorConsumed: userRecord.totalAnchorsCreated >= 1,
            totalActivations: userRecord.totalActivations,
            currentStreak: userRecord.currentStreak,
            longestStreak: userRecord.longestStreak,
            stabilizesTotal: userRecord.stabilizesTotal,
            stabilizeStreakDays: userRecord.stabilizeStreakDays,
            createdAt: userRecord.createdAt,
          },
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const userRecord = getOrCreateUserRecord(decoded);
        return send(res, 200, {
          success: true,
          data: {
            ...serializeUserRecord(userRecord),
            settings: userRecord.settings,
            chartFlags: {
              chartMasterEnabled: true,
              chartHomeEntryEnabled: true,
              chartPostPracticeReflectionEnabled: true,
              chartReleaseContinuationEnabled: true,
              chartAutoSingleAnchorSelectEnabled: true,
              chartFreeWaypointLimit: 3,
            },
          },
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/auth/me/export') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const userRecord = getOrCreateUserRecord(decoded);
        const uid = userRecord.id;
        const userAnchors = Array.from((anchorsByUser.get(uid) || new Map()).values()).map(serializeAnchorForList);
        const userActivations = activationsByUser.get(uid) || [];
        const userCharges = chargesByUser.get(uid) || [];
        const userPracticeSessions = Array.from(sessions.values())
          .filter((entry) => entry.uid === uid)
          .map((entry) => ({
            id: entry.id,
            anchorId: entry.anchorId || null,
            practiceMode: entry.practiceMode,
            completionStatus: 'completed',
            plannedDurationSeconds: entry.plannedDurationSeconds,
            completedDurationSeconds: entry.completedDurationSeconds,
            completedAt: entry.completedAt,
            localDateKey: entry.completedAt.slice(0, 10),
            timeOfDayBucket: 'morning',
            weekdayIndex: 0,
            completionSource: 'manual',
            schemaVersion: 2,
          }));
        return send(res, 200, {
          success: true,
          data: {
            exportVersion: 4,
            exportedAt: new Date().toISOString(),
            account: {
              id: uid,
              email: userRecord.email,
              displayName: userRecord.displayName,
              authProvider: 'email',
              authUid: uid,
              isComped: userRecord.isComped,
              subscriptionStatus: userRecord.subscriptionStatus,
              subscriptionId: null,
              createdAt: userRecord.createdAt,
              updatedAt: userRecord.updatedAt,
              lastSeenAt: userRecord.updatedAt,
              hasCompletedOnboarding: userRecord.hasCompletedOnboarding,
              totalAnchorsCreated: userRecord.totalAnchorsCreated,
              totalActivations: userRecord.totalActivations,
              currentStreak: userRecord.currentStreak,
              longestStreak: userRecord.longestStreak,
              stabilizesTotal: userRecord.stabilizesTotal,
              stabilizeStreakDays: userRecord.stabilizeStreakDays,
              lastStabilizeAt: userRecord.lastStabilizeAt,
              notificationState: userRecord.notificationState,
              expoPushToken: null,
              fcmToken: null,
              apnsToken: null,
              notificationsEnabled: true,
              chartSchemaVersion: 1,
              settings: userRecord.settings,
              anchors: userAnchors,
              activations: userActivations,
              charges: userCharges,
              practiceSessions: userPracticeSessions,
              visualizationScenes: [],
              orders: [],
              courses: [],
              waypoints: [],
              courseAnchorLinks: [],
              reflections: [],
              courseEvents: [],
            },
            burnedAnchors: [],
            flaggedContent: [],
            syncQueue: [],
          },
        });
      }

      if (req.method === 'PUT' && url.pathname === '/api/auth/onboarding-context') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        await readJson(req);
        const userRecord = getOrCreateUserRecord(decoded);
        userRecord.hasCompletedOnboarding = true;
        userRecord.updatedAt = new Date().toISOString();
        return send(res, 200, {
          success: true,
          data: {
            hasCompletedOnboarding: true,
          },
        });
      }

      if (req.method === 'PUT' && url.pathname === '/api/auth/notification-state') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const body = await readJson(req);
        const userRecord = getOrCreateUserRecord(decoded);
        userRecord.notificationState = body && typeof body === 'object' ? body : null;
        userRecord.updatedAt = new Date().toISOString();
        return send(res, 200, {
          success: true,
          data: {
            notificationState: userRecord.notificationState,
          },
        });
      }

      if (req.method === 'GET' && url.pathname === '/api/anchors') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const userRecord = getOrCreateUserRecord(decoded);
        const uid = userRecord.id;
        const userAnchorMap = anchorsByUser.get(uid) || new Map();
        const isChargedParam = url.searchParams.get('isCharged');
        const categoryParam = url.searchParams.get('category');
        const orderByParam = url.searchParams.get('orderBy') || 'updatedAt';
        const orderParam = (url.searchParams.get('order') || 'desc').toLowerCase() === 'asc' ? 1 : -1;
        const limitParam = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20) || 20));

        let filtered = Array.from(userAnchorMap.values()).filter((anchor) => !anchor.isArchived);
        if (isChargedParam === 'true') filtered = filtered.filter((anchor) => anchor.isCharged === true);
        if (isChargedParam === 'false') filtered = filtered.filter((anchor) => anchor.isCharged === false);
        if (categoryParam) filtered = filtered.filter((anchor) => anchor.category === categoryParam);

        filtered.sort((a, b) => {
          const left = Date.parse(a[orderByParam] || a.updatedAt || a.createdAt) || 0;
          const right = Date.parse(b[orderByParam] || b.updatedAt || b.createdAt) || 0;
          return (left - right) * orderParam;
        });

        const total = filtered.length;
        const page = filtered.slice(0, limitParam).map(serializeAnchorForList);
        return send(res, 200, {
          success: true,
          data: page,
          meta: {
            total,
            nextCursor: null,
          },
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/anchors') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const body = await readJson(req);
        if (
          !body ||
          typeof body !== 'object' ||
          typeof body.intentionText !== 'string' ||
          body.intentionText.trim().length === 0 ||
          body.intentionText.length > 500 ||
          /PRIVATE/i.test(body.intentionText)
        ) {
          return send(res, 422, { success: false, error: 'Invalid fixture request' });
        }

        const userRecord = getOrCreateUserRecord(decoded);
        const uid = userRecord.id;
        const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
          ? body.idempotencyKey
          : null;
        if (body.idempotencyKey !== undefined && (!idempotencyKey || idempotencyKey.length > 200)) {
          return send(res, 422, { success: false, error: 'Invalid idempotency key' });
        }
        if (idempotencyKey && anchorCreateByIdempotencyKey.has(idempotencyKey)) {
          const existing = anchorCreateByIdempotencyKey.get(idempotencyKey);
          if (existing.userId !== uid) {
            return send(res, 409, {
              success: false,
              error: { code: 'IDEMPOTENCY_KEY_CONFLICT', message: 'Idempotency key already used by another user' },
            });
          }
          return send(res, 200, { success: true, data: serializeAnchorForList(existing) });
        }
        if (!userRecord.isComped && userRecord.subscriptionStatus === 'free' && userRecord.totalAnchorsCreated >= 1) {
          return send(res, 403, {
            success: false,
            error: {
              code: 'CREATE_ANCHOR_FREE_LOCKED',
              message: 'A subscription is required to create another anchor',
            },
          });
        }

        const sequence = userRecord.totalAnchorsCreated + 1;
        const anchorId = makeDeterministicUuid(uid, sequence);
        const nowIso = new Date().toISOString();
        const safeIntentionText =
          body.intentionText === SYNTHETIC_FIXTURE_INTENTION || /^Synthetic /i.test(body.intentionText)
            ? body.intentionText
            : SYNTHETIC_FIXTURE_INTENTION;
        const anchorRecord = {
          id: anchorId,
          userId: uid,
          intentionText: safeIntentionText,
          category: typeof body.category === 'string' && SYNTHETIC_CATEGORIES.includes(body.category)
            ? body.category
            : 'desire',
          distilledLetters: Array.isArray(body.distilledLetters)
            ? body.distilledLetters.filter((letter) => typeof letter === 'string').slice(0, 16)
            : ['S', 'Y', 'N', 'T', 'H'],
          baseSigilSvg: typeof body.baseSigilSvg === 'string' && body.baseSigilSvg.length > 0 && body.baseSigilSvg.length <= 12_000
            ? body.baseSigilSvg
            : SYNTHETIC_DEFAULT_SVG,
          enhancedImageUrl: typeof body.enhancedImageUrl === 'string' ? body.enhancedImageUrl : null,
          structureVariant: typeof body.structureVariant === 'string' ? body.structureVariant : 'balanced',
          isCharged: false,
          chargedAt: null,
          firstChargedAt: null,
          ignitedAt: null,
          activationCount: 0,
          chargeCount: 0,
          lastActivatedAt: null,
          isArchived: false,
          releasedAt: null,
          archivedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        anchorsByUser.get(uid).set(anchorId, anchorRecord);
        if (idempotencyKey) anchorCreateByIdempotencyKey.set(idempotencyKey, anchorRecord);
        userRecord.totalAnchorsCreated = sequence;
        userRecord.hasCompletedOnboarding = true;
        userRecord.updatedAt = nowIso;

        return send(res, 201, {
          success: true,
          data: serializeAnchorForList(anchorRecord),
        });
      }

      const anchorUpdateMatch = req.method === 'PUT'
        ? /^\/api\/anchors\/([0-9a-f-]{36})$/i.exec(url.pathname)
        : null;
      if (anchorUpdateMatch) {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const body = await readJson(req);
        if (!body || typeof body !== 'object') {
          return send(res, 422, { success: false, error: 'Invalid fixture request' });
        }
        const userRecord = getOrCreateUserRecord(decoded);
        const userAnchors = anchorsByUser.get(userRecord.id);
        const anchor = userAnchors ? userAnchors.get(anchorUpdateMatch[1]) : null;
        if (!anchor) return send(res, 404, { success: false, error: 'Anchor not found' });

        const nowIso = new Date().toISOString();
        if (typeof body.enhancedImageUrl === 'string' || body.enhancedImageUrl === null) {
          anchor.enhancedImageUrl = body.enhancedImageUrl;
        }
        if (typeof body.baseSigilSvg === 'string' && body.baseSigilSvg.length > 0 && body.baseSigilSvg.length <= 12_000) {
          anchor.baseSigilSvg = body.baseSigilSvg;
        }
        if (typeof body.structureVariant === 'string') {
          anchor.structureVariant = body.structureVariant;
        }
        if (typeof body.isCharged === 'boolean') {
          anchor.isCharged = body.isCharged;
          if (body.isCharged && !anchor.chargedAt) {
            anchor.chargedAt = nowIso;
            anchor.firstChargedAt = anchor.firstChargedAt || nowIso;
          }
        }
        if (typeof body.isArchived === 'boolean') {
          anchor.isArchived = body.isArchived;
          if (body.isArchived) {
            anchor.archivedAt = anchor.archivedAt || nowIso;
            anchor.releasedAt = anchor.releasedAt || nowIso;
          }
        }
        anchor.updatedAt = nowIso;
        userRecord.updatedAt = nowIso;

        return send(res, 200, {
          success: true,
          data: serializeAnchorForList(anchor),
        });
      }

      const anchorActionMatch = req.method === 'POST'
        ? /^\/api\/anchors\/([0-9a-f-]{36})\/(charge|activate)$/i.exec(url.pathname)
        : null;
      if (anchorActionMatch) {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const body = await readJson(req);
        if (!body || typeof body !== 'object') {
          return send(res, 422, { success: false, error: 'Invalid fixture request' });
        }
        const userRecord = getOrCreateUserRecord(decoded);
        const uid = userRecord.id;
        const userAnchors = anchorsByUser.get(uid);
        const anchor = userAnchors ? userAnchors.get(anchorActionMatch[1]) : null;
        if (!anchor) return send(res, 404, { success: false, error: 'Anchor not found' });

        const action = anchorActionMatch[2].toLowerCase();
        const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0
          ? `${uid}:${action}:${anchor.id}:${body.idempotencyKey}`
          : null;
        if (idempotencyKey && idempotencyResults.has(idempotencyKey)) {
          return send(res, 200, idempotencyResults.get(idempotencyKey));
        }

        const nowIso = new Date().toISOString();
        if (action === 'charge') {
          anchor.isCharged = true;
          anchor.chargedAt = nowIso;
          anchor.firstChargedAt = anchor.firstChargedAt || nowIso;
          anchor.ignitedAt = anchor.ignitedAt || nowIso;
          anchor.chargeCount = (anchor.chargeCount || 0) + 1;
          anchor.updatedAt = nowIso;
          const chargeRecord = {
            id: `charge-${anchor.id}-${anchor.chargeCount}`,
            userId: uid,
            anchorId: anchor.id,
            chargeType: typeof body.chargeType === 'string' ? body.chargeType : 'initial_quick',
            durationSeconds: Number.isFinite(body.durationSeconds) ? body.durationSeconds : 30,
            completed: true,
            chargedAt: nowIso,
          };
          chargesByUser.get(uid).push(chargeRecord);
          const payload = {
            success: true,
            data: serializeAnchorForList(anchor),
          };
          if (idempotencyKey) idempotencyResults.set(idempotencyKey, payload);
          return send(res, 200, payload);
        }

        anchor.activationCount = (anchor.activationCount || 0) + 1;
        anchor.lastActivatedAt = nowIso;
        anchor.updatedAt = nowIso;
        userRecord.totalActivations += 1;
        userRecord.currentStreak = Math.max(1, userRecord.currentStreak);
        userRecord.longestStreak = Math.max(userRecord.longestStreak, userRecord.currentStreak);
        userRecord.updatedAt = nowIso;

        const activationRecord = {
          id: `activation-${anchor.id}-${anchor.activationCount}`,
          userId: uid,
          anchorId: anchor.id,
          activationType: typeof body.activationType === 'string' ? body.activationType : 'visual',
          durationSeconds: Number.isFinite(body.durationSeconds) ? body.durationSeconds : 30,
          activatedAt: nowIso,
        };
        activationsByUser.get(uid).push(activationRecord);
        const payload = {
          success: true,
          data: {
            anchor: serializeAnchorForList(anchor),
            activation: activationRecord,
            user: {
              totalActivations: userRecord.totalActivations,
              currentStreak: userRecord.currentStreak,
              longestStreak: userRecord.longestStreak,
            },
          },
        };
        if (idempotencyKey) idempotencyResults.set(idempotencyKey, payload);
        return send(res, 200, payload);
      }

      if (req.method === 'POST' && url.pathname === '/api/practice/sessions') {
        const decoded = await authenticate(req);
        if (!decoded) return send(res, 401, { success: false, error: 'Unauthorized' });
        const body = await readJson(req);
        const uid = decoded.uid || decoded.sub;
        const valid = body && typeof body === 'object' &&
          typeof body.id === 'string' && body.id.length > 0 && body.id.length <= 128 &&
          ALLOWED_MODES.has(body.practiceMode) &&
          body.completionStatus === 'completed' &&
          Number.isFinite(body.plannedDurationSeconds) && body.plannedDurationSeconds > 0 && body.plannedDurationSeconds <= 7200 &&
          Number.isFinite(body.completedDurationSeconds) && body.completedDurationSeconds >= body.plannedDurationSeconds && body.completedDurationSeconds <= 7200 &&
          typeof body.completedAt === 'string' && !Number.isNaN(Date.parse(body.completedAt));
        if (!valid || !users.has(uid)) return send(res, 422, { success: false, error: 'Invalid fixture request' });

        // Retain only the minimum non-sensitive fixture summary in RAM; discard all other fields.
        const entry = {
          id: body.id,
          uid,
          practiceMode: body.practiceMode,
          plannedDurationSeconds: body.plannedDurationSeconds,
          completedDurationSeconds: body.completedDurationSeconds,
          completedAt: body.completedAt,
        };
        sessions.set(`${uid}:${body.id}`, entry);
        return send(res, 201, { success: true, data: { id: entry.id, userId: uid } });
      }

      return send(res, 404, { success: false, error: 'Not found' });
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 400;
      return send(res, status, { success: false, error: status === 413 ? 'Request too large' : 'Invalid fixture request' });
    }
  });

  return { server, users, sessions, anchorsByUser };
}

function createAdminVerifier() {
  const root = path.resolve(__dirname, '..', '..', '..', '..');
  const requireFromBackend = createRequire(path.join(root, 'backend', 'package.json'));
  const admin = requireFromBackend('firebase-admin');
  process.env.FIREBASE_AUTH_EMULATOR_HOST = `${HOST}:9099`;
  process.env.GCLOUD_PROJECT = EXPECTED_PROJECT_ID;
  process.env.GOOGLE_CLOUD_PROJECT = EXPECTED_PROJECT_ID;
  const app = admin.initializeApp({ projectId: EXPECTED_PROJECT_ID }, `anchor-perf-fixture-${process.pid}`);
  return (token) => app.auth().verifyIdToken(token);
}

if (require.main === module) {
  validateDiagnosticConfig({
    applicationId: 'com.anchorintentions.perflab20261012',
    apiUrl: 'http://127.0.0.1:39999',
    authEmulatorUrl: 'http://127.0.0.1:9099',
    firebaseProjectId: EXPECTED_PROJECT_ID,
  });
  const { server } = createFixtureServer({ verifyIdToken: createAdminVerifier() });
  server.on('error', () => {
    process.stderr.write('Fixture API could not bind its loopback endpoint.\n');
    process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => {
    process.stdout.write(`fixture-api listening on ${HOST}:${PORT}; project=${EXPECTED_PROJECT_ID}\n`);
  });
}

module.exports = {
  createFixtureServer,
  validateEmulatorClaims,
  createAdminVerifier,
  HOST,
  PORT,
  SYNTHETIC_FIXTURE_INTENTION,
};
