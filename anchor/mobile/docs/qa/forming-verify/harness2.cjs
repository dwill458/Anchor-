// Independent dense-frame harness. Usage: node harness.cjs <new|old> "<intention>" <styles|all> <dt> <outdir> [savePng=1]
const fs = require('fs'), path = require('path'), Module = require('module');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const sharp = require(path.join(root, 'node_modules/sharp'));
const resolve = Module._resolveFilename, load = Module._load;
Module._load = function (name, ...rest) {
  if (name === '@/utils/logger') return { logger: new Proxy({}, { get: () => () => {} }) };
  return load.call(this, name, ...rest);
};
Module._resolveFilename = function (name, parent, ...rest) {
  return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, parent, ...rest);
};
require.extensions['.txt'] = require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const flow = path.join(root, 'src/screens/create/flow');
const { RecordingPainter, fakeMeasure } = require(path.join(flow, '__tests__/recordingPainter.ts'));
const { buildSceneContext } = require(path.join(flow, 'sceneContext.ts'));
const { INK_PALETTE } = require(path.join(flow, 'scenes/sceneTypes.ts'));
const which = process.argv[2];
const formMod = which === 'old' ? require(path.join(__dirname, 'FormScene.old.abs.ts.txt')) : require(path.join(flow, 'scenes/FormScene.ts'));
const { drawForm } = formMod;
const { STYLE_STROKES } = require(path.join(flow, 'scenes/styleStrokes.ts'));
const { HERO } = require(path.join(flow, 'geometry.ts'));
const intention = process.argv[3];
const styles = process.argv[4] === 'all' ? Object.keys(STYLE_STROKES) : process.argv[4].split(',');
const dt = parseFloat(process.argv[5] || '0.1');
const outdir = process.argv[6];
const save = (process.argv[7] ?? '1') === '1';
const NONDEFAULT = (id) => id !== 'velvet-ember'; // the picker default; used only to exercise longerWait text
fs.mkdirSync(outdir, { recursive: true });
const ctx = buildSceneContext({ intentionText: intention, category: 'custom', source: 'typed', entry: 'glide', mode: 'first', reduceMotion: false, measure: fakeMeasure }).context;
const BG = '#14162B', R = 130, S = 260;
function svgFor(p) {
  let m = { x: 0, y: 0, k: 1 }; const stack = [];
  const xy = (pt) => `${m.x + pt.x * m.k},${m.y + pt.y * m.k}`;
  const body = p.ops.map((op) => {
    if (op.op === 'save') { stack.push({ ...m }); return ''; }
    if (op.op === 'restore') { m = stack.pop(); return ''; }
    if (op.op === 'translate') { m.x += op.x * m.k; m.y += op.y * m.k; return ''; }
    if (op.op === 'scale') { m.k *= op.sx; return ''; }
    if (op.op === 'polyline') return `<polyline points="${op.points.map(xy).join(' ')}" fill="none" stroke="${op.stroke.color}" stroke-width="${op.stroke.width * m.k}" stroke-opacity="${op.stroke.alpha ?? 1}" stroke-linecap="round" stroke-linejoin="round" ${op.stroke.dash ? `stroke-dasharray="${op.stroke.dash.join(' ')}"` : ''}/>`;
    if (op.op === 'circle') return `<circle cx="${m.x + op.cx * m.k}" cy="${m.y + op.cy * m.k}" r="${op.r * m.k}" fill="${op.fill?.color ?? 'none'}" fill-opacity="${op.fill?.alpha ?? 1}"/>`;
    return '';
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="${HERO.x - R} ${HERO.y - R} ${R * 2} ${R * 2}"><rect x="${HERO.x - R}" y="${HERO.y - R}" width="${R * 2}" height="${R * 2}" fill="${BG}"/>${body}</svg>`;
}
(async () => {
  const results = {};
  for (const id of styles) {
    const frames = []; const times = []; const caps = []; const opCounts = [];
    for (let tf = 3.3; tf <= 10.0001; tf += dt) {
      const p = new RecordingPainter();
      drawForm(p, INK_PALETTE, ctx, { tf, progress: 0.5, slow: false, fade: 1, styleId: id, styleName: id, longerWait: NONDEFAULT(id) });
      const counts = {}; p.ops.forEach((o) => { counts[o.op] = (counts[o.op] || 0) + 1; });
      opCounts.push(counts); caps.push(p.of('text').map((t) => t.value).join('|'));
      const buf = await sharp(Buffer.from(svgFor(p))).removeAlpha().raw().toBuffer();
      if (save) await sharp(buf, { raw: { width: S, height: S, channels: 3 } }).png().toFile(path.join(outdir, `${id}_${tf.toFixed(2).padStart(5, '0')}.png`));
      frames.push(buf); times.push(+tf.toFixed(3));
    }
    // changed-pixel counts between consecutive frames, and "static run relative to run-start" metric
    const changed = (a, b, thr) => { let n = 0, mx = 0; for (let i = 0; i < a.length; i += 3) { const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])); if (d > thr) n++; if (d > mx) mx = d; } return [n, mx]; };
    const consec = frames.slice(1).map((f, i) => changed(frames[i], f, 10)[0]);
    const strong = frames.slice(1).map((f, i) => changed(frames[i], f, 60)[0]);
    const mad = frames.slice(1).map((f, i) => { let t=0; for (let k=0;k<f.length;k++) t+=Math.abs(f[k]-frames[i][k]); return t/f.length; });
    results[id] = { times, caps, consec, opCounts };
    const THR = 25; // pixels changed (>10 levels) vs run start
    let best = 0, bestStart = 0, i = 0;
    while (i < frames.length) { let j = i + 1; while (j < frames.length && changed(frames[i], frames[j], 10)[0] < THR) j++; const len = times[Math.min(j, frames.length - 1)] - times[i]; if (len > best) { best = len; bestStart = times[i]; } i = Math.max(j - 1, i + 1); }
    results[id].longestStatic = +best.toFixed(2); results[id].longestStaticStart = bestStart;
    // peak motion in the apply phase after the reveal
    results[id].strong=strong; results[id].mad=mad;
    const srt=(a)=>a.slice().sort((x,y)=>x-y); console.log(id.padEnd(14),'dt',dt,'strong(>60) px min/median:',Math.min(...strong),srt(strong)[strong.length>>1],'| mean|d| min/median:',Math.min(...mad).toFixed(3),srt(mad)[mad.length>>1].toFixed(3),'|| ' );
    if (0) console.log(id.padEnd(14), 'longest static run(s) <', THR, 'px vs run-start:', best.toFixed(2), 'from', bestStart.toFixed(2), '| min consec changed px:', Math.min(...consec), 'median', consec.slice().sort((a, b) => a - b)[consec.length >> 1]);
  }
  fs.writeFileSync(path.join(outdir, `results_${which}.json`), JSON.stringify(results));
})();
