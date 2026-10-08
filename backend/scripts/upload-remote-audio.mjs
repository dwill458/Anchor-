#!/usr/bin/env node
/**
 * Uploads the mobile app's remote session audio to the public R2 bucket.
 *
 *   node --env-file=.env scripts/upload-remote-audio.mjs [--dry-run]
 *
 * Source: anchor/mobile/audio-remote/session-audio/*.mp3 (names carry a content hash, see
 * anchor/mobile/src/services/audio/remoteAudio.ts). Objects that already exist with the same
 * size are skipped, so the script is safe to re-run. Objects are immutable: a changed file gets
 * a new name rather than overwriting an old one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.resolve(here, '../../anchor/mobile/audio-remote/session-audio');
const prefix = 'session-audio';
const dryRun = process.argv.includes('--dry-run');

const need = (...keys) => {
  for (const key of keys) {
    const value = process.env[key]?.trim().replace(/^"|"$/g, '');
    if (value) return value;
  }
  throw new Error(`Missing ${keys.join(' or ')}`);
};

const bucket = need('CLOUDFLARE_R2_BUCKET_NAME');
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${need('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: need('CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_ACCESS_KEY'),
    secretAccessKey: need('CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'CLOUDFLARE_R2_SECRET'),
  },
});

const files = readdirSync(sourceDir).filter((name) => name.endsWith('.mp3')).sort();
console.log(`${files.length} files -> bucket "${bucket}" (${prefix}/)${dryRun ? ' [dry run]' : ''}`);

for (const name of files) {
  const key = `${prefix}/${name}`;
  const bytes = statSync(path.join(sourceDir, name)).size;
  let existing = null;
  try {
    existing = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound') throw error;
  }
  if (existing?.ContentLength === bytes) {
    console.log(`skip   ${key} (already uploaded)`);
    continue;
  }
  if (dryRun) {
    console.log(`would  ${key} (${(bytes / 1e6).toFixed(1)} MB)`);
    continue;
  }
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: readFileSync(path.join(sourceDir, name)),
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  console.log(`put    ${key} (${(bytes / 1e6).toFixed(1)} MB)`);
}

// Verify the way the app reads them: a presigned GET (what GET /api/v2/session-audio/:file redirects to).
if (!dryRun) {
  for (const name of files) {
    const key = `${prefix}/${name}`;
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
    const response = await fetch(url, { headers: { Range: 'bytes=0-0' } });
    const total = Number(response.headers.get('content-range')?.split('/')[1]);
    const ok = response.status === 206 && total === statSync(path.join(sourceDir, name)).size;
    console.log(`${ok ? 'ok    ' : 'FAIL  '} ${key} (${response.status}, ${total} bytes)`);
    if (!ok) process.exitCode = 1;
  }
}
