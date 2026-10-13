'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const {
  createFixtureServer,
  createAdminVerifier,
  validateEmulatorClaims,
  HOST,
  PORT,
  SYNTHETIC_FIXTURE_INTENTION,
} = require('./fixture-api.cjs');
const {
  EXPECTED_PROJECT_ID,
  EXPECTED_API_URL,
  EXPECTED_AUTH_EMULATOR_URL,
  EXPECTED_APPLICATION_ID,
  validateDiagnosticConfig,
} = require('./diagnostic-config.cjs');

const emulatorHost = '127.0.0.1:9099';
const emulatorBase = `http://${emulatorHost}`;
const fakeApiKey = 'fake-api-key';
let currentPhase = 'configuration and claim guards';
const accountArgs = process.argv.slice(2);
if (accountArgs.length > 1 || (accountArgs.length === 1 && !['--secondary', '--comped'].includes(accountArgs[0]))) {
  throw new Error('Usage: node test-fixture.cjs [--secondary|--comped]');
}
const accountMode = accountArgs[0] || 'free-primary';
const isComped = accountMode === '--comped';
const expectedAccountUid = accountMode === '--secondary'
  ? 'synthetic-account-b'
  : isComped
    ? 'synthetic-account-c'
    : 'synthetic-account';
const credentialFilename = accountMode === '--secondary'
  ? 'synthetic-account-b.credentials.json'
  : isComped
    ? 'synthetic-account-c.credentials.json'
    : 'synthetic-account.credentials.json';

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

