// Asset contact sheet for review; this is not a device screenshot.
const sharp = require('sharp');
const path = require('path');
(async () => {
  const assetRoot = path.resolve(__dirname, '../../../src/assets/practice');
  const modes = ['focus', 'deepfocus', 'visualize', 'release'];
  const layers = [];
  for (let i = 0; i < modes.length; i++) {
    const x = (i % 2) * 620 + 20;
    const y = Math.floor(i / 2) * 410 + 20;
    layers.push({ input: await sharp(path.join(assetRoot, `practice-${modes[i]}.jpg`)).resize(600, 350, { fit: 'cover' }).toBuffer(), left: x, top: y });
    const label = Buffer.from(`<svg width="600" height="40"><text x="0" y="28" fill="#f4efe6" font-family="sans-serif" font-size="22">${modes[i]}</text></svg>`);
    layers.push({ input: label, left: x, top: y + 354 });
  }
  await sharp({ create: { width: 1240, height: 820, channels: 3, background: '#101b2d' } }).composite(layers).jpeg({ quality: 90 }).toFile(path.join(__dirname, 'artwork-set.jpg'));
})();
