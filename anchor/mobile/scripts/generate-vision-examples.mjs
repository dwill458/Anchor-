#!/usr/bin/env node
/**
 * Generates the 33 Vision entrance example pictures with OpenAI and writes
 * src/assets/vision/examples/<category>/<1|2|3>.webp, then rebuilds the manifest.
 *
 * Run from anchor/mobile (PowerShell):
 *   $env:OPENAI_API_KEY="sk-..."; node scripts/generate-vision-examples.mjs
 * Options:
 *   --only health,custom   only these categories
 *   --force                regenerate files that already exist
 *   --model gpt-image-2.5-flare   (default)
 *
 * Existing files are skipped, so it is safe to re-run after a failure.
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const outRoot = path.join(mobileRoot, 'src', 'assets', 'vision', 'examples');
const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); } catch {
  sharp = createRequire(path.resolve(mobileRoot, '..', '..', 'backend', 'package.json'))('sharp');
}

const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const value = name => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const KEY = process.env.OPENAI_API_KEY?.trim();
if (!KEY) { console.error('Set OPENAI_API_KEY first.'); process.exit(1); }
const MODEL = value('model') || 'gpt-image-2.5-flare';
const ONLY = value('only')?.split(',').map(s => s.trim());
const FORCE = flag('force');

const PREFIX = 'Film photograph, natural light, warm muted tones, subtle grain, candid documentary feel, 4:5 portrait. ' +
  'Faces not visible or softly out of focus. No text, no logos, no watermarks. Scene: ';

const SCENES = {
  health: [
    'a runner seen from behind mid-stride on a coastal path at sunrise, mist over the sea',
    'hands slicing vegetables on a wooden board in a sunlit kitchen, bowl of fruit, glass of water',
    'a hiker from behind on a rocky summit at sunrise above a sea of clouds'],
  abundance: [
    'a coffee cup and closed laptop on a wooden terrace table overlooking the sea at golden hour',
    'hands holding house keys in front of an open front door, light-filled hallway',
    'a long outdoor dinner table at golden hour with string lights, people softly out of focus'],
  career: [
    "a glass studio door with morning light, a person's hand on the handle, team blurred inside",
    'a conference room table after a meeting, notebooks and a laptop, window light, figures blurred',
    'a tidy desk by a window at late afternoon, sketches and a monitor, a chair pushed back'],
  relationships: [
    'two coffee cups on a bed tray, crumpled sheets, morning light, two pairs of feet at the edge of frame',
    'a lively kitchen gathering at night, glasses and plates, people softly out of focus, warm lamps',
    'two people from behind walking down a lamplit street at dusk, close together'],
  creativity: [
    'a large finished painting leaning against a studio wall, brushes and jars, afternoon light',
    'a stack of the same hardcover book on a bookshop table, a hand reaching for one, no readable text',
    'headphones resting on a mixing desk in a small studio, warm lamp light, a guitar in the background'],
  spirituality: [
    'a cup of tea on a wooden porch rail at first light, mist over a field',
    'a forest path after rain with light through the trees, a figure far ahead from behind',
    'an open journal and pen on a windowsill at dusk, handwriting unreadable, soft lamp light'],
  family: [
    'a crowded family dinner table from the end, plates and candles, people softly out of focus',
    "a parent's hands holding a picture book beside a child's bed, night lamp, no faces",
    'a backyard lawn at golden hour with a sprinkler arc and kids blurred in motion'],
  learning: [
    'a cafe table abroad with a menu and espresso, a hand gesturing, street blurred behind',
    'hands holding a rolled diploma on stone steps, families blurred on a lawn behind',
    'a laptop on a desk at night with an out-of-focus screen glow, notes and a mug, city lights outside'],
  adventure: [
    'an airplane window view of a coastline, a hand resting on the sill, a passport on the tray',
    'a car dashboard and open window on a winding coast road, sunlight, sea to one side',
    'a small tent on a mountain ridge at sunset with a camp stove steaming'],
  desire: [
    'hands unwrapping a gift box with tissue paper on a wooden table, soft window light',
    'a person from behind in the doorway of an empty light-filled apartment',
    'a person from behind on a balcony at golden hour overlooking a city, arms relaxed'],
  custom: [
    'a person from behind at a big window at golden hour, the city or landscape beyond',
    'morning light through sheer curtains onto a bed and a cup of coffee',
    'an old camera on a table beside printed photographs spread out, window light'],
};

const exists = async file => { try { await access(file); return true; } catch { return false; } };

async function generate(prompt) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      // 1024x1280 is 4:5 and divisible by 16, as GPT-Image 2.5 requires for custom sizes.
      body: JSON.stringify({ model: MODEL, prompt, size: '1024x1280', n: 1 }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.data?.[0]?.b64_json) return Buffer.from(json.data[0].b64_json, 'base64');
    const message = json.error?.message || `HTTP ${res.status}`;
    if (res.status === 400 && /size/i.test(message)) throw new Error(`Size rejected by ${MODEL}: ${message}`);
    if (attempt === 3 || res.status === 401) throw new Error(message);
    await new Promise(r => setTimeout(r, 2000 * attempt));
  }
}

const jobs = [];
for (const [category, scenes] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.includes(category)) continue;
  scenes.forEach((scene, i) => jobs.push({ category, n: i + 1, prompt: PREFIX + scene }));
}

let done = 0, skipped = 0, failed = 0;
async function worker() {
  while (jobs.length) {
    const job = jobs.shift();
    const dir = path.join(outRoot, job.category);
    const file = path.join(dir, `${job.n}.webp`);
    if (!FORCE && await exists(file)) { skipped++; continue; }
    try {
      const png = await generate(job.prompt);
      await mkdir(dir, { recursive: true });
      const webp = await sharp(png).resize(900, 1125, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
      await writeFile(file, webp);
      done++; console.log(`ok   ${job.category}/${job.n}.webp  ${Math.round(webp.length / 1024)} KB`);
    } catch (error) {
      failed++; console.error(`fail ${job.category}/${job.n}: ${error.message}`);
      if (/401|Size rejected/.test(error.message)) process.exit(1);
    }
  }
}
console.log(`Generating with ${MODEL}...`);
await Promise.all([worker(), worker(), worker()]);
console.log(`\nGenerated ${done}, skipped ${skipped}, failed ${failed}.`);
execFileSync(process.execPath, [path.join(here, 'generate-vision-example-manifest.mjs')], { stdio: 'inherit', cwd: mobileRoot });
