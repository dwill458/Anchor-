#!/usr/bin/env node
/**
 * Regenerates the Android launcher-icon and splash-screen assets from the
 * master artwork in `assets/`.
 *
 * Why this exists: `android/` is checked in and EAS does not run
 * `expo prebuild` for Android, so the files under `android/app/src/main/res`
 * are what actually ship. This script keeps the source artwork in `assets/`
 * and the generated native resources in sync, and — more importantly — it
 * enforces the Android sizing rules that were being violated:
 *
 *   Adaptive icon (108dp canvas)
 *     - 72dp  (66.7%) is the largest area any launcher mask will show.
 *     - 66dp  (61.1%) is the safe zone that survives every mask shape.
 *     Artwork drawn larger than the mask gets sliced off at the edges.
 *
 *   Splash screen icon (288dp canvas, androidx core-splashscreen)
 *     - 160dp is the maximum art diameter when an icon background colour is
 *       set; the system draws a circular plate behind the icon, and anything
 *       wider than that pokes out of the plate as a hard-edged square.
 *
 * Usage: node scripts/generate-launch-assets.mjs
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const assets = path.join(mobileRoot, 'assets');
const res = path.join(mobileRoot, 'android/app/src/main/res');

/** Splash window + splash icon plate colour. Must match `splashscreen_background`. */
const SPLASH_BACKGROUND = '#0F1419';

/**
 * Fraction of the 108dp canvas the full-colour artwork covers. Slightly wider
 * than the 72dp viewport so the artwork's own purple bleeds under every mask
 * shape and meets `iconBackground` without a seam, while the head itself stays
 * comfortably inside the mask.
 */
const ADAPTIVE_ART_SCALE = 0.72;
const LAUNCH_ICON_SOURCE = 'anchor-icon-v2.png';
const ADAPTIVE_FOREGROUND_OUTPUT = 'anchor-adaptive-foreground-v4.png';
const MONOCHROME_OUTPUT = 'anchor-monochrome-v2.png';
/** 66dp of the 108dp canvas — survives circular masks, used for the themed layer. */
const ADAPTIVE_SAFE_ZONE = 66 / 108;

/** Splash canvas is 288dp; art is 160dp so it fits inside the system icon plate. */
const SPLASH_CANVAS_DP = 288;
const SPLASH_ICON_DP = 160;

const MIPMAP_DENSITIES = [
  ['mdpi', 108],
  ['hdpi', 162],
  ['xhdpi', 216],
  ['xxhdpi', 324],
  ['xxxhdpi', 432],
];

const DRAWABLE_DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

/** Transparent 1x1 used as the base of a fully transparent canvas. */
function transparentCanvas(size) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

/** Crops `input` to the bounding box of its non-transparent pixels. */
async function trimToAlpha(input) {
  return sharp(input).trim({ threshold: 1 }).png().toBuffer();
}

/**
 * Scales `input` so its longest edge is `fraction` of `size`, then centres it
 * on a transparent `size` x `size` canvas.
 */
