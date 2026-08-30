#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(MOBILE_ROOT, '..', '..');
const SOURCE_ROOT = join(MOBILE_ROOT, 'assets', 'audio-source', 'visualize');
const FEMALE_SOURCE_ROOT = join(SOURCE_ROOT, 'voices', 'female', 'en-US');
const MALE_SOURCE_ROOT = join(SOURCE_ROOT, 'voices', 'male', 'en-US');
const AMBIENT_SOURCE_ROOT = join(SOURCE_ROOT, 'ambient');
const OUTPUT_ROOT = join(MOBILE_ROOT, 'src', 'assets', 'sounds', 'visualize');
const MANIFEST_PATH = join(MOBILE_ROOT, 'src', 'services', 'visualizeAudioManifest.ts');
const DURATIONS_PATH = join(MOBILE_ROOT, 'src', 'services', 'visualizeAudioDurations.generated.ts');
const AUDIT_JSON_PATH = join(REPO_ROOT, 'docs', 'audit', 'visualize-audio-assets.json');
const AUDIT_MARKDOWN_PATH = join(REPO_ROOT, 'docs', 'audit', 'visualize-audio-assets.md');
const MODE = process.argv[2] ?? 'build';

const normalizePath = (value) => value.replaceAll('\\', '/');
const round = (value, places = 3) => Number(Number(value).toFixed(places));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function findExecutable(name, explicitPath) {
  if (explicitPath && existsSync(explicitPath)) return explicitPath;
  const where = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [name], { encoding: 'utf8' });
  const first = where.status === 0 ? where.stdout.split(/\r?\n/).find(Boolean) : null;
  if (first && existsSync(first)) return first;

  if (process.platform === 'win32') {
    const packages = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
    if (existsSync(packages)) {
      const stack = [packages];
      while (stack.length > 0) {
        const directory = stack.pop();
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const candidate = join(directory, entry.name);
          if (entry.isDirectory()) stack.push(candidate);
          if (entry.isFile() && entry.name.toLowerCase() === `${name}.exe`) return candidate;
        }
      }
    }
  }
  throw new Error(`${name} was not found. Install FFmpeg or set ${name.toUpperCase()}_PATH.`);
}

const FFMPEG = findExecutable('ffmpeg', process.env.FFMPEG_PATH);
const FFPROBE = findExecutable('ffprobe', process.env.FFPROBE_PATH);

