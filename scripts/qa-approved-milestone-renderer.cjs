// Independent static React primitive serialization/pixel QA; not native-device verification.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const mobile = path.join(root, 'anchor/mobile');
const resolve = name => require.resolve(name, { paths: [mobile] });
const ts = require(resolve('typescript'));
const React = require(resolve('react'));
const { renderToStaticMarkup } = require(resolve('react-dom/server'));
const { chromium } = require('playwright');
const output = path.join(root, 'docs/qa/milestones-integration-20261021');
fs.mkdirSync(output, { recursive: true });
const tags = { default: 'svg', Circle: 'circle', ClipPath: 'clipPath', Defs: 'defs', Ellipse: 'ellipse', G: 'g', Line: 'line', LinearGradient: 'linearGradient', Path: 'path', Polygon: 'polygon', Polyline: 'polyline', RadialGradient: 'radialGradient', Rect: 'rect', Stop: 'stop' };
const svgPrimitives = Object.fromEntries(Object.entries(tags).map(([name, tag]) => [name, props => {
  const { children, accessible, testID, ...attrs } = props;
  if (tag === 'svg') attrs.xmlns = 'http://www.w3.org/2000/svg';
  return React.createElement(tag, attrs, children);
}]));
svgPrimitives.__esModule = true;
const cache = new Map();
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = request => {
    if (request === 'react-native-svg') return svgPrimitives;
    if (request === 'react') return React;
    if (request.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), request);
      for (const ext of ['.ts', '.tsx', '.json']) if (fs.existsSync(target + ext)) return ext === '.json' ? JSON.parse(fs.readFileSync(target + ext)) : load(target + ext);
    }
    return require(resolve(request));
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  }}).outputText, filename);
  return mod.exports;
}
const { ApprovedMilestoneSvg } = load(path.join(mobile, 'src/milestones/approvedAssetsRenderer.tsx'));
const { APPROVED_MILESTONE_ASSETS: assets } = load(path.join(mobile, 'src/milestones/approvedAssets.ts'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const uri = svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 1000 }, deviceScaleFactor: 1 });
    const results = [], illustrations = {};
    for (const [id, asset] of Object.entries(assets)) {
      illustrations[id] = {};
      for (const state of ['earned', 'locked']) {
        const source = fs.readFileSync(path.join(root, `design/milestones/approved-20261021/svg/${state}/${asset.slug}.svg`), 'utf8');
        const rendered = renderToStaticMarkup(React.createElement(ApprovedMilestoneSvg, { definitionId: id, state, size: 256 }));
        illustrations[id][state] = uri(rendered);
        const sourceHash = hash(Buffer.from(source));
        if (sourceHash !== asset.sourceSha256[state]) throw new Error(`Source SHA mismatch ${id} ${state}`);
        for (const size of [64, 96, 256]) for (const background of ['#F5F1E8', '#101D28']) {
          const pixels = await page.evaluate(async ({ source, rendered, size, background }) => {
            const raster = async (url, bg) => {
              const image = new Image(); image.src = url; await image.decode();
              const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
              ctx.drawImage(image, 0, 0, size, size); return ctx.getImageData(0, 0, size, size).data;
            };
            const a = await raster(source, background), b = await raster(rendered, background);
            let differingChannels = 0, maxChannelDelta = 0;
            for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); if (delta) differingChannels++; maxChannelDelta = Math.max(maxChannelDelta, delta); }
            const transparent = await raster(rendered);
            let borderPixels = 0;
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x === 0 || y === 0 || x === size - 1 || y === size - 1) && transparent[(y * size + x) * 4 + 3]) borderPixels++;
            return { differingChannels, maxChannelDelta, borderPixels };
          }, { source: uri(source), rendered: uri(rendered), size, background });
          results.push({ id, state, size, background, sourceHash, ...pixels });
        }
      }
    }
    // Check actual rendered per-instance gradient/clip namespaces together in one document.
    const instances = renderToStaticMarkup(React.createElement(React.Fragment, null,
      ...[0, 1].map(key => React.createElement(ApprovedMilestoneSvg, { key, definitionId: 'strength.full', state: 'earned', size: 96 }))));
    await page.setContent(instances);
    const references = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id]')].map(n => n.id);
      const missing = [...document.querySelectorAll('svg *')].flatMap(n => [...n.attributes].flatMap(a => [...a.value.matchAll(/url\(#([^)]*)\)/g)].map(m => m[1]))).filter(id => !document.getElementById(id));
      return { ids: ids.length, duplicateIds: ids.length - new Set(ids).size, missingReferences: missing };
    });
    const style = `<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#e8e3da;font:13px system-ui;color:#142630}h1{margin:0 0 8px;font-size:22px}p{margin:0 0 16px}.row{display:grid;grid-template-columns:180px repeat(4,1fr);align-items:center;gap:8px;margin:6px 0}.tile{display:flex;align-items:center;justify-content:center;gap:14px;padding:8px;background:#F5F1E8;min-height:112px}.dark{background:#101D28;color:#f5f1e8}.label{font-size:12px}.strength{display:grid;grid-template-columns:140px 1fr 1fr;gap:10px;align-items:center;margin:10px 0}.strength .tile{min-height:284px}img{display:block}</style>`;
    const pairs = (id, state, sizes) => sizes.map(size => `<img alt="${id} ${state} ${size}" src="${illustrations[id][state]}" width="${size}" height="${size}">`).join('');
    await page.setContent(`${style}<h1>Approved React primitive rendering · all 20 milestones</h1><p>Earned / Locked on cream and navy · 96px · static serialization, not native-device verification</p>${Object.keys(assets).map(id => `<div class="row"><b>${id}</b><div class="tile">${pairs(id,'earned',[96])}</div><div class="tile">${pairs(id,'locked',[96])}</div><div class="tile dark">${pairs(id,'earned',[96])}</div><div class="tile dark">${pairs(id,'locked',[96])}</div></div>`).join('')}`);
    await page.screenshot({ path: path.join(output, 'collection-react-primitives-96.png'), fullPage: true });
    await page.setViewportSize({ width: 1160, height: 1000 });
    await page.setContent(`${style}<h1>Strength earned / locked · 64, 96 and 256px</h1><p>Approved package appearance preserved exactly. Package Strength is ivory/gold; no recolouring.</p>${Object.keys(assets).filter(id => id.startsWith('strength.')).map(id => `<div class="strength"><b>${id}</b><div class="tile">${pairs(id,'earned',[64,96,256])}</div><div class="tile dark">${pairs(id,'earned',[64,96,256])}</div><span></span><div class="tile">${pairs(id,'locked',[64,96,256])}</div><div class="tile dark">${pairs(id,'locked',[64,96,256])}</div></div>`).join('')}`);
    await page.screenshot({ path: path.join(output, 'strength-react-primitives-scales.png'), fullPage: true });
    const summary = { scope: 'Current ApprovedMilestoneSvg React renderer with native SVG component boundary mapped to equivalent browser SVG tags. Verifies serialized geometry, references, palette and browser pixels; does not verify react-native-svg native drawing or device performance.', checkedAssets: 40, pixelComparisons: results.length,
      mismatches: results.filter(r => r.differingChannels), clippedOuterBorder: results.filter(r => r.borderPixels), references, results };
    fs.writeFileSync(path.join(output, 'static-renderer-parity.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ checkedAssets: 40, comparisons: results.length, mismatches: summary.mismatches.length, clippedBorders: summary.clippedOuterBorder.length, references }));
    if (summary.mismatches.length || summary.clippedOuterBorder.length || references.duplicateIds || references.missingReferences.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