async function fitInside(input, size, fraction) {
  const target = Math.round(size * fraction);
  const scaled = await sharp(input)
    .resize(target, target, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return transparentCanvas(size)
    .composite([{ input: scaled, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/** Circular alpha mask of the given size, as a greyscale PNG. */
function circleMask(size) {
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`;
  return Buffer.from(svg);
}

/** Returns the current runtime-2.0 master icon artwork. */
async function launchIconArtwork() {
  return sharp(path.join(assets, LAUNCH_ICON_SOURCE)).png().toBuffer();
}

/**
 * The full-colour adaptive foreground. The source is fitted to the adaptive
 * icon viewport so the rounded artwork remains intact under circle and
 * squircle launcher masks.
 */
async function buildForeground() {
  return fitInside(await launchIconArtwork(), 1024, ADAPTIVE_ART_SCALE);
}

/**
 * The monochrome (themed icon) layer.
 *
 * The previous asset was an anchor glyph — a different mark from the app icon
 * itself — and it stood 73% tall, so devices with themed icons enabled showed
 * a cropped anchor while devices without them showed the head/brain icon.
 * Derive the silhouette from the real icon artwork instead, so both render the
 * same mark, and fit it to the safe zone.
 */
async function buildMonochrome() {
  const inner = await launchIconArtwork();

  // Invert the luminance ramp so the dark anchor strokes become opaque while
  // the cream paper and gold star stay transparent. The ramp keeps edges
  // anti-aliased instead of producing a hard threshold.
  const LO = 90;
  const HI = 130;
  const slope = 255 / (HI - LO);
  const darkMask = await sharp(inner)
    .removeAlpha()
    .greyscale()
    .blur(2)
    .linear(-slope, HI * slope)
    .png()
    .toBuffer();
  const sourceAlpha = await sharp(inner).ensureAlpha().extractChannel(3).png().toBuffer();
  const alpha = await sharp(darkMask)
    .composite([{ input: sourceAlpha, blend: 'multiply' }])
    .extractChannel(0)
    .png()
    .toBuffer();

  const { width: aw, height: ah } = await sharp(alpha).metadata();
  const glyph = await sharp({
    create: { width: aw, height: ah, channels: 3, background: '#ffffff' },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();

  return fitInside(await trimToAlpha(glyph), 1024, ADAPTIVE_SAFE_ZONE);
}

/**
 * The splash icon.
 *
 * The master anchor artwork is an opaque square. Rendered at 200dp on the
 * 288dp splash canvas it overflowed the system's circular icon plate, so the
 * plate showed up as a ring around a hard-edged square — the "two icons" that
 * users were seeing. Mask it to a circle so the art and the plate coincide.
 */
async function buildSplashLogo() {
  const src = path.join(assets, 'anchor-gold.png');
  const size = 1024;
  const square = await sharp(src).resize(size, size, { fit: 'cover' }).png().toBuffer();
  return sharp(square)
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function writeMipmaps(name, master) {
  for (const [density, size] of MIPMAP_DENSITIES) {
    const out = path.join(res, `mipmap-${density}`, `${name}.webp`);
    await sharp(master).resize(size, size).webp({ lossless: true }).toFile(out);
  }
}

/**
 * Mirrors what expo-splash-screen's prebuild step emits: a 288dp canvas filled
 * with the splash background colour, with the icon centred at `imageWidth`.
 */
async function writeSplashDrawables(master) {
  for (const [density, scale] of DRAWABLE_DENSITIES) {
    const canvas = Math.round(SPLASH_CANVAS_DP * scale);
    const icon = Math.round(SPLASH_ICON_DP * scale);
    const scaled = await sharp(master).resize(icon, icon).png().toBuffer();
    const png = await sharp({
      create: { width: canvas, height: canvas, channels: 4, background: SPLASH_BACKGROUND },
    })
      .composite([{ input: scaled, gravity: 'centre' }])
      .png()
      .toBuffer();

    for (const dir of [`drawable-${density}`, `drawable-night-${density}`]) {
      await fs.writeFile(path.join(res, dir, 'splashscreen_logo.png'), png);
    }
  }
}

async function main() {
  const foreground = await buildForeground();
  const monochrome = await buildMonochrome();
  const splash = await buildSplashLogo();

  // Master artwork, consumed by app.json so `expo prebuild` reproduces this.
  await fs.writeFile(path.join(assets, ADAPTIVE_FOREGROUND_OUTPUT), foreground);
  await fs.writeFile(path.join(assets, MONOCHROME_OUTPUT), monochrome);
  await fs.writeFile(path.join(assets, 'anchor-splash-logo.png'), splash);

  // Checked-in native resources, which is what actually ships.
  await writeMipmaps('ic_launcher_foreground', foreground);
  await writeMipmaps('ic_launcher_monochrome', monochrome);
  await writeSplashDrawables(splash);

  console.log('Launch assets regenerated.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
