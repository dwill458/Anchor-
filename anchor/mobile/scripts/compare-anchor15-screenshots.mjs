/**
 * Pixel-diff the Anchor 1.5 native captures against approved reference captures.
 *
 * Usage:
 *   npm run test:anchor15:visual -- --reference path/to/reference --actual path/to/native
 *
 * Captures use a 390 × 844 dp viewport at the same pixel density. The command
 * normalizes to that baseline unless explicitly asked with --width/--height, then flags a screen
 * when more than 4% of pixels differ by more than 12 RGB values. Keep reference
 * and native captures at the same density to enforce the design spec's ±4 dp
 * layout and ±1 dp typography review targets.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SCREENS = [
  '02-onboarding',
  '04-set-intention',
  '32-distilling',
  '03-choose-structure',
  '27-draw-structure',
  '28-trace-structure',
  '06-refine-style',
  '30-generate',
  '16-profile',
  '17-settings',
  '29-select-expression',
  '22-save-progress',
  '26-sign-in',
  '25-prime-your-anchor',
  '09-sanctuary-home',
];

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith('--')) continue;
  const value = process.argv[index + 1]?.startsWith('--') ? true : process.argv[index + 1] ?? true;
  args.set(key.slice(2), value);
  if (value !== true) index += 1;
}

const referenceDir = args.get('reference');
const actualDir = args.get('actual');
const outputDir = args.get('out') ?? 'artifacts/anchor15-visual-diff';
const allowMissing = args.has('allow-missing');
const maxChangedRatio = Number(args.get('max-changed-ratio') ?? 0.04);
const pixelThreshold = Number(args.get('pixel-threshold') ?? 12);
const width = args.has('width') ? Number(args.get('width')) : 390;
const height = args.has('height') ? Number(args.get('height')) : 844;

if (!referenceDir || !actualDir) {
  console.error('Pass --reference <directory> and --actual <directory>.');
  process.exit(2);
}

fs.mkdirSync(outputDir, { recursive: true });
let failures = 0;

for (const screen of SCREENS) {
  const reference = path.join(referenceDir, `${screen}.png`);
  const actual = path.join(actualDir, `${screen}.png`);
  if (!fs.existsSync(reference) || !fs.existsSync(actual)) {
    const missing = [!fs.existsSync(reference) && 'reference', !fs.existsSync(actual) && 'actual']
      .filter(Boolean)
      .join(', ');
    console.log(`SKIP ${screen}: missing ${missing} capture`);
    if (!allowMissing) failures += 1;
    continue;
  }

  const referenceImage = sharp(reference).ensureAlpha();
  const actualImage = sharp(actual).ensureAlpha();
  const referenceMetadata = await referenceImage.metadata();
  const targetWidth = width ?? referenceMetadata.width;
  const targetHeight = height ?? referenceMetadata.height;

  if (!targetWidth || !targetHeight) {
    console.error(`FAIL ${screen}: unable to determine capture dimensions.`);
    failures += 1;
    continue;
  }

  const rawOptions = { resolveWithObject: true };
  const [referenceRaw, actualRaw] = await Promise.all([
    referenceImage.resize(targetWidth, targetHeight, { fit: 'fill' }).raw().toBuffer(rawOptions),
    actualImage.resize(targetWidth, targetHeight, { fit: 'fill' }).raw().toBuffer(rawOptions),
  ]);

  let changedPixels = 0;
  let totalDelta = 0;
  const diff = Buffer.alloc(referenceRaw.data.length);
  for (let pixel = 0; pixel < referenceRaw.data.length; pixel += 4) {
    const delta = Math.max(
      Math.abs(referenceRaw.data[pixel] - actualRaw.data[pixel]),
      Math.abs(referenceRaw.data[pixel + 1] - actualRaw.data[pixel + 1]),
      Math.abs(referenceRaw.data[pixel + 2] - actualRaw.data[pixel + 2]),
    );
    totalDelta += delta;
    const changed = delta > pixelThreshold;
    if (changed) changedPixels += 1;
    diff[pixel] = changed ? 255 : 0;
    diff[pixel + 1] = 0;
    diff[pixel + 2] = changed ? 80 : 0;
    diff[pixel + 3] = changed ? 230 : 0;
  }

  const totalPixels = referenceRaw.data.length / 4;
  const changedRatio = changedPixels / totalPixels;
  const meanDelta = totalDelta / totalPixels;
  await sharp(diff, { raw: { width: targetWidth, height: targetHeight, channels: 4 } })
    .png()
    .toFile(path.join(outputDir, `${screen}.diff.png`));

  const status = changedRatio <= maxChangedRatio ? 'PASS' : 'FAIL';
  console.log(`${status} ${screen}: ${(changedRatio * 100).toFixed(2)}% changed, mean Δ ${meanDelta.toFixed(2)}`);
  if (status === 'FAIL') failures += 1;
}

process.exitCode = failures > 0 ? 1 : 0;