function run(executable, args, options = {}) {
  try {
    return execFileSync(executable, args, {
      cwd: MOBILE_ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error?.stderr?.toString?.() ?? '';
    throw new Error(`${basename(executable)} failed for ${args.join(' ')}\n${stderr}`);
  }
}

function runWithStderr(executable, args) {
  const result = spawnSync(executable, args, {
    cwd: MOBILE_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${basename(executable)} failed for ${args.join(' ')}\n${result.stderr}`);
  }
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function parseManifest() {
  const source = readFileSync(MANIFEST_PATH, 'utf8');
  const cues = [];
  const cuePattern = /cue\('([^']+)',\s*(60|180|300),\s*'([^']+)',\s*([\d.]+),/g;
  for (const match of source.matchAll(cuePattern)) {
    cues.push({ id: match[1], durationSeconds: Number(match[2]), phase: match[3], startSeconds: Number(match[4]) });
  }
  const assets = new Map();
  const assetPattern = /([A-Z0-9_]+):\s*voiceAssets\(require\('([^']+)'\),\s*require\('([^']+)'\)\)/g;
  for (const match of source.matchAll(assetPattern)) {
    assets.set(match[1], {
      female: resolve(dirname(MANIFEST_PATH), match[2]),
      male: resolve(dirname(MANIFEST_PATH), match[3]),
    });
  }
  const ambient = new Map();
  const ambientPattern = /(60|180|300):\s*require\('([^']*visualize_ambient_[^']+)'\)/g;
  for (const match of source.matchAll(ambientPattern)) {
    ambient.set(Number(match[1]), resolve(dirname(MANIFEST_PATH), match[2]));
  }
  return { source, cues, assets, ambient };
}

function sourceCueId(path) {
  const match = basename(path).match(/(VIZ_(?:1|3|5)M_(?:ARRIVE|SEE|FEEL|SEAL|RETURN)_\d+)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function discoverSourceFiles() {
  const files = [];
  for (const [kind, directory] of [
    ['female', FEMALE_SOURCE_ROOT],
    ['male', MALE_SOURCE_ROOT],
    ['ambient', AMBIENT_SOURCE_ROOT],
  ]) {
    if (!existsSync(directory)) throw new Error(`Missing source directory: ${directory}`);
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isFile()) files.push({ path, name, kind, cueId: kind === 'ambient' ? null : sourceCueId(path) });
    }
  }
  return files.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

function sourceMaps(sourceFiles) {
  const female = new Map();
  const male = new Map();
  for (const file of sourceFiles) {
    if (file.kind === 'female' && file.cueId) female.set(file.cueId, file.path);
    if (file.kind === 'male' && file.cueId) male.set(file.cueId, file.path);
  }
  // The supplied 1m female file contains the wrong, 9.8-second script. The 3m
  // recording is a verified identical-script alternate and fits the 4-second gap.
  female.set('VIZ_1M_ARRIVE_01', female.get('VIZ_3M_ARRIVE_01'));
  return { female, male };
}

function probe(path) {
  const output = run(FFPROBE, [
    '-v', 'error',
    '-show_entries', 'format=duration,bit_rate,format_name:stream=codec_name,sample_rate,channels,channel_layout,bit_rate',
    '-of', 'json',
    path,
  ], { quiet: true });
  const parsed = JSON.parse(output);
  const stream = parsed.streams?.[0] ?? {};
  return {
    format: parsed.format?.format_name ?? null,
    codec: stream.codec_name ?? null,
    durationSeconds: Number(parsed.format?.duration ?? 0),
    sampleRateHz: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
    channelLayout: stream.channel_layout ?? null,
    bitRateBps: Number(stream.bit_rate ?? parsed.format?.bit_rate ?? 0),
  };
}

function loudnessAndSilence(path) {
  const output = runWithStderr(FFMPEG, [
    '-hide_banner', '-nostats', '-i', path,
    '-af', 'loudnorm=I=-16:TP=-1:LRA=7:print_format=json,silencedetect=noise=-50dB:d=0.02',
    '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null',
  ]);
  const jsonMatches = [...output.matchAll(/\{[\s\S]*?\}/g)];
  const loudness = jsonMatches.length > 0 ? JSON.parse(jsonMatches.at(-1)[0]) : {};
  const silenceStarts = [...output.matchAll(/silence_start:\s*([\d.]+)/g)].map(match => Number(match[1]));
  const silenceEnds = [...output.matchAll(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g)]
    .map(match => ({ end: Number(match[1]), duration: Number(match[2]) }));
  return {
    integratedLufs: Number(loudness.input_i),
    truePeakDbtp: Number(loudness.input_tp),
    loudnessRangeLu: Number(loudness.input_lra),
    leadingSilenceSeconds: silenceStarts[0] <= 0.01 && silenceEnds[0] ? silenceEnds[0].end : 0,
    trailingSilenceSeconds: silenceEnds.at(-1)?.duration ?? 0,
  };
}

function inspect(path) {
  const media = probe(path);
  const levels = loudnessAndSilence(path);
  run(FFMPEG, ['-v', 'error', '-i', path, '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null'], { quiet: true });
  return {
    ...media,
    ...levels,
    bytes: statSync(path).size,
    sha256: sha256(path),
    decodable: true,
    clipping: levels.truePeakDbtp >= 0,
  };
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const VOICE_TRIM_FILTER = [
  'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB:start_silence=0.15',
  'areverse',
  'silenceremove=start_periods=1:start_duration=0.05:start_threshold=-50dB:start_silence=0.30',
  'areverse',
].join(',');
const VOICE_PROCESS_FILTER = [
  VOICE_TRIM_FILTER,
  // Gentle RMS compression evens the female/male source-level gap; a fast
  // second stage catches isolated plosives so loudness can rise without clips.
  'acompressor=threshold=0.03:ratio=3:attack=12:release=160:makeup=6:detection=rms',
  'acompressor=threshold=0.2:ratio=10:attack=0.2:release=60:makeup=1:detection=peak',
].join(',');

function loudnormMeasurement(path, prefixFilter, targetI, targetTp, targetLra) {
  const filter = `${prefixFilter ? `${prefixFilter},` : ''}loudnorm=I=${targetI}:TP=${targetTp}:LRA=${targetLra}:print_format=json`;
  const output = runWithStderr(FFMPEG, [
    '-hide_banner', '-nostats', '-i', path, '-af', filter,
    '-f', 'null', process.platform === 'win32' ? 'NUL' : '/dev/null',
  ]);
  const matches = [...output.matchAll(/\{[\s\S]*?\}/g)];
  if (matches.length === 0) throw new Error(`Could not measure loudness for ${path}`);
  return JSON.parse(matches.at(-1)[0]);
}

function twoPassLoudnormFilter(measured, targetI, targetTp, targetLra, prefixFilter = '') {
  const normalize = [
    `loudnorm=I=${targetI}`,
    `TP=${targetTp}`,
    `LRA=${targetLra}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    'linear=true',
    'print_format=summary',
  ].join(':');
  return `${prefixFilter ? `${prefixFilter},` : ''}${normalize}`;
}

function buildVoice(input, output) {
  mkdirSync(dirname(output), { recursive: true });
  const measured = loudnormMeasurement(input, VOICE_PROCESS_FILTER, -16, -1.5, 7);
  const filter = twoPassLoudnormFilter(measured, -16, -1.5, 7, VOICE_PROCESS_FILTER);
  run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-af', filter,
    '-ar', '44100', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '96k',
    '-map_metadata', '-1', '-id3v2_version', '0', output,
  ], { quiet: true });
}

function ambientFilter(durationSeconds) {
  if (durationSeconds === 60) {
    return [
      '[0:a]asplit=5[s0][s1][s2][s3][s4]',
      '[s0]atrim=start=0:end=10.5,asetpts=PTS-STARTPTS,stereotools=slev=0.55,volume=-2dB[a]',
      '[s1]atrim=start=29:end=47,asetpts=PTS-STARTPTS,stereotools=slev=0.85,volume=-1dB[b]',
      '[s2]atrim=start=82:end=100,asetpts=PTS-STARTPTS,stereotools=slev=1.05[c]',
      '[s3]atrim=start=128:end=139,asetpts=PTS-STARTPTS,stereotools=slev=0.7,volume=-1.5dB[d]',
      '[s4]atrim=start=158:end=164.5,asetpts=PTS-STARTPTS,stereotools=slev=0.55,volume=-1dB[e]',
      '[a][b]acrossfade=d=1:c1=qsin:c2=qsin[ab]',
      '[ab][c]acrossfade=d=1:c1=qsin:c2=qsin[abc]',
      '[abc][d]acrossfade=d=1:c1=qsin:c2=qsin[abcd]',
      '[abcd][e]acrossfade=d=1:c1=qsin:c2=qsin,apad=whole_dur=60,atrim=duration=60,afade=t=out:st=58:d=2[out]',
    ].join(';');
  }
  if (durationSeconds === 180) {
    return [
      '[0:a]asplit=6[s0][s1][s2][s3][s4][s5]',
      '[s0]atrim=start=0:end=30,asetpts=PTS-STARTPTS,stereotools=slev=0.55,volume=-2dB[a]',
      '[s1]atrim=start=28:end=80,asetpts=PTS-STARTPTS,stereotools=slev=0.85,volume=-1dB[b]',
      '[s2]atrim=start=80:end=120,asetpts=PTS-STARTPTS[c1]',
      '[s3]atrim=start=56:end=72,asetpts=PTS-STARTPTS[c2]',
      '[c1][c2]acrossfade=d=4:c1=qsin:c2=qsin,stereotools=slev=1.05[c]',
      '[s4]atrim=start=117:end=148,asetpts=PTS-STARTPTS,stereotools=slev=0.7,volume=-1.5dB[d]',
      '[s5]atrim=start=144.94:end=167.94,asetpts=PTS-STARTPTS,stereotools=slev=0.55,volume=-1dB[e]',
      '[a][b]acrossfade=d=2:c1=qsin:c2=qsin[ab]',
      '[ab][c]acrossfade=d=2:c1=qsin:c2=qsin[abc]',
      '[abc][d]acrossfade=d=2:c1=qsin:c2=qsin[abcd]',
      '[abcd][e]acrossfade=d=2:c1=qsin:c2=qsin,apad=whole_dur=180,atrim=duration=180,afade=t=out:st=177:d=3[out]',
    ].join(';');
  }
  return [
    '[0:a]asplit=6[s0][s1][s2][s3][s4][s5]',
    '[s0]atrim=start=0:end=49,asetpts=PTS-STARTPTS,stereotools=slev=0.5,volume=-2.5dB[a]',
    '[s1]atrim=start=30:end=116,asetpts=PTS-STARTPTS,stereotools=slev=0.85,volume=-1dB[b]',
    '[s2]atrim=start=56:end=114,asetpts=PTS-STARTPTS[c1]',
    '[s3]atrim=start=34:end=70,asetpts=PTS-STARTPTS[c2]',
    '[c1][c2]acrossfade=d=8:c1=qsin:c2=qsin,stereotools=slev=1.08[c]',
    '[s4]atrim=start=115.94:end=165.94,asetpts=PTS-STARTPTS,stereotools=slev=0.68,volume=-1.5dB[d]',
    '[s5]atrim=start=130.94:end=167.94,asetpts=PTS-STARTPTS,stereotools=slev=0.55,volume=-1dB[e]',
    '[a][b]acrossfade=d=2:c1=qsin:c2=qsin[ab]',
    '[ab][c]acrossfade=d=2:c1=qsin:c2=qsin[abc]',
    '[abc][d]acrossfade=d=2:c1=qsin:c2=qsin[abcd]',
    '[abcd][e]acrossfade=d=2:c1=qsin:c2=qsin,apad=whole_dur=300,atrim=duration=300,afade=t=out:st=296.5:d=3.5[out]',
  ].join(';');
}

function buildAmbient(input, output, durationSeconds) {
  mkdirSync(dirname(output), { recursive: true });
  const temporary = join(dirname(output), `.visualize-ambient-${durationSeconds}.wav`);
  run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-filter_complex', ambientFilter(durationSeconds), '-map', '[out]',
    '-ar', '44100', '-ac', '2', '-codec:a', 'pcm_s24le', temporary,
  ], { quiet: true });
  const measured = loudnormMeasurement(temporary, '', -19, -1, 11);
  const filter = twoPassLoudnormFilter(measured, -19, -1, 11);
  run(FFMPEG, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', temporary,
    '-af', filter, '-t', String(durationSeconds), '-ar', '44100', '-ac', '2',
    '-codec:a', 'libmp3lame', '-b:a', '160k', '-map_metadata', '-1', '-id3v2_version', '0', output,
  ], { quiet: true });
  try {
    // This temporary is an intermediate build product, never a source master.
    unlinkSync(temporary);
  } catch {
    // Validation ignores dot-prefixed intermediates if cleanup is interrupted.
  }
}

