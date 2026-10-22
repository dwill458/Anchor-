// Use the production synthesizer so bundled mapping tones retain the exact sound recipe.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const sourcePath = path.resolve(__dirname, '../src/utils/audio/nodeTone.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const toneModule = { exports: {} };
new Function('exports', 'module', compiled)(toneModule.exports, toneModule);
const { encodeWav, synthNodeTone, nodeFrequency, nodeToneKey } = toneModule.exports;
const directory = path.resolve(__dirname, '../src/assets/sounds/node-tones');
const validate = process.argv.includes('--validate');
const android = process.argv.includes('--android');
if (!validate) fs.mkdirSync(directory, { recursive: true });
for (let cell = 1; cell <= 10; cell += 1) {
  const file = path.join(directory, `${nodeToneKey(cell)}.wav`);
  const bytes = Buffer.from(encodeWav(synthNodeTone(nodeFrequency(cell))));
  if (validate) {
    if (!fs.readFileSync(file).equals(bytes)) throw new Error(`Tone differs from synthesizer: ${file}`);
  } else {
    fs.writeFileSync(file, bytes);
  }
  if (android) {
    const mp3File = file.replace(/\.wav$/, '.mp3');
    const args = validate
      ? ['-v', 'error', '-i', mp3File, '-ar', '22050', '-ac', '1', '-f', 's16le', 'pipe:1']
      : ['-v', 'error', '-i', file, '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', '192k', '-y', mp3File];
    const result = spawnSync('ffmpeg', args);
    if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr.toString());
    if (validate) {
      const samples = synthNodeTone(nodeFrequency(cell));
      if (result.stdout.length !== samples.length * 2) throw new Error(`Android tone duration differs: ${mp3File}`);
      let squaredError = 0;
      for (let n = 0; n < samples.length; n++) {
        squaredError += (result.stdout.readInt16LE(n * 2) / 32767 - samples[n]) ** 2;
      }
      if (Math.sqrt(squaredError / samples.length) > 0.02) throw new Error(`Android tone waveform differs: ${mp3File}`);
    }
  }
}
console.log(`${validate ? 'Verified' : 'Generated'} 10 mapping tones${android ? ' and Android MP3 copies' : ''} from the production synthesizer.`);
