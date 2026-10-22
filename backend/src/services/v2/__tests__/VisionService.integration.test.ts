/**
 * Real, unmocked Vision integration test.
 *
 * Unlike every other test in this repo, this one does NOT mock Prisma,
 * VisionService, or StorageService. It exercises the actual production-wiring
 * contract end to end:
 *
 *   real image bytes -> real StorageService upload -> real Asset row
 *   -> real Vision + VisionScene rows -> a *fresh* VisionService read
 *   -> a resolvable image URL that never depended on anything client-local.
 *
 * It also proves the backend's ownership check the way the mobile P0 exposed
 * it: creating a Vision scene against a fabricated/unowned assetId must fail,
 * not silently succeed.
 *
 * SAFETY: this suite is opt-in and does nothing by default. Ordinary
 * `npm test` runs skip it, because jestEnvironment.ts (setupFiles) pins
 * DATABASE_URL to a deterministic, unreachable value for every other test in
 * this repo, and there is no test/staging Postgres provisioned for this repo.
 * `.env`'s DATABASE_URL is the real Anchor database (this repo has no
 * separate staging environment) - it must never be used here.
 *
 * To run this for real:
 *   1. Point VISION_INTEGRATION_DATABASE_URL at a REAL, DISPOSABLE Postgres
 *      database that already has this schema applied (e.g. a local Postgres
 *      you migrated with `npx prisma migrate deploy`). Never point it at the
 *      database in this repo's own .env.
 *   2. Run: VISION_INTEGRATION_DATABASE_URL=postgresql://... npx jest
 *      VisionService.integration.test.ts
 *
 * The suite creates exactly one disposable user/anchor/asset/vision/scene,
 * all tagged with a unique per-run id, and deletes every row (and the one
 * local uploaded file) it created in `afterAll`, whether or not the tests
 * pass. It never touches Cloudflare R2: CLOUDFLARE_* credentials are removed
 * before StorageService is loaded, forcing its existing local-disk fallback
 * so no real object storage is touched.
 */
import fs from 'fs';
import path from 'path';

