// Offline samples from the production scene functions; not native/device acceptance.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const resolve = Module._resolveFilename;
const load = Module._load;
Module._load = function (name, ...rest) {
  // Scene generation logs are irrelevant to offline painting; avoid native logging setup.
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
const { drawForm } = require(path.join(flow, 'scenes/FormScene.ts'));
const baseline = execFileSync('git', ['show', 'HEAD:anchor/mobile/src/screens/create/flow/scenes/FormScene.ts'], { cwd: root, encoding: 'utf8' });
const before = new Module(path.join(flow, 'scenes/FormScene.before.ts'), module);
before.filename = path.join(flow, 'scenes/FormScene.before.ts');
before.paths = Module._nodeModulePaths(root);
before._compile(ts.transpileModule(baseline, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, before.filename);
const ctx = buildSceneContext({ intentionText: 'Cold at basketball', category: 'custom', source: 'typed', entry: 'glide', mode: 'first', reduceMotion: false, measure: fakeMeasure }).context;
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function panel(draw, tf) {
  const p = new RecordingPainter();
  draw(p, INK_PALETTE, ctx, { tf, progress: 0.5, slow: false, fade: 1, styleId: 'alloy' });
  let matrix = { x: 0, y: 0, k: 1 };
  const stack = [];
  const xy = (pt) => `${matrix.x + pt.x * matrix.k},${matrix.y + pt.y * matrix.k}`;
  return '<rect width="390" height="844" fill="#12162C"/>' + p.ops.map((op) => {
    if (op.op === 'save') { stack.push({ ...matrix }); return ''; }
    if (op.op === 'restore') { matrix = stack.pop(); return ''; }
    if (op.op === 'translate') { matrix.x += op.x * matrix.k; matrix.y += op.y * matrix.k; return ''; }
    if (op.op === 'scale') { matrix.k *= op.sx; return ''; }
    if (op.op === 'polyline') return `<polyline points="${op.points.map(xy).join(' ')}" fill="none" stroke="${op.stroke.color}" stroke-width="${op.stroke.width * matrix.k}" stroke-opacity="${op.stroke.alpha ?? 1}" stroke-linecap="round" stroke-linejoin="round" ${op.stroke.dash ? `stroke-dasharray="${op.stroke.dash.join(' ')}"` : ''}/>`;
    if (op.op === 'circle') return `<circle cx="${matrix.x + op.cx * matrix.k}" cy="${matrix.y + op.cy * matrix.k}" r="${op.r * matrix.k}" fill="${op.fill?.color ?? 'none'}" fill-opacity="${op.fill?.alpha ?? 1}"/>`;
    if (op.op === 'text') return `<text x="${op.x}" y="${op.y}" text-anchor="middle" font-family="Arial" font-size="${op.style.font.size}" fill="${op.style.color}" opacity="${op.style.alpha}">${escape(op.value)}</text>`;
    return '';
  }).join('');
}
const times = [0.7, 1.6, 4];
let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1170" height="1688" viewBox="0 0 1170 1688">';
[before.exports.drawForm, drawForm].forEach((draw, row) => times.forEach((tf, col) => {
  svg += `<g transform="translate(${col * 390},${row * 844})">${panel(draw, tf)}<text x="20" y="40" fill="#F4EDE0" font-family="Arial" font-size="16">${row ? 'After' : 'Before'} · ${tf}s</text></g>`;
}));
fs.writeFileSync(path.join(__dirname, 'forming-comparison.svg'), svg + '</svg>');
console.log('Saved forming-comparison.svg');
