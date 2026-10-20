/* Static QA of the actual earned/locked React SVG components; no native animation claims. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'docs/qa/milestone-assets-20261020');
fs.mkdirSync(out, { recursive: true });
const geometryFile = path.join(root, 'src/milestones/masterAssets.ts');
function load(file, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => imports[name] ?? require(name) }, { filename: file });
  return module.exports;
}
const geometry = load(geometryFile);
const tag = name => ({ children, testID, ...props }) => React.createElement(name, props, children);
const svg = { __esModule: true, default: tag('svg'), Circle: tag('circle'), ClipPath: tag('clipPath'), Defs: tag('defs'), G: tag('g'),
  LinearGradient: tag('linearGradient'), Path: tag('path'), RadialGradient: tag('radialGradient'), Stop: tag('stop') };
const { MasterEmblem } = load(path.join(root, 'src/components/v2/milestones/MasterEmblem.tsx'), {
  'react-native-svg': svg,
  'react-native-reanimated': { __esModule: true, default: { createAnimatedComponent: component => component } },
  '@/milestones/masterAssets': geometry,
});
const names = ['Full Strength', 'First Practice', 'Goal Reached', 'First Glimpse'];
async function main() {
  const tiles = [];
  for (const [index, milestoneId] of Object.keys(geometry.MASTER_ASSETS).entries()) {
    for (const [row, state] of ['earned', 'locked'].entries()) {
      const markup = renderToStaticMarkup(React.createElement(MasterEmblem, { milestoneId, state, size: 264 })).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      fs.writeFileSync(path.join(out, `${milestoneId}-${state}.svg`), markup);
      tiles.push({ input: await sharp(Buffer.from(markup)).png().toBuffer(), left: index * 300 + 18, top: row * 330 + 48 });
    }
  }
  const labels = `<svg width="1200" height="730"><rect width="1200" height="730" fill="#F7F3EA"/><text x="28" y="28" font-family="Arial" font-size="14" letter-spacing="3" fill="#142630">ANCHOR · MASTER EMBLEMS · EARNED / EMBOSSED LOCKED</text>${names.map((name, i) => `<text x="${150 + i * 300}" y="337" text-anchor="middle" font-family="Georgia" font-size="20" fill="#142630">${name}</text>`).join('')}<text x="28" y="714" font-family="Arial" font-size="13" fill="#73746C">Actual React SVG geometry · static QA render · native motion and frame pacing require device validation</text></svg>`;
  await sharp(Buffer.from(labels)).composite(tiles).png().toFile(path.join(out, 'master-emblems.png'));
  process.stdout.write(`${out}\n`);
}
main().catch(error => { process.stderr.write(String(error)); process.exitCode = 1; });