const REAL_DB_URL = process.env.VISION_INTEGRATION_DATABASE_URL;
const RUN_ID = `vision-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const maybeDescribe = REAL_DB_URL ? describe : describe.skip;

if (!REAL_DB_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '[VisionService.integration.test] Skipped: set VISION_INTEGRATION_DATABASE_URL to a real, ' +
      'disposable Postgres database (with this schema already migrated) to run it. ' +
      'It will never run against this repo\'s own DATABASE_URL.',
  );
}

maybeDescribe('VisionService (real Postgres + real StorageService, opt-in)', () => {
  // A tiny, valid 1x1 transparent PNG. This is the deterministic "test image"
  // substituting for the physical OS picker boundary, per the task's test contract.
  const PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let visionService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uploadImageAssetFromBuffer: any;

  let userId: string;
  let anchorId: string;
  let createdAssetIds: string[] = [];
  let createdVisionId: string | null = null;
  let uploadedObjectKeys: string[] = [];

  beforeAll(async () => {
    // Must happen before requiring the prisma module: PrismaClient reads
    // DATABASE_URL at construction time, and jestEnvironment.ts already pinned
    // it to a deterministic, unreachable value for this process.
    process.env.DATABASE_URL = REAL_DB_URL;
    process.env.NODE_ENV = 'test';
    // Force StorageService's existing local-disk fallback; never touch real R2.
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    prisma = require('../../../lib/prisma').prisma;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    visionService = require('../VisionService').visionService;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    uploadImageAssetFromBuffer = require('../../StorageService').uploadImageAssetFromBuffer;

    const user = await prisma.user.create({
      data: {
        email: `${RUN_ID}@test.anchor.invalid`,
        authProvider: 'email',
        authUid: `authuid-${RUN_ID}`,
        displayName: 'Vision Integration Test User',
      },
    });
    userId = user.id;

    const anchor = await prisma.anchor.create({
      data: {
        userId,
        intentionText: 'Vision integration test anchor',
        category: 'career',
      },
    });
    anchorId = anchor.id;
  }, 30000);

  afterAll(async () => {
    if (!prisma) return;

    // Delete in dependency order, scoped only to rows this run created.
    if (createdVisionId) {
      await prisma.visionScene.deleteMany({ where: { visionId: createdVisionId } });
      await prisma.vision.deleteMany({ where: { id: createdVisionId, userId } });
    }
    if (createdAssetIds.length > 0) {
      await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds }, userId } });
    }
    if (anchorId) {
      await prisma.anchor.deleteMany({ where: { id: anchorId, userId } });
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }

    for (const objectKey of uploadedObjectKeys) {
      const localPath = path.join(process.cwd(), 'uploads', objectKey);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }

    await prisma.$disconnect();
  }, 30000);

  it('persists a real upload through Asset -> Vision -> VisionScene and survives a fresh fetch', async () => {
    const buffer = Buffer.from(PNG_BASE64, 'base64');

    // Real StorageService call (local-disk fallback, not R2) - not mocked.
    const uploaded = await uploadImageAssetFromBuffer(buffer, userId, 'vision-assets', 0, {
      visibility: 'private',
      contentType: 'image/png',
    });
    uploadedObjectKeys.push(uploaded.objectKey);

    // Real Asset row, owned by the real test user.
    const asset = await visionService.createAsset(userId, {
      storageKey: uploaded.objectKey,
      mimeType: 'image/png',
      fileSizeBytes: buffer.length,
    });
    createdAssetIds.push(asset.id);
    expect(asset.id).toBeTruthy();

    // Real Vision + VisionScene, created via the server-issued Asset id only.
    const created = await visionService.createAnchorVision(userId, anchorId, {
      description: 'A real, persisted future.',
      scenes: [{ assetId: asset.id, sourceType: 'USER_UPLOAD' }],
    });
    createdVisionId = created.id;

    expect(created.scenes).toHaveLength(1);
    expect(created.scenes[0].assetId).toBe(asset.id);
    expect(created.scenes[0].resolvedImageUrl).toBeTruthy();
    // The resolved URL must never be the raw internal storage key, or a
    // client-local file:// URI - it must be a real, independently resolvable
    // reference the same way it would be after an app restart.
    expect(created.scenes[0].resolvedImageUrl).not.toBe(uploaded.objectKey);
    expect(created.scenes[0].resolvedImageUrl).not.toMatch(/^file:\/\//);

    // Simulate "leave and return" / app restart: an entirely fresh read, not
    // reusing any in-memory state from the create call above.
    const reloaded = await visionService.getAnchorVision(userId, anchorId);
    expect(reloaded).not.toBeNull();
    expect(reloaded.id).toBe(created.id);
    expect(reloaded.scenes).toHaveLength(1);
    expect(reloaded.scenes[0].assetId).toBe(asset.id);
    expect(reloaded.scenes[0].resolvedImageUrl).toBeTruthy();
  }, 30000);

  it('rejects Vision creation against a fabricated/unowned assetId (the exact P0 failure mode)', async () => {
    await expect(
      visionService.createAnchorVision(userId, anchorId, {
        description: 'Should never persist',
        scenes: [{ assetId: 'cand-1-fabricated-stock-photo-id', sourceType: 'USER_UPLOAD' }],
      }),
    ).rejects.toThrow(/Asset not found/i);

    // And it must not have silently created a Vision anyway.
    const vision = await prisma.vision.findFirst({ where: { anchorId, userId, status: 'ACTIVE' } });
    if (vision) {
      // Only true if the previous test already created the real Vision; either
      // way, no scene should reference the fabricated id.
      const scenes = await prisma.visionScene.findMany({ where: { visionId: vision.id } });
      expect(scenes.every((s: { assetId: string | null }) => s.assetId !== 'cand-1-fabricated-stock-photo-id')).toBe(
        true,
      );
    }
  }, 30000);
});
