/*
 * Builds the official onboarding mark from the supplied logo without redrawing
 * or resampling its artwork. Only the contiguous white studio background is
 * made transparent, then the mark is tightly cropped with a small safety pad.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const input = path.resolve(
  __dirname,
  '../../../.codex-remote-attachments/019f87d1-17a7-72d0-9dec-b58a060af183/a24e8260-577a-447d-96a1-82b9a38d3e04/1-Photo-1.jpg',
);
const output = path.resolve(
  __dirname,
  '../src/assets/images/anchor-visual-goal-setting-logo.png',
);

const isWhiteBackdrop = (r, g, b) =>
  r > 225 && g > 225 && b > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 16;

async function main() {
  const source = sharp(input).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const background = new Uint8Array(width * height);
  const queue = [];

  const addIfBackdrop = (x, y) => {
    const pixel = y * width + x;
    if (background[pixel]) return;
    const offset = pixel * channels;
    if (!isWhiteBackdrop(data[offset], data[offset + 1], data[offset + 2])) return;
    background[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = 0; x < width; x += 1) {
    addIfBackdrop(x, 0);
    addIfBackdrop(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addIfBackdrop(0, y);
    addIfBackdrop(width - 1, y);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const pixel = queue[index];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) addIfBackdrop(x - 1, y);
    if (x < width - 1) addIfBackdrop(x + 1, y);
    if (y > 0) addIfBackdrop(x, y - 1);
    if (y < height - 1) addIfBackdrop(x, y + 1);
  }

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let pixel = 0; pixel < background.length; pixel += 1) {
    if (background[pixel]) {
      data[pixel * channels + 3] = 0;
      continue;
    }
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  const pad = 18;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropWidth = Math.min(width - left, maxX - minX + 1 + pad * 2);
  const cropHeight = Math.min(height - top, maxY - minY + 1 + pad * 2);

  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(data, { raw: { width, height, channels } })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(output);

  console.log(`${output} (${cropWidth}x${cropHeight})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
