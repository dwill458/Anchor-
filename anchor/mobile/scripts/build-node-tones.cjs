// Use the production synthesizer so bundled mapping tones retain the exact sound recipe.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../src/utils/audio/nodeTone.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const toneModule = { exports: {} };
new Function('exports', 'module', compiled)(toneModule.exports, toneModule);
const { encodeWav, synthNodeTone, nodeFrequency, nodeToneKey } = toneModule.exports;
const directory = path.resolve(__dirname, '../src/assets/sounds/node-tones');
const validate = process.argv.includes('--validate');
if (!validate) fs.mkdirSync(directory, { recursive: true });
for (let cell = 1; cell <= 10; cell += 1) {
  const file = path.join(directory, `${nodeToneKey(cell)}.wav`);
  const bytes = Buffer.from(encodeWav(synthNodeTone(nodeFrequency(cell))));
  if (validate) {
    if (!fs.readFileSync(file).equals(bytes)) throw new Error(`Tone differs from synthesizer: ${file}`);
  } else {
    fs.writeFileSync(file, bytes);
  }
}
console.log(`${validate ? 'Verified' : 'Generated'} 10 mapping tones from the production synthesizer.`);
