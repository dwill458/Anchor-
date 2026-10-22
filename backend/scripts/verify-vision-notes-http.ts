/**
 * Local-only HTTP QA for persisted Vision notes.
 *
 * Run from backend with `npx ts-node scripts/verify-vision-notes-http.ts`.
 * Add `--serve` to keep a loopback server and QA fixture for the mobile app;
 * pass its printed private state path to `--cleanup <path>` when finished.
 * This deliberately imports the production Vision router and auth middleware.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function main(): Promise<void> {
  const dotenv = await import('dotenv');
  dotenv.config();
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run HTTP QA in production.');
  process.env.NODE_ENV ||= 'development';
  if (!process.env.DEV_MASTER_TOKEN) throw new Error('Set the existing DEV_MASTER_TOKEN in the local backend environment.');

  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (databaseUrl.hostname !== '127.0.0.1' || databaseUrl.port !== '55432' || databaseUrl.pathname !== '/vision_migration_qa') {
    throw new Error('Refusing database; expected local 127.0.0.1:55432/vision_migration_qa.');
  }

  // Set local URL generation before loading the storage service through routes.
  const mode = process.argv[2] ?? 'run';
  const port = mode === '--serve' ? 58000 : 58000;
  process.env.PORT = String(port);
  process.env.LOCAL_IP = '127.0.0.1';
  // Keep the QA read URL on local uploads even if the developer shell has
  // production storage credentials configured.
  for (const name of [
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_BUCKET_NAME',
    'CLOUDFLARE_R2_PUBLIC_DOMAIN',
    'CLOUDFLARE_R2_PRIVATE_BUCKET_NAME',
  ]) process.env[name] = '';

  const [{ default: express }, { default: v2Routes }, { errorHandler, notFoundHandler }, { prisma }, { DEV_MASTER_UID }] = await Promise.all([
    import('express'),
    import('../src/api/routes/v2'),
    import('../src/api/middleware/errorHandler'),
    import('../src/lib/prisma'),
    import('../src/api/middleware/auth'),
  ]);

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(path.resolve(__dirname, '../../anchor/mobile/src/assets/practice')));
  app.use('/api/v2', v2Routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const stateArg = process.argv[3];
  if (mode === '--cleanup') {
    assert(stateArg, 'Pass the private QA state file produced by --serve.');
    const state = JSON.parse(fs.readFileSync(stateArg, 'utf8')) as FixtureState;
    await prisma.anchor.deleteMany({ where: { id: state.anchorId, userId: state.userId } });
    await prisma.asset.deleteMany({ where: { id: state.assetId, userId: state.userId } });
    if (state.createdUser) await prisma.user.deleteMany({ where: { id: state.userId, authUid: DEV_MASTER_UID } });
    fs.rmSync(stateArg, { force: true });
    console.log('PASS: removed the fixture Anchor and private QA state file.');
    await prisma.$disconnect();
    process.exit(0);
    return;
  }
  assert(mode === 'run' || mode === '--serve', 'Usage: verify-vision-notes-http.ts [run|--serve|--cleanup <state-file>]');

  const server = await new Promise<import('node:http').Server>((resolve, reject) => {
    const instance = app.listen(port, '127.0.0.1', () => resolve(instance));
    instance.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let userId = '';
  let createdUser = false;
  let anchorId = '';
  let assetId = '';
  let visionId = '';
  let noteId = '';
  let sceneId = '';
  let photoUrl = '';
  let outsiderUserId = '';
  let outsiderAnchorId = '';
  try {
    const existingUser = await prisma.user.findUnique({ where: { authUid: DEV_MASTER_UID }, select: { id: true } });
    if (existingUser) userId = existingUser.id;
    else {
      const user = await prisma.user.create({ data: { id: randomUUID(), authUid: DEV_MASTER_UID, email: `vision-http-qa-${randomUUID()}@anchor.invalid`, authProvider: 'email' }, select: { id: true } });
      userId = user.id;
      createdUser = true;
    }
    anchorId = randomUUID();
    await prisma.anchor.create({ data: { id: anchorId, userId, intentionText: 'A life with time to create', category: 'creativity' } });

    const request = async (method: string, route: string, body?: unknown, authenticated = true) => {
      const response = await fetch(`${baseUrl}/api/v2${route}`, {
        method,
        headers: {
          ...(authenticated ? { Authorization: `Bearer ${process.env.DEV_MASTER_TOKEN}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json() as ApiResponse;
      return { status: response.status, payload };
    };
    const unwrap = <T>(result: { status: number; payload: ApiResponse }, expected: number): T => {
      assert.equal(result.status, expected, `Unexpected HTTP status; API code=${result.payload.error?.code ?? 'none'}`);
      assert.equal(result.payload.success, true, `HTTP response was unsuccessful; API code=${result.payload.error?.code ?? 'none'}`);
      return result.payload.data as T;
    };

    const unauthorized = await request('POST', `/anchors/${anchorId}/vision/notes`, {}, false);
    assert.equal(unauthorized.status, 401, 'Vision note route must require authentication.');
    const clientRequestId = randomUUID();
    const presentation = { styleId: 'paper_blush_torn', x: 0.5, y: 0.5, width: 0.3, height: 0.22, rotation: -3, scale: 1, layerOrder: 1 } as const;
    type ReadModel = { id: string; notes?: Array<{ id: string; content: { text: string }; presentation: typeof presentation }>; scenes: Array<{ id: string; caption?: string | null; resolvedImageUrl: string | null }> };
    const created = unwrap<ReadModel>(await request('POST', `/anchors/${anchorId}/vision/notes`, {
      clientRequestId, content: { text: 'Time to create.' }, presentation,
    }), 201);
    assert.equal(created.notes?.length, 1);
    noteId = created.notes![0].id;
    visionId = created.id;
    assert.equal((await prisma.visionNote.count({ where: { id: noteId, visionId, userId } })), 1, 'POST must persist the note in PostgreSQL.');
    console.log('PASS: authenticated HTTP create persisted a UUID-keyed note.');

    const repeated = unwrap<ReadModel>(await request('POST', `/anchors/${anchorId}/vision/notes`, {
      clientRequestId, content: { text: 'Time to create.' }, presentation,
    }), 201);
    assert.equal(repeated.notes?.length, 1);
    assert.equal(repeated.notes?.[0]?.id, noteId, 'A retry must return the same persisted note.');
    const { VISION_NOTE_STYLE_IDS } = await import('../src/domain/v2/vision');
    for (const styleId of VISION_NOTE_STYLE_IDS) {
      const text = `Room to create 🌿\n${styleId}`;
      const result = unwrap<ReadModel>(await request('POST', `/anchors/${anchorId}/vision/notes`, {
        clientRequestId: randomUUID(), content: { text }, presentation: { ...presentation, styleId },
      }), 201);
      const savedStyle = result.notes?.find(note => note.content.text === text);
      assert(savedStyle, `Style ${styleId} was missing from the updated board response.`);
      const stored = await prisma.visionNote.findUnique({ where: { id: savedStyle.id }, select: { text: true, styleId: true } });
      assert.deepEqual(stored, { text, styleId });
      unwrap<ReadModel>(await request('DELETE', `/visions/${visionId}/notes/${savedStyle.id}`), 200);
    }
    const invalid = await request('POST', `/anchors/${anchorId}/vision/notes`, {
      clientRequestId: randomUUID(), content: { text: 'A valid note' }, presentation: { ...presentation, styleId: 'unknown_material' },
    });
    assert.equal(invalid.status, 400);
    console.log('PASS: all 26 styles persisted emoji and multiline text; retries did not duplicate notes; invalid styles were rejected.');

    const moved = { ...presentation, styleId: 'editorial_midnight_editorial', x: 0.62, y: 0.44, rotation: 12, scale: 1.1 };
    const edited = unwrap<ReadModel>(await request('PATCH', `/visions/${visionId}/notes/${noteId}`, {
      content: { text: 'Time to create. A quieter life.' }, presentation: moved,
    }), 200);
    assert.equal(edited.notes?.[0]?.content.text, 'Time to create. A quieter life.');
    assert.deepEqual(edited.notes?.[0]?.presentation, moved);
    const persistedEdit = await prisma.visionNote.findUnique({ where: { id: noteId }, select: { text: true, styleId: true, x: true, y: true, rotation: true, scale: true } });
    assert.deepEqual(persistedEdit, { text: 'Time to create. A quieter life.', styleId: moved.styleId, x: moved.x, y: moved.y, rotation: moved.rotation, scale: moved.scale });
    console.log('PASS: authenticated HTTP edit persisted content, material, and board transform.');

    const photoName = 'celestial_archway_over_a_golden_valley.png';
    const asset = await prisma.asset.create({ data: { userId, storageKey: photoName, mimeType: 'image/png' }, select: { id: true } });
    assetId = asset.id;
    const scene = await prisma.visionScene.create({ data: { id: randomUUID(), visionId, userId, sourceType: 'USER_UPLOAD', assetId: asset.id, sortOrder: 0 }, select: { id: true } });
    sceneId = scene.id;
    const captioned = unwrap<ReadModel>(await request('PATCH', `/visions/${visionId}/scenes/${sceneId}`, { caption: 'A place to begin' }), 200);
    assert.equal(captioned.scenes[0].caption, 'A place to begin');
    assert.ok(
      /^http:\/\/127\.0\.0\.1:58000\/uploads\/celestial_archway_over_a_golden_valley\.png$/.test(captioned.scenes[0].resolvedImageUrl ?? ''),
      'Vision photo read URL must stay on the local HTTP server.',
    );
    photoUrl = captioned.scenes[0].resolvedImageUrl!;
    const image = await fetch(photoUrl);
    assert.equal(image.status, 200, 'The seeded static image URL must be locally reachable.');
    assert.match(image.headers.get('content-type') ?? '', /^image\/png/);
    await image.arrayBuffer(); // Drain the response so the one-shot server can close its connection.
    assert.equal((await prisma.visionScene.findUnique({ where: { id: scene.id }, select: { caption: true } }))?.caption, 'A place to begin');
    console.log('PASS: HTTP caption update persisted and the read model returned a working local photo URL.');

    outsiderUserId = randomUUID();
    await prisma.user.create({ data: { id: outsiderUserId, authUid: `vision-http-outsider-${randomUUID()}`, email: `vision-http-outsider-${randomUUID()}@anchor.invalid`, authProvider: 'email' } });
    outsiderAnchorId = randomUUID();
    await prisma.anchor.create({ data: { id: outsiderAnchorId, userId: outsiderUserId, intentionText: 'Private fixture', category: 'creativity' } });
    const outsiderVision = await prisma.vision.create({ data: { id: randomUUID(), userId: outsiderUserId, anchorId: outsiderAnchorId }, select: { id: true } });
    const outsiderNote = await prisma.visionNote.create({ data: {
      id: randomUUID(), visionId: outsiderVision.id, userId: outsiderUserId, clientRequestId: randomUUID(), text: 'Private note',
      styleId: presentation.styleId, x: 0.5, y: 0.5, width: presentation.width, height: presentation.height, rotation: 0, scale: 1, layerOrder: 0,
    }, select: { id: true } });
    for (const [method, route, body] of [
      ['POST', `/anchors/${outsiderAnchorId}/vision/notes`, { clientRequestId: randomUUID(), content: { text: 'Should not persist' }, presentation }],
      ['PATCH', `/visions/${outsiderVision.id}/notes/${outsiderNote.id}`, { content: { text: 'Should not edit' } }],
      ['DELETE', `/visions/${outsiderVision.id}/notes/${outsiderNote.id}`, undefined],
      ['POST', `/visions/${outsiderVision.id}/notes/${outsiderNote.id}/restore`, {}],
    ] as const) {
      const denied = await request(method, route, body);
      assert.equal(denied.status, 404, `Expected owner-scoped ${method} ${route} to return 404.`);
    }
    assert.equal(await prisma.visionNote.count({ where: { id: outsiderNote.id, text: 'Private note', isArchived: false } }), 1, 'Unauthorized HTTP mutations must leave the outsider note untouched.');
    console.log('PASS: HTTP create/edit/delete/restore are isolated from another authenticated account.');

    const deleted = unwrap<ReadModel>(await request('DELETE', `/visions/${visionId}/notes/${noteId}`), 200);
    assert.equal(deleted.notes?.length, 0);
    assert.equal((await prisma.visionNote.findUnique({ where: { id: noteId }, select: { isArchived: true } }))?.isArchived, true);
    const restored = unwrap<ReadModel>(await request('POST', `/visions/${visionId}/notes/${noteId}/restore`, {}), 200);
    assert.equal(restored.notes?.[0]?.id, noteId);
    assert.equal((await prisma.visionNote.findUnique({ where: { id: noteId }, select: { isArchived: true } }))?.isArchived, false);
    console.log('PASS: authenticated HTTP soft-delete and restore persisted across reads.');

    if (mode === '--serve') {
      const state: FixtureState = { userId, anchorId, assetId, visionId, noteId, sceneId, photoUrl, createdUser };
      const statePath = path.join(os.tmpdir(), `vision-notes-http-qa-${randomUUID()}.json`);
      fs.writeFileSync(statePath, JSON.stringify(state), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      createdUser = false;
      anchorId = '';
      console.log(`Local Vision HTTP QA server: ${baseUrl} (loopback only)`);
      console.log(`Fixture Anchor: ${state.anchorId}`);
      console.log(`Fixture Vision: ${state.visionId}; Note: ${state.noteId}; Photo: ${state.photoUrl}`);
      console.log(`Private cleanup metadata: ${statePath}`);
      console.log('Stop with Ctrl+C, then run --cleanup <state-file>. DEV_MASTER_TOKEN is not printed.');
      await new Promise<void>(resolve => {
        process.once('SIGINT', resolve);
        process.once('SIGTERM', resolve);
      });
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (anchorId) await prisma.anchor.deleteMany({ where: { id: anchorId, userId } });
    if (assetId) await prisma.asset.deleteMany({ where: { id: assetId, userId } });
    if (outsiderAnchorId) await prisma.anchor.deleteMany({ where: { id: outsiderAnchorId, userId: outsiderUserId } });
    if (outsiderUserId) await prisma.user.deleteMany({ where: { id: outsiderUserId } });
    if (createdUser && userId) await prisma.user.deleteMany({ where: { id: userId, authUid: DEV_MASTER_UID } });
    await prisma.$disconnect();
  }
  // Router dependencies own a few process-level timers. This is a one-shot QA
  // runner, so exit after the listener and database connection are closed.
  process.exit(0);
}

type ApiResponse = { success?: boolean; data?: unknown; error?: { code?: string; message?: string } };
type FixtureState = { userId: string; anchorId: string; assetId: string; visionId: string; noteId: string; sceneId: string; photoUrl: string; createdUser: boolean };

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Vision HTTP QA failed.');
  process.exit(1);
});
