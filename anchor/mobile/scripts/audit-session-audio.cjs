const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] || path.join(root, 'docs/qa/session-audio-20261025'));
fs.mkdirSync(destination, { recursive: true });
const remoteFiles = Object.fromEntries([...fs.readFileSync(path.join(root, 'src/services/audio/remoteAudio.ts'), 'utf8')
  .matchAll(/^\s+(\w+): \{ file: '([^']+)'/gm)].map(match => [match[1], path.join(root, 'audio-remote/session-audio', match[2])]));
const modules = new Map();
function load(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const module = { exports: {} };
  modules.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = request => {
    if (request === '@/services/audio/remoteAudio') return { remoteAudio: key => remoteFiles[key] };
    const base = request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : path.resolve(path.dirname(filename), request);
    if (/\.(mp3|wav)$/.test(base)) return base;
    if (base.endsWith('.json')) return JSON.parse(fs.readFileSync(base, 'utf8'));
    const source = [base, `${base}.ts`, `${base}.tsx`].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!source) throw new Error(`Cannot resolve ${request} from ${filename}`);
    return load(source);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}
const manifest = load(path.join(root, 'src/services/SessionAudioManifest.ts'));
const guidedTracks = load(path.join(root, 'src/services/visualizeGuidedTracks.ts'));
const guidedPlans = load(path.join(root, 'src/screens/v2/practice/visualize/guided/visualizeGuidedPlan.ts'));
const matrix = [];
for (const [mode, durations] of Object.entries({ focus: [10, 30, 60], deep_prime: [120, 300, 600] })) {
  for (const duration of durations) for (const voice of ['male', 'female', 'warm', 'soothing']) {
    const plan = manifest.resolveSessionAudioPlan({ sessionType: mode, durationSeconds: duration,
      configuration: { guidanceVoice: voice, backgroundAudio: 'ambient', source: 'default' } });
    matrix.push({ id: `audio-${mode}-${duration}-${voice}-ambient`, mode, duration, voice, ambient: true,
      cues: plan.voiceCues.map(cue => ({ phase: cue.phaseId, start: duration - cue.triggerAtRemainingMs / 1000,
        file: cue.track.asset, gain: cue.track.playbackGain, includesBed: !!cue.track.includesBed })),
      ambientFile: plan.ambientTrack?.asset || null, fallback: plan.fallbackUsed });
  }
}
for (const [duration, track] of [
  [60, 'glimpse'],
  [180, 'immerse'],
  [600, 'embody'],
]) for (const [index, voice] of ['male', 'female'].entries()) {
  const beatMap = JSON.parse(fs.readFileSync(path.join(root, `src/screens/v2/practice/visualize/beatmaps/beatmap_${track}.json`), 'utf8'));
  const guidedPlan = guidedPlans.buildGuidedPlan({ durationSeconds: duration, guide: index ? 'lina' : 'dominic', imageCount: 3 });
  matrix.push({ id: `audio-visualize-${duration}-${voice}-ambient`, mode: 'visualize', duration, voice, ambient: true,
    playbackDuration: beatMap.voices[index ? 'lina' : 'dominic'].audio_duration ?? beatMap.audio_duration, track, phrases: beatMap.voices[index ? 'lina' : 'dominic'].phrases,
    captions: guidedPlan.captions, anchorStartMs: guidedPlan.anchorStartMs, sealAtMs: guidedPlan.sealAtMs, returnStartMs: guidedPlan.returnStartMs,
    cues: [{ phase: 'mix', start: 0, file: guidedTracks.getGuidedTrackAsset(track, index ? 'lina' : 'dominic'), gain: 1, includesBed: true }], ambientFile: null });
}
const files = [...new Set(matrix.flatMap(item => [...item.cues.map(cue => cue.file), ...(item.ambientFile ? [item.ambientFile] : [])]))];
const assets = files.map(file => {
  if (!file || !fs.existsSync(file)) return { file, missing: true };
  const probe = cp.spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=sample_rate,channels', '-of', 'json', file], { encoding: 'utf8' });
  const decode = cp.spawnSync('ffmpeg', ['-hide_banner', '-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' });
  const metadata = JSON.parse(probe.stdout);
  return { file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), duration: Number(metadata.format.duration),
    bytes: Number(metadata.format.size), streams: metadata.streams, decodeOk: decode.status === 0 && !decode.stderr.trim(), decodeErrors: decode.stderr.trim() };
});
for (const row of matrix) for (let index = 0; index < row.cues.length; index++) {
  const cue = row.cues[index];
  cue.duration = assets.find(asset => asset.file === cue.file)?.duration;
  cue.availableSeconds = (row.cues[index + 1]?.start ?? row.playbackDuration ?? row.duration) - cue.start;
  cue.exceedsCueWindow = cue.duration > cue.availableSeconds + 0.1;
}
fs.writeFileSync(path.join(destination, 'matrix.json'), JSON.stringify({ createdAt: new Date().toISOString(), matrix, assets }, null, 2));
const audit = { combinations: matrix.length, assets: assets.length, missing: assets.filter(item => item.missing), decodeFailures: assets.filter(item => item.decodeOk === false),
  cueOverruns: matrix.flatMap(row => row.cues.filter(cue => cue.exceedsCueWindow).map(cue => ({ id: row.id, ...cue }))) };
fs.writeFileSync(path.join(destination, 'source-audit.json'), JSON.stringify(audit, null, 2));
console.log(JSON.stringify(audit, null, 2));
if (process.argv.includes('--check') && (audit.missing.length || audit.decodeFailures.length || audit.cueOverruns.length)) process.exitCode = 1;
