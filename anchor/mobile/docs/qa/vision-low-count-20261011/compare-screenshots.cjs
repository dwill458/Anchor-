const path = require('path');
const sharp = require('../../../node_modules/sharp');

// Compare the same native QA fixtures, captured before and after on the S24 Ultra.
async function sheet(name, cases, columns) {
  const tileWidth = 300;
  const tileHeight = 482;
  const composites = [];
  for (const [index, item] of cases.entries()) {
    const filename = `${item}.png`;
    const screenshot = await sharp(path.join(__dirname, filename))
      .extract({ left: 0, top: 170, width: 1440, height: 2200 })
      .resize(tileWidth, 458).png().toBuffer();
    const label = Buffer.from(`<svg width="300" height="24"><rect width="300" height="24" fill="#fff"/><text x="8" y="17" font-size="13" font-family="Arial" fill="#111">${item}</text></svg>`);
    const left = (index % columns) * tileWidth;
    const top = Math.floor(index / columns) * tileHeight;
    composites.push({ input: label, left, top }, { input: screenshot, left, top: top + 24 });
  }
  await sharp({ create: { width: columns * tileWidth, height: Math.ceil(cases.length / columns) * tileHeight,
    channels: 3, background: '#ddd' } }).composite(composites).jpeg({ quality: 92 }).toFile(path.join(__dirname, `${name}.jpg`));
}

(async () => {
  for (const surface of ['home', 'details']) {
    const cases = ['portrait', 'landscape', 'square'].flatMap(aspect => [1, 2].flatMap(count =>
      ['before', 'after'].map(version => `${version}-${surface}-${count}-${aspect}`)));
    await sheet(`${surface}-comparison`, cases, 4);
  }
  await sheet('collage-comparison', ['home-6-mixed', 'details-6-mixed', 'home-10'].flatMap(surface =>
    ['before', 'after'].map(version => `${version}-${surface}`)), 2);
  await sheet('mixed-pair-comparison', ['home-2-mixed', 'details-2-mixed'].flatMap(surface =>
    ['before', 'after'].map(version => `${version}-${surface}`)), 2);
})();