function writeDurations(cues, outputInventory) {
  const byPath = new Map(outputInventory.map(item => [resolve(item.path), item]));
  const lines = [
    '// Generated by scripts/build-visualize-audio.mjs. Do not edit by hand.',
    'export const VISUALIZE_CLIP_DURATIONS = {',
  ];
  for (const cue of cues) {
    const female = byPath.get(resolve(cue.assets.female));
    const male = byPath.get(resolve(cue.assets.male));
    lines.push(`  ${cue.id}: { female: ${round(female.durationSeconds)}, male: ${round(male.durationSeconds)} },`);
  }
  lines.push('} as const;', '');
  writeFileSync(DURATIONS_PATH, lines.join('\n'), 'utf8');
}

function writeAudit(sourceInventory, outputInventory, validation) {
  mkdirSync(dirname(AUDIT_JSON_PATH), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    ffmpeg: FFMPEG,
    ffprobe: FFPROBE,
    sourceRoot: normalizePath(relative(REPO_ROOT, SOURCE_ROOT)),
    productionRoot: normalizePath(relative(REPO_ROOT, OUTPUT_ROOT)),
    knownSourceMismatch: {
      cueId: 'VIZ_1M_ARRIVE_01',
      suppliedFile: 'VIZ_1M_ARRIVE_01.mp3',
      issue: 'Female source contains a different 9.8-second script and cannot finish before the 0:05 cue.',
      derivativeSource: 'VIZ_3M_ARRIVE_01.mp3',
      resolution: 'Verified same-speaker, same-script alternate used; original preserved unchanged.',
    },
    sourceFiles: sourceInventory,
    generatedFiles: outputInventory,
    validation,
  };
  writeFileSync(AUDIT_JSON_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const sourceRows = sourceInventory.map(item =>
    `| ${item.kind} | ${item.cueId ?? 'ambient master'} | ${item.name.replaceAll('|', '\\|')} | ${item.format}/${item.codec} | ${round(item.durationSeconds)} | ${item.sampleRateHz} | ${item.channels} | ${Math.round(item.bitRateBps / 1000)} | ${round(item.integratedLufs, 2)} | ${round(item.truePeakDbtp, 2)} | ${round(item.leadingSilenceSeconds)} | ${round(item.trailingSilenceSeconds)} | ${item.clipping ? 'yes' : 'no'} |`,
  );
  const outputRows = outputInventory.map(item =>
    `| ${item.kind} | ${item.cueId ?? `${item.durationSeconds}s ambient`} | ${normalizePath(relative(REPO_ROOT, item.path))} | ${round(item.durationSeconds)} | ${round(item.integratedLufs, 2)} | ${round(item.truePeakDbtp, 2)} | ${item.bytes} |`,
  );
  const markdown = [
    '# Visualize audio asset inventory',
    '',
    `Generated: ${payload.generatedAt}`,
    '',
    'The supplied female `VIZ_1M_ARRIVE_01.mp3` is preserved but is not mapped to production: transcription and duration analysis found a different 9.8-second script. The production derivative uses the same-speaker `VIZ_3M_ARRIVE_01.mp3`, whose script matches the male cue and fits the canonical window.',
    '',
    '## Original sources',
    '',
    '| Kind | Cue | Source file | Format | Seconds | Hz | Ch | kbps | LUFS-I | dBTP | Lead | Tail | Clipping |',
    '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...sourceRows,
    '',
    '## Generated production assets',
    '',
    '| Kind | Cue | File | Seconds | LUFS-I | dBTP | Bytes |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |',
    ...outputRows,
    '',
    '## Validation',
    '',
    `- Status: ${validation.ok ? 'PASS' : 'FAIL'}`,
    `- Errors: ${validation.errors.length}`,
    ...validation.errors.map(error => `  - ${error}`),
    '',
  ].join('\n');
  writeFileSync(AUDIT_MARKDOWN_PATH, markdown, 'utf8');
}

function validate(parsed, sourceFiles, outputInventory = null) {
  const errors = [];
  const cueIds = parsed.cues.map(cue => cue.id);
  if (parsed.cues.length !== 71) errors.push(`Expected 71 cues, found ${parsed.cues.length}.`);
  if (new Set(cueIds).size !== cueIds.length) errors.push('Cue IDs are not unique.');
  if (parsed.assets.size !== parsed.cues.length) errors.push(`Expected ${parsed.cues.length} static voice asset pairs, found ${parsed.assets.size}.`);
  if (parsed.ambient.size !== 3) errors.push(`Expected 3 static ambient assets, found ${parsed.ambient.size}.`);

  const maps = sourceMaps(sourceFiles);
  for (const cue of parsed.cues) {
    cue.assets = parsed.assets.get(cue.id);
    if (!maps.female.get(cue.id)) errors.push(`Missing female source for ${cue.id}.`);
    if (!maps.male.get(cue.id)) errors.push(`Missing male source for ${cue.id}.`);
    if (!cue.assets) errors.push(`Missing static asset references for ${cue.id}.`);
    for (const voice of ['female', 'male']) {
      const path = cue.assets?.[voice];
      if (!path || !existsSync(path)) errors.push(`Bundled require does not resolve for ${cue.id} ${voice}: ${path ?? 'missing'}`);
    }
  }
  for (const [duration, path] of parsed.ambient) {
    if (!existsSync(path)) errors.push(`Ambient require does not resolve for ${duration}s: ${path}`);
  }
  for (const duration of [60, 180, 300]) {
    const cues = parsed.cues.filter(cue => cue.durationSeconds === duration);
    for (let index = 1; index < cues.length; index += 1) {
      if (cues[index].startSeconds <= cues[index - 1].startSeconds) errors.push(`${duration}s cue timestamps are not strictly increasing.`);
    }
    for (let index = 0; index < cues.length; index += 1) {
      const cue = cues[index];
      const nextStart = cues[index + 1]?.startSeconds ?? duration;
      if (!outputInventory || !cue.assets) continue;
      for (const voice of ['female', 'male']) {
        const media = outputInventory.find(item => resolve(item.path) === resolve(cue.assets[voice]));
        if (!media) {
          errors.push(`No decoded production inventory for ${cue.id} ${voice}.`);
        } else if (cue.startSeconds + media.durationSeconds > nextStart + 0.04) {
          errors.push(`${cue.id} ${voice} ends at ${round(cue.startSeconds + media.durationSeconds)}s after next cue at ${nextStart}s.`);
        }
      }
    }
  }
  if (outputInventory) {
    for (const duration of [60, 180, 300]) {
      const path = parsed.ambient.get(duration);
      const media = outputInventory.find(item => resolve(item.path) === resolve(path));
      if (!media) continue;
      if (Math.abs(media.durationSeconds - duration) > 0.06) errors.push(`${duration}s ambient duration is ${media.durationSeconds}s.`);
      if (media.truePeakDbtp > -0.8) errors.push(`${duration}s ambient true peak is ${media.truePeakDbtp} dBTP.`);
      if (media.integratedLufs < -20.5 || media.integratedLufs > -17.5) errors.push(`${duration}s ambient loudness is ${media.integratedLufs} LUFS-I.`);
      if (media.channels !== 2) errors.push(`${duration}s ambient is not stereo.`);
    }
    for (const media of outputInventory.filter(item => item.kind !== 'ambient')) {
      if (media.channels !== 1 || media.sampleRateHz !== 44100) errors.push(`${basename(media.path)} is not 44.1kHz mono.`);
      if (media.truePeakDbtp > -0.9) errors.push(`${basename(media.path)} true peak is ${media.truePeakDbtp} dBTP.`);
      // EBU integrated loudness is unstable for one- and two-word clips. This
      // range keeps them perceptually aligned while retaining natural peaks.
      if (media.integratedLufs < -18.7 || media.integratedLufs > -14.8) errors.push(`${basename(media.path)} loudness is ${media.integratedLufs} LUFS-I.`);
    }
    const referenced = new Set([
      ...[...parsed.assets.values()].flatMap(pair => [resolve(pair.female), resolve(pair.male)]),
      ...[...parsed.ambient.values()].map(path => resolve(path)),
    ]);
    const productionFiles = listFilesRecursive(OUTPUT_ROOT).filter(path => !basename(path).startsWith('.') && /\.(mp3|m4a|wav|aac|ogg)$/i.test(path));
    for (const path of productionFiles) if (!referenced.has(resolve(path))) errors.push(`Orphaned production asset: ${relative(MOBILE_ROOT, path)}`);
  }
  return { ok: errors.length === 0, errors };
}

function listFilesRecursive(root) {
  if (!existsSync(root)) return [];
  const result = [];
  const stack = [root];
  while (stack.length > 0) {
    const directory = stack.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else result.push(path);
    }
  }
  return result;
}