async function run() {
  validateDiagnosticConfig({
    applicationId: EXPECTED_APPLICATION_ID,
    apiUrl: EXPECTED_API_URL,
    authEmulatorUrl: EXPECTED_AUTH_EMULATOR_URL,
    firebaseProjectId: EXPECTED_PROJECT_ID,
  });
  for (const invalid of [
    { apiUrl: 'https://anchor-production-26bf.up.railway.app' },
    { apiUrl: 'http://192.168.1.10:39999' },
    { applicationId: 'com.anchorintentions.app' },
    { applicationId: 'com.anchorintentions.perfbaseline' },
    { authEmulatorUrl: 'https://identitytoolkit.googleapis.com' },
    { firebaseProjectId: 'anchor-ac6d6' },
  ]) {
    assert.throws(() => validateDiagnosticConfig({
      applicationId: invalid.applicationId ?? EXPECTED_APPLICATION_ID,
      apiUrl: invalid.apiUrl ?? EXPECTED_API_URL,
      authEmulatorUrl: invalid.authEmulatorUrl ?? EXPECTED_AUTH_EMULATOR_URL,
      firebaseProjectId: invalid.firebaseProjectId ?? EXPECTED_PROJECT_ID,
    }));
  }

  const expectedClaims = {
    aud: EXPECTED_PROJECT_ID,
    iss: `https://securetoken.google.com/${EXPECTED_PROJECT_ID}`,
    sub: 'synthetic-user',
    uid: 'synthetic-user',
  };
  assert.equal(validateEmulatorClaims(expectedClaims), true);
  assert.equal(validateEmulatorClaims({ ...expectedClaims, aud: 'anchor-production-26bf' }), false);
  assert.equal(validateEmulatorClaims({ ...expectedClaims, iss: 'https://securetoken.google.com/anchor-production-26bf' }), false);
  assert.equal(validateEmulatorClaims({ ...expectedClaims, sub: 'different-user' }), false);
  assert.throws(() => createFixtureServer({ verifyIdToken: async () => expectedClaims, projectId: 'anchor-production-26bf' }));

  currentPhase = 'production project token claim rejection';
  const productionClaimsFixture = createFixtureServer({
    verifyIdToken: async () => ({
      ...expectedClaims,
      aud: 'anchor-production-26bf',
      iss: 'https://securetoken.google.com/anchor-production-26bf',
    }),
  });
  await new Promise((resolve, reject) => {
    productionClaimsFixture.server.once('error', reject);
    productionClaimsFixture.server.listen(0, HOST, resolve);
  });
  try {
    const productionClaimsResponse = await jsonFetch(
      `http://${HOST}:${productionClaimsFixture.server.address().port}/api/auth/sync`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-claim-test' },
        body: JSON.stringify({ authProvider: 'email' }),
      },
    );
    assert.equal(productionClaimsResponse.response.status, 401);
    const productionEnhanceResponse = await jsonFetch(
      `http://${HOST}:${productionClaimsFixture.server.address().port}/api/ai/enhance`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-claim-test' },
        body: JSON.stringify({
          sigilSvg: '<svg/>', styleChoice: 'porcelain_v2', intentionText: SYNTHETIC_FIXTURE_INTENTION,
          anchorId: 'temp-production-token', provider: 'gemini', tier: 'premium', generationAttempt: 1,
        }),
      },
    );
    assert.equal(productionEnhanceResponse.response.status, 401);
  } finally {
    await new Promise((resolve) => productionClaimsFixture.server.close(resolve));
  }

  currentPhase = 'non-C identity cannot receive comped access from a verified claim';
  const nonCCompedClaimFixture = createFixtureServer({
    verifyIdToken: async (token) => token === 'synthetic-b-comped-claim'
      ? {
        aud: EXPECTED_PROJECT_ID,
        iss: `https://securetoken.google.com/${EXPECTED_PROJECT_ID}`,
        sub: 'synthetic-account-b',
        uid: 'synthetic-account-b',
        anchorPerfOnboarded: true,
        anchorPerfComped: true,
      }
      : null,
  });
  await new Promise((resolve, reject) => {
    nonCCompedClaimFixture.server.once('error', reject);
    nonCCompedClaimFixture.server.listen(0, HOST, resolve);
  });
  try {
    const nonCProfile = await jsonFetch(
      `http://${HOST}:${nonCCompedClaimFixture.server.address().port}/api/auth/sync`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer synthetic-b-comped-claim' },
        body: JSON.stringify({ authProvider: 'email', isComped: true }),
      },
    );
    assert.equal(nonCProfile.response.status, 200);
    assert.equal(nonCProfile.body.data.id, 'synthetic-account-b');
    assert.equal(nonCProfile.body.data.isComped, false);
  } finally {
    await new Promise((resolve) => nonCCompedClaimFixture.server.close(resolve));
  }

  currentPhase = 'C motion route requires both verified onboarding and comped claims';
  const incompleteCClaimsFixture = createFixtureServer({
    verifyIdToken: async (token) => token === 'synthetic-c-without-onboarding'
      ? {
        aud: EXPECTED_PROJECT_ID,
        iss: `https://securetoken.google.com/${EXPECTED_PROJECT_ID}`,
        sub: 'synthetic-account-c',
        uid: 'synthetic-account-c',
        anchorPerfOnboarded: false,
        anchorPerfComped: true,
      }
      : null,
  });
  await new Promise((resolve, reject) => {
    incompleteCClaimsFixture.server.once('error', reject);
    incompleteCClaimsFixture.server.listen(0, HOST, resolve);
  });
  try {
    const incompleteCRead = await fetch(
      `http://${HOST}:${incompleteCClaimsFixture.server.address().port}/api/v2/anchors/synthetic-anchor-001/vision`,
      { headers: { authorization: 'Bearer synthetic-c-without-onboarding' } },
    );
    assert.equal(incompleteCRead.status, 403);
  } finally {
    await new Promise((resolve) => incompleteCClaimsFixture.server.close(resolve));
  }

  // Credentials are generated once by setup-synthetic-account.cjs and live only in TEMP.
  currentPhase = 'TEMP synthetic account credential validation';
  const credentialPath = path.join(os.tmpdir(), 'anchor-perf-release-20261012-auth-fixture', credentialFilename);
  const credential = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
  assert.equal(credential.projectId, EXPECTED_PROJECT_ID);
  assert.equal(credential.authEmulatorHost, emulatorHost);
  assert.equal(credential.applicationId, EXPECTED_APPLICATION_ID);
  assert.equal(credential.uid, expectedAccountUid);

  currentPhase = 'Auth Emulator synthetic account sign-in';
  const account = await jsonFetch(`${emulatorBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${fakeApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: credential.email, password: credential.password, returnSecureToken: true }),
  });
  assert.equal(account.response.ok, true, 'Auth Emulator must sign in the one-time synthetic account');
  assert.equal(account.body.localId, credential.uid);
  const token = account.body.idToken;
  assert.equal(typeof token, 'string');
  const verifyIdToken = createAdminVerifier();
  const decodedAccount = await verifyIdToken(token);
  assert.equal(decodedAccount.uid, expectedAccountUid);
  assert.equal(decodedAccount.anchorPerfOnboarded, true);
  assert.equal(decodedAccount.anchorPerfComped === true, isComped);

  const fixture = createFixtureServer({ verifyIdToken });
  currentPhase = 'fixture API startup';
  await new Promise((resolve, reject) => {
    fixture.server.once('error', reject);
    fixture.server.listen(0, HOST, resolve);
  });
  try {
    currentPhase = 'fixture health';
    const apiBase = `http://${HOST}:${fixture.server.address().port}`;
    const health = await jsonFetch(`${apiBase}/health`);
    assert.equal(health.response.status, 200);

    currentPhase = 'emulator token auth sync';
    const authSync = await jsonFetch(`${apiBase}/api/auth/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        authProvider: 'email', hasCompletedOnboarding: !decodedAccount.anchorPerfOnboarded,
        anchorPerfOnboarded: !decodedAccount.anchorPerfOnboarded,
        isComped: !isComped, anchorPerfComped: !isComped, allowCreate: true,
      }),
    });
    assert.equal(authSync.response.status, 200);
    assert.equal(authSync.body.data.id, expectedAccountUid);
    assert.equal(authSync.body.data.isComped, isComped);
    assert.equal(authSync.body.data.subscriptionStatus, 'free');
    assert.equal(authSync.body.data.hasCompletedOnboarding, true);

    currentPhase = 'C-only read-only synthetic Vision/Chart fixtures and fixed image assets';
    const motionRouteBase = `${apiBase}/api/v2/anchors/synthetic-anchor-001`;
    const motionHeaders = { authorization: `Bearer ${token}` };
    const visionRead = await fetch(`${motionRouteBase}/vision`, { headers: motionHeaders });
    const chartRead = await fetch(`${motionRouteBase}/chart`, { headers: motionHeaders });
    if (isComped) {
      assert.equal(visionRead.status, 200);
      assert.equal(chartRead.status, 200);
      const visionBody = await visionRead.json();
      const chartBody = await chartRead.json();
      const template = require('../diagnostic-src/motion-read-fixtures.json');
      const selected = (fixtureNumber) => `synthetic-anchor-${String(fixtureNumber).padStart(3, '0')}`;
      const expectedVision = JSON.parse(JSON.stringify(template.vision).replaceAll('__ANCHOR_ID__', selected(1)));
      const expectedChart = JSON.parse(JSON.stringify(template.chart)
        .replaceAll('__ANCHOR_ID__', selected(1))
        .replaceAll('__INTENTION_TEXT__', 'Synthetic intention fixture 001; no real user writing.')
        .replaceAll('__CATEGORY__', 'desire'));
      assert.deepEqual(visionBody, { success: true, data: expectedVision });
      assert.deepEqual(chartBody, { success: true, data: expectedChart });
      assert.equal(JSON.stringify(visionBody).includes('PRIVATE'), false);
      assert.equal(JSON.stringify(chartBody).includes('PRIVATE'), false);

      const outOfRangeMotion = await fetch(`${apiBase}/api/v2/anchors/synthetic-anchor-073/vision`, { headers: motionHeaders });
      const malformedMotion = await fetch(`${apiBase}/api/v2/anchors/synthetic-anchor-001%2f..%2f..%2fhealth/vision`, { headers: motionHeaders });
      assert.equal(outOfRangeMotion.status, 404);
      assert.equal(malformedMotion.status, 404);
      const unauthenticatedMotion = await fetch(`${motionRouteBase}/vision`);
      const invalidBearerMotion = await fetch(`${motionRouteBase}/chart`, { headers: { authorization: 'Bearer invalid' } });
      assert.equal(unauthenticatedMotion.status, 401);
      assert.equal(invalidBearerMotion.status, 401);
      const forbiddenMotionWrite = await fetch(`${motionRouteBase}/vision`, {
        method: 'POST', headers: { ...motionHeaders, 'content-type': 'application/json' }, body: '{}',
      });
      assert.equal(forbiddenMotionWrite.status, 404);

      for (const filename of ['vision-future-desk.jpg', 'vision-future-window.jpg', 'vision-future-family.jpg']) {
        const response = await fetch(`${apiBase}/perf-assets/${filename}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-type') || '', /^image\/jpeg/);
        const actual = Buffer.from(await response.arrayBuffer());
        const expected = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', '..', 'anchor', 'mobile', 'src', 'assets', 'vision', filename));
        assert.deepEqual(actual, expected);
      }
      const unlistedAsset = await fetch(`${apiBase}/perf-assets/../../package.json`);
      assert.equal(unlistedAsset.status, 404);
    } else {
      assert.equal(visionRead.status, 403);
      assert.equal(chartRead.status, 403);
    }

    currentPhase = 'authenticated synthetic Anchor image response';
    const syntheticEnhanceRequest = {
      sigilSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M5 1v8"/></svg>',
      styleChoice: 'porcelain_v2',
      intentionText: SYNTHETIC_FIXTURE_INTENTION,
      anchorId: 'temp-synthetic-create-1',
      provider: 'gemini',
      tier: 'premium',
      generationAttempt: 1,
    };
    const syntheticEnhance = await jsonFetch(`${apiBase}/api/ai/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(syntheticEnhanceRequest),
    });
    assert.equal(syntheticEnhance.response.status, 200);
    assert.equal(syntheticEnhance.body.success, true);
    assert.equal(syntheticEnhance.body.variations.length, 1);
    assert.equal(syntheticEnhance.body.variations[0].imageUrl, `${apiBase}/__fixture/synthetic-anchor.png`);
    assert.equal(syntheticEnhance.body.variations[0].classification, 'Synthetic fixture');
    for (const metric of ['structureMatchScore', 'iouScore', 'edgeOverlapScore', 'structurePreserved']) {
      assert.equal(Object.hasOwn(syntheticEnhance.body.variations[0], metric), false);
    }
    assert.equal(JSON.stringify(syntheticEnhance.body).includes(SYNTHETIC_FIXTURE_INTENTION), false);
    assert.equal(syntheticEnhance.body.prompt, '');
    const syntheticImageResponse = await fetch(syntheticEnhance.body.variations[0].imageUrl);
    const syntheticImage = Buffer.from(await syntheticImageResponse.arrayBuffer());
    assert.equal(syntheticImageResponse.status, 200);
    assert.match(syntheticImageResponse.headers.get('content-type') || '', /^image\/png/);
    assert.deepEqual([...syntheticImage.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok(syntheticImage.length > 500);
    let chunkOffset = 8;
    const imageChunks = [];
    let imageHasEndChunk = false;
    while (chunkOffset < syntheticImage.length) {
      const chunkLength = syntheticImage.readUInt32BE(chunkOffset);
      const chunkType = syntheticImage.toString('ascii', chunkOffset + 4, chunkOffset + 8);
      const chunkData = syntheticImage.subarray(chunkOffset + 8, chunkOffset + 8 + chunkLength);
      if (chunkType === 'IDAT') imageChunks.push(chunkData);
      chunkOffset += 12 + chunkLength;
      if (chunkType === 'IEND') imageHasEndChunk = true;
    }
    assert.equal(chunkOffset, syntheticImage.length);
    assert.equal(imageHasEndChunk, true);
    assert.equal(zlib.inflateSync(Buffer.concat(imageChunks)).length, (192 * 4 + 1) * 192);

    currentPhase = 'guest synthetic temp-anchor image response';
    const guestSyntheticEnhance = await jsonFetch(`${apiBase}/api/ai/enhance`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(syntheticEnhanceRequest),
    });
    assert.equal(guestSyntheticEnhance.response.status, 200);
    assert.equal(guestSyntheticEnhance.body.variations[0].imageUrl, `${apiBase}/__fixture/synthetic-anchor.png`);

    currentPhase = 'guest synthetic fixture rejects non-synthetic input and ordinary anchor IDs';
    const privateIntentionEnhance = await jsonFetch(`${apiBase}/api/ai/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...syntheticEnhanceRequest, intentionText: 'PRIVATE USER INTENTION MUST NOT BE ACCEPTED' }),
    });
    assert.equal(privateIntentionEnhance.response.status, 422);
    const ordinaryAnchorEnhance = await jsonFetch(`${apiBase}/api/ai/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...syntheticEnhanceRequest, anchorId: 'real-anchor-id' }),
    });
    assert.equal(ordinaryAnchorEnhance.response.status, 422);
    const invalidBearerEnhance = await jsonFetch(`${apiBase}/api/ai/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-a-valid-token' },
      body: JSON.stringify(syntheticEnhanceRequest),
    });
    assert.equal(invalidBearerEnhance.response.status, 401);

    currentPhase = 'Focus session fixture write';
    const session = await jsonFetch(`${apiBase}/api/practice/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: `${expectedAccountUid}-focus-session`, practiceMode: 'focus', completionStatus: 'completed',
        plannedDurationSeconds: 60, completedDurationSeconds: 60,
        completedAt: new Date().toISOString(),
        sceneSnapshot: 'PRIVATE INTENTION MUST NOT BE RETAINED',
        nextAction: 'PRIVATE NEXT ACTION MUST NOT BE RETAINED',
      }),
    });
    assert.equal(session.response.status, 201);
    assert.equal(session.body.data.id, `${expectedAccountUid}-focus-session`);
    assert.equal(session.body.data.userId, expectedAccountUid);
    assert.equal(fixture.sessions.size, 1);
    const retainedSession = [...fixture.sessions.values()][0];
    assert.equal(retainedSession.uid, expectedAccountUid);
    assert.equal(retainedSession.practiceMode, 'focus');
    assert.equal(retainedSession.completedDurationSeconds, 60);
    assert.equal(Object.hasOwn(retainedSession, 'sceneSnapshot'), false);
    assert.equal(Object.hasOwn(retainedSession, 'nextAction'), false);

    currentPhase = 'invalid bearer rejection';
    const invalidToken = await jsonFetch(`${apiBase}/api/auth/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-a-valid-token' },
      body: JSON.stringify({ authProvider: 'email' }),
    });
    assert.equal(invalidToken.response.status, 401);

    currentPhase = 'unclaimed account cannot set onboarding through request body';
    const unclaimedEmail = `anchor-perf-unclaimed-${process.pid}-${Date.now()}@example.invalid`;
    const unclaimedPassword = `T-${require('node:crypto').randomBytes(18).toString('base64url')}!9`;
    const unclaimedSignUp = await jsonFetch(`${emulatorBase}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${fakeApiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: unclaimedEmail, password: unclaimedPassword, returnSecureToken: true }),
    });
    assert.equal(unclaimedSignUp.response.ok, true);
    const unclaimedEnhance = await jsonFetch(`${apiBase}/api/ai/enhance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${unclaimedSignUp.body.idToken}` },
      body: JSON.stringify(syntheticEnhanceRequest),
    });
    assert.equal(unclaimedEnhance.response.status, 403);
    const unclaimedSync = await jsonFetch(`${apiBase}/api/auth/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${unclaimedSignUp.body.idToken}` },
      body: JSON.stringify({
        authProvider: 'email', hasCompletedOnboarding: true, anchorPerfOnboarded: true,
        isComped: true, anchorPerfComped: true, allowCreate: true,
      }),
    });
    assert.equal(unclaimedSync.response.status, 200);
    assert.equal(unclaimedSync.body.data.hasCompletedOnboarding, false);
    assert.equal(unclaimedSync.body.data.isComped, false);

    currentPhase = 'wrong auth provider rejection';
    const wrongProject = await jsonFetch(`${apiBase}/api/auth/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ authProvider: 'google' }),
    });
    assert.equal(wrongProject.response.status, 422);

    currentPhase = 'canonical authenticated profile hydration (GET /api/auth/me)';
    const authMeInitial = await jsonFetch(`${apiBase}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(authMeInitial.response.status, 200);
    assert.equal(authMeInitial.body.success, true);
    assert.equal(authMeInitial.body.data.id, expectedAccountUid);
    assert.equal(authMeInitial.body.data.isComped, isComped);
    assert.equal(authMeInitial.body.data.totalAnchorsCreated, 0);
    assert.equal(authMeInitial.body.data.freeAnchorConsumed, false);
    assert.equal(typeof authMeInitial.body.data.settings, 'object');
    assert.equal(typeof authMeInitial.body.data.chartFlags, 'object');

    currentPhase = 'canonical initial anchor list and export (GET /api/anchors & GET /api/auth/me/export)';
    const anchorsInitial = await jsonFetch(`${apiBase}/api/anchors?limit=100&orderBy=updatedAt&order=desc`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(anchorsInitial.response.status, 200);
    assert.equal(anchorsInitial.body.success, true);
    assert.deepEqual(anchorsInitial.body.data, []);
    assert.equal(anchorsInitial.body.meta.total, 0);

    const exportInitial = await jsonFetch(`${apiBase}/api/auth/me/export`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(exportInitial.response.status, 200);
    assert.equal(exportInitial.body.success, true);
    assert.equal(exportInitial.body.data.exportVersion, 4);
    assert.equal(exportInitial.body.data.account.id, expectedAccountUid);
    assert.deepEqual(exportInitial.body.data.account.anchors, []);
    assert.deepEqual(exportInitial.body.data.burnedAnchors, []);
    assert.equal(exportInitial.body.data.account.practiceSessions.length, 1);

    currentPhase = 'guest-to-account transition (POST /api/anchors, charge, activate, update, onboarding-context)';
    const createdAnchorRes = await jsonFetch(`${apiBase}/api/anchors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intentionText: SYNTHETIC_FIXTURE_INTENTION,
        category: 'desire',
        distilledLetters: ['B', 'L', 'D', 'T', 'S'],
        baseSigilSvg: syntheticEnhanceRequest.sigilSvg,
        structureVariant: 'balanced',
      }),
    });
    assert.equal(createdAnchorRes.response.status, 201);
    assert.equal(createdAnchorRes.body.success, true);
    const createdAnchorId = createdAnchorRes.body.data.id;
    assert.match(createdAnchorId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(createdAnchorRes.body.data.userId, expectedAccountUid);
    assert.equal(createdAnchorRes.body.data.intentionText, SYNTHETIC_FIXTURE_INTENTION);

    const chargeRes = await jsonFetch(`${apiBase}/api/anchors/${createdAnchorId}/charge`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        chargeType: 'initial_quick',
        durationSeconds: 30,
        idempotencyKey: `charge-key-${expectedAccountUid}`,
      }),
    });
    assert.equal(chargeRes.response.status, 200);
    assert.equal(chargeRes.body.data.isCharged, true);
    assert.equal(chargeRes.body.data.chargeCount, 1);

    const activateRes = await jsonFetch(`${apiBase}/api/anchors/${createdAnchorId}/activate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        activationType: 'visual',
        durationSeconds: 30,
        idempotencyKey: `activate-key-${expectedAccountUid}`,
      }),
    });
    assert.equal(activateRes.response.status, 200);
    assert.equal(activateRes.body.data.anchor.activationCount, 1);
    assert.equal(activateRes.body.data.user.totalActivations, 1);

    const updateAnchorRes = await jsonFetch(`${apiBase}/api/anchors/${createdAnchorId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        enhancedImageUrl: `${apiBase}/__fixture/synthetic-anchor.png`,
        isCharged: true,
      }),
    });
    assert.equal(updateAnchorRes.response.status, 200);
    assert.equal(updateAnchorRes.body.data.enhancedImageUrl, `${apiBase}/__fixture/synthetic-anchor.png`);

    const onboardingContextRes = await jsonFetch(`${apiBase}/api/auth/onboarding-context`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ focusCategory: 'desire' }),
    });
    assert.equal(onboardingContextRes.response.status, 200);
    assert.equal(onboardingContextRes.body.data.hasCompletedOnboarding, true);

    currentPhase = 'post-transition hydration consistency across /api/auth/me, /api/anchors, and /api/auth/me/export';
    const authMeAfter = await jsonFetch(`${apiBase}/api/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(authMeAfter.response.status, 200);
    assert.equal(authMeAfter.body.data.totalAnchorsCreated, 1);
    assert.equal(authMeAfter.body.data.freeAnchorConsumed, true);
    assert.equal(authMeAfter.body.data.totalActivations, 1);

    const anchorsAfter = await jsonFetch(`${apiBase}/api/anchors?isCharged=true&limit=20&orderBy=updatedAt&order=desc`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(anchorsAfter.response.status, 200);
    assert.equal(anchorsAfter.body.data.length, 1);
    assert.equal(anchorsAfter.body.data[0].id, createdAnchorId);
    assert.equal(anchorsAfter.body.data[0].isCharged, true);
    assert.equal(anchorsAfter.body.data[0].activationCount, 1);

    const exportAfter = await jsonFetch(`${apiBase}/api/auth/me/export`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(exportAfter.response.status, 200);
    assert.equal(exportAfter.body.data.account.anchors.length, 1);
    assert.equal(exportAfter.body.data.account.anchors[0].id, createdAnchorId);
    assert.equal(exportAfter.body.data.account.activations.length, 1);
    assert.equal(exportAfter.body.data.account.charges.length, 1);

    currentPhase = 'free-user second-Anchor restriction vs comped access';
    const secondAnchorRes = await jsonFetch(`${apiBase}/api/anchors`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intentionText: 'Synthetic second anchor validation',
        category: 'career',
        distilledLetters: ['S', 'C', 'N', 'D'],
        baseSigilSvg: syntheticEnhanceRequest.sigilSvg,
      }),
    });
    if (isComped) {
      assert.equal(secondAnchorRes.response.status, 201);
      assert.equal(secondAnchorRes.body.success, true);
    } else {
      assert.equal(secondAnchorRes.response.status, 403);
      assert.equal(secondAnchorRes.body.error.code, 'CREATE_ANCHOR_FREE_LOCKED');
    }

    currentPhase = 'cross-account isolation on /api/anchors, /api/auth/me/export, and anchor mutation';
    const foreignAnchors = await jsonFetch(`${apiBase}/api/anchors`, {
      headers: { authorization: `Bearer ${unclaimedSignUp.body.idToken}` },
    });
    assert.equal(foreignAnchors.response.status, 200);
    assert.deepEqual(foreignAnchors.body.data, []);

    const foreignExport = await jsonFetch(`${apiBase}/api/auth/me/export`, {
      headers: { authorization: `Bearer ${unclaimedSignUp.body.idToken}` },
    });
    assert.equal(foreignExport.response.status, 200);
    assert.deepEqual(foreignExport.body.data.account.anchors, []);

    const foreignMutation = await jsonFetch(`${apiBase}/api/anchors/${createdAnchorId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${unclaimedSignUp.body.idToken}` },
      body: JSON.stringify({ isCharged: false }),
    });
    assert.equal(foreignMutation.response.status, 404);
  } finally {
    await new Promise((resolve) => fixture.server.close(resolve));
  }

  process.stdout.write(`PASS: demo-project and claim guards, Auth Emulator sign-in, ${isComped ? 'verified synthetic-comped' : 'free'} account profile, canonical /api/auth/me, /api/anchors, /api/auth/me/export, guest-to-account transition, free-user second-Anchor gate, cross-account isolation, C-only read-only Vision/Chart fixtures with bundled asset parity, authenticated and narrowly anonymous synthetic-temp image generation, loopback PNG validation, private-intention/ordinary-anchor/invalid-token rejection, RAM-only practice-session record retention, and sensitive-field discard.\n`);
}

run().catch(() => {
  process.stderr.write(`FAIL: local fixture test phase: ${currentPhase}; captured request bodies and credentials are not displayed.\n`);
  process.exitCode = 1;
});
