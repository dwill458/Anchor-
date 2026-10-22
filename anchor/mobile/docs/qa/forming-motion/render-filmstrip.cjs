// Offline filmstrips from the production scene functions (drawForm + styleStrokes): one row per style,
// one cell per sample time across the whole apply phase. Not native/device acceptance.
// Usage: node render-filmstrip.cjs [intention] [styleId,styleId,...] [outPrefix]
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const sharp = require(path.join(root, 'node_modules/sharp'));
const resolve = Module._resolveFilename;
const load = Module._load;
Module._load = function (name, ...rest) {
  if (name === '@/utils/logger') return { logger: new Proxy({}, { get: () => () => {} }) };
  return load.call(this, name, ...rest);
};
Module._resolveFilename = function (name, parent, ...rest) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const flow = path.join(root, 'src/screens/create/flow');
const { RecordingPainter, fakeMeasure } = require(path.join(flow, '__tests__/recordingPainter.ts'));
const { buildSceneContext } = require(path.join(flow, 'sceneContext.ts'));
const { INK_PALETTE } = require(path.join(flow, 'scenes/sceneTypes.ts'));
const { drawForm, FORM_REVEAL_SECONDS } = require(path.join(flow, 'scenes/FormScene.ts'));
const { STYLE_STROKES } = require(path.join(flow, 'scenes/styleStrokes.ts'));
const { HERO } = require(path.join(flow, 'geometry.ts'));

const intention = process.argv[2] || 'Cold at basketball';
const styles = (process.argv[3] && process.argv[3] !== 'all') ? process.argv[3].split(',') : Object.keys(STYLE_STROKES);
const prefix = process.argv[4] || 'filmstrip';
const ctx = buildSceneContext({ intentionText: intention, category: 'custom', source: 'typed', entry: 'glide', mode: 'first', reduceMotion: false, measure: fakeMeasure }).context;
const times = [0.9, 1.5, 2.1, 2.7, 3.3, FORM_REVEAL_SECONDS + 0.4, FORM_REVEAL_SECONDS + 0.9, FORM_REVEAL_SECONDS + 1.4, FORM_REVEAL_SECONDS + 1.9, FORM_REVEAL_SECONDS + 2.4, FORM_REVEAL_SECONDS + 3.2, FORM_REVEAL_SECONDS + 4.4];
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function shapes(styleId, tf) {
  const p = new RecordingPainter();
  drawForm(p, INK_PALETTE, ctx, { tf, progress: 0.5, slow: false, fade: 1, styleId, styleName: styleId, longerWait: false });
  let m = { x: 0, y: 0, k: 1 };
  const stack = [];
  const xy = (pt) => `${m.x + pt.x * m.k},${m.y + pt.y * m.k}`;
  return p.ops.map((op) => {
    if (op.op === 'save') { stack.push({ ...m }); return ''; }
    if (op.op === 'restore') { m = stack.pop(); return ''; }
    if (op.op === 'translate') { m.x += op.x * m.k; m.y += op.y * m.k; return ''; }
    if (op.op === 'scale') { m.k *= op.sx; return ''; }
    if (op.op === 'polyline') return `<polyline points="${op.points.map(xy).join(' ')}" fill="none" stroke="${op.stroke.color}" stroke-width="${op.stroke.width * m.k}" stroke-opacity="${op.stroke.alpha ?? 1}" stroke-linecap="round" stroke-linejoin="round" ${op.stroke.dash ? `stroke-dasharray="${op.stroke.dash.join(' ')}"` : ''}/>`;
    if (op.op === 'circle') return `<circle cx="${m.x + op.cx * m.k}" cy="${m.y + op.cy * m.k}" r="${op.r * m.k}" fill="${op.fill?.color ?? 'none'}" fill-opacity="${op.fill?.alpha ?? 1}"/>`;
    return '';
  }).join('');
}
const C = 150, R = 130; // cell size, crop half-extent around the hero
const W = times.length * C, labelW = 110;
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${labelW + W}" height="${styles.length * C + 24}"><rect width="100%" height="100%" fill="#0B0E1E"/>`;
times.forEach((tf, c) => { svg += `<text x="${labelW + c * C + 6}" y="16" fill="#9aa" font-family="Arial" font-size="11">${tf.toFixed(2)}s</text>`; });
styles.forEach((id, r) => {
  svg += `<text x="6" y="${24 + r * C + 20}" fill="#F4EDE0" font-family="Arial" font-size="12">${esc(id)}</text>`;
  times.forEach((tf, c) => {
    svg += `<svg x="${labelW + c * C}" y="${24 + r * C}" width="${C}" height="${C}" viewBox="${HERO.x - R} ${HERO.y - R} ${R * 2} ${R * 2}"><rect x="${HERO.x - R}" y="${HERO.y - R}" width="${R * 2}" height="${R * 2}" fill="#12162C"/>${shapes(id, tf)}</svg>`;
  });
});
svg += '</svg>';
const out = path.join(__dirname, prefix);
fs.writeFileSync(`${out}.svg`, svg);
sharp(Buffer.from(svg)).png().toFile(`${out}.png`).then(() => console.log('wrote', `${out}.png`, 'reveal at', FORM_REVEAL_SECONDS.toFixed(2)));