async function inspectSources(sourceFiles) {
  return mapConcurrent(sourceFiles, 4, async file => ({
    kind: file.kind,
    cueId: file.cueId,
    name: file.name,
    path: normalizePath(relative(REPO_ROOT, file.path)),
    ...(await inspect(file.path)),
  }));
}

async function inspectOutputs(parsed) {
  const entries = [];
  for (const cue of parsed.cues) {
    const assets = parsed.assets.get(cue.id);
    entries.push({ kind: 'female', cueId: cue.id, path: assets.female });
    entries.push({ kind: 'male', cueId: cue.id, path: assets.male });
  }
  for (const [durationSeconds, path] of parsed.ambient) entries.push({ kind: 'ambient', cueId: null, durationSeconds, path });
  return mapConcurrent(entries, 4, async entry => ({ ...entry, ...(await inspect(entry.path)) }));
}

async function build() {
  const parsed = parseManifest();
  const sourceFiles = discoverSourceFiles();
  const maps = sourceMaps(sourceFiles);
  const preflight = validate(parsed, sourceFiles);
  const sourceOnlyErrors = preflight.errors.filter(error => error.startsWith('Missing female source') || error.startsWith('Missing male source'));
  if (sourceOnlyErrors.length > 0) throw new Error(sourceOnlyErrors.join('\n'));

  console.log(`Building ${parsed.cues.length * 2} guided voice derivatives...`);
  await mapConcurrent(parsed.cues.flatMap(cue => [
    { cue, voice: 'female', input: maps.female.get(cue.id), output: parsed.assets.get(cue.id)?.female },
    { cue, voice: 'male', input: maps.male.get(cue.id), output: parsed.assets.get(cue.id)?.male },
  ]), 4, async item => buildVoice(item.input, item.output));

  const ambientSource = sourceFiles.find(file => file.kind === 'ambient')?.path;
  if (!ambientSource) throw new Error('No ambient master was found.');
  for (const duration of [60, 180, 300]) {
    console.log(`Building ${duration}s ambient arrangement...`);
    await buildAmbient(ambientSource, parsed.ambient.get(duration), duration);
  }

  console.log('Inspecting source and production assets...');
  const [sourceInventory, outputInventory] = await Promise.all([
    inspectSources(sourceFiles),
    inspectOutputs(parsed),
  ]);
  const validation = validate(parsed, sourceFiles, outputInventory);
  writeDurations(parsed.cues, outputInventory);
  writeAudit(sourceInventory, outputInventory, validation);
  if (!validation.ok) throw new Error(`Visualize audio validation failed:\n${validation.errors.join('\n')}`);
  const bytes = outputInventory.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`PASS: ${parsed.cues.length} cues × 2 voices, 3 ambient tracks, ${bytes} production bytes.`);
}

async function auditOnly() {
  const parsed = parseManifest();
  const sourceFiles = discoverSourceFiles();
  const sourceInventory = await inspectSources(sourceFiles);
  const outputInventory = [...parsed.assets.values(), ...parsed.ambient.values()].every(value =>
    typeof value === 'string' ? existsSync(value) : existsSync(value.female) && existsSync(value.male),
  ) ? await inspectOutputs(parsed) : [];
  const validation = validate(parsed, sourceFiles, outputInventory.length > 0 ? outputInventory : null);
  if (outputInventory.length > 0) writeDurations(parsed.cues, outputInventory);
  writeAudit(sourceInventory, outputInventory, validation);
  console.log(`Audited ${sourceInventory.length} source files and ${outputInventory.length} production files.`);
  if (!validation.ok) {
    console.error(validation.errors.join('\n'));
    process.exitCode = 1;
  }
}

if (!['build', 'audit', 'validate'].includes(MODE)) {
  throw new Error('Usage: node scripts/build-visualize-audio.mjs [build|audit|validate]');
}

await (MODE === 'build' ? build() : auditOnly());
