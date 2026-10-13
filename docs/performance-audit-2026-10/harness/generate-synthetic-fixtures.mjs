#!/usr/bin/env node
/**
 * Creates deterministic, non-user synthetic Anchor JSON fixtures for local
 * adapter/model validation. It does not call Expo, SecureStore, or the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(process.argv[2] ?? path.join(here, 'generated'));
const targetChars = Number(process.argv[3] ?? 719_217);
const secureChunkChars = 1_800; // Mirrors the current adapter's JS chunk size.

if (!Number.isSafeInteger(targetChars) || targetChars < 2_000) {
  throw new Error('target chars must be a safe integer >= 2000');
}

function syntheticAnchor(index) {
  const n = String(index + 1).padStart(3, '0');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M${index % 40},10 L50,90 L${(index % 40) + 10},10 Z"/></svg>`;
  return {
    id: `synthetic-anchor-${n}`,
    localId: `synthetic-local-${n}`,
    userId: 'synthetic-account',
    intentionText: `Synthetic intention fixture ${n}; no real user writing.`,
    category: ['desire', 'health', 'career', 'creativity'][index % 4],
    distilledLetters: ['A', 'N', 'C'],
    baseSigilSvg: svg,
    structureVariant: 'balanced',
    isCharged: index % 2 === 0,
    activationCount: index % 7,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };
}

function createFixture(count, exactChars) {
  const anchors = Array.from({ length: count }, (_, index) => syntheticAnchor(index));
  let json = JSON.stringify(anchors);
  if (exactChars != null) {
    const delta = exactChars - json.length;
    if (delta < 0) throw new Error(`base ${count}-Anchor fixture exceeds target (${json.length} > ${exactChars})`);
    // JSON escaping leaves ASCII spaces unchanged. Spread the padding across
    // SVG strings so the large fixture stays close to the historical average.
    const base = Math.floor(delta / count);
    let remainder = delta % count;
    for (const anchor of anchors) {
      const amount = base + (remainder-- > 0 ? 1 : 0);
      const closePath = anchor.baseSigilSvg.lastIndexOf('"/>');
      const syntheticGeometry = ' M50 50 L51 51'.repeat(Math.floor(amount / 14));
      const geometryRemainder = ' '.repeat(amount % 14);
      anchor.baseSigilSvg = `${anchor.baseSigilSvg.slice(0, closePath)}${syntheticGeometry}${geometryRemainder}${anchor.baseSigilSvg.slice(closePath)}`;
    }
    json = JSON.stringify(anchors);
    if (json.length !== exactChars) throw new Error(`fixture calibration failed: ${json.length} != ${exactChars}`);
  }
  return { anchors, json };
}

fs.mkdirSync(outputDir, { recursive: true });
const one = createFixture(1, 10_000);
const many = createFixture(72, targetChars);
const outputs = [
  { name: 'anchors-1.synthetic.json', ...one },
  { name: 'anchors-72.synthetic.json', ...many },
];

const report = [];
for (const fixture of outputs) {
  const destination = path.join(outputDir, fixture.name);
  fs.writeFileSync(destination, fixture.json, { encoding: 'utf8', flag: 'w' });
  const bytes = Buffer.byteLength(fixture.json, 'utf8');
  const roundTrip = JSON.parse(fs.readFileSync(destination, 'utf8'));
  if (roundTrip.length !== fixture.anchors.length) throw new Error('fixture round-trip count mismatch');
  report.push({
    fixture: fixture.name,
    anchors: roundTrip.length,
    jsonChars: fixture.json.length,
    utf8Bytes: bytes,
    secureChunksAt1800Chars: Math.max(1, Math.ceil(fixture.json.length / secureChunkChars)),
    provenance: 'synthetic-only; size model; no app/native adapter exercised',
  });
}
console.log(JSON.stringify({ outputDir, fixtures: report }, null, 2));
