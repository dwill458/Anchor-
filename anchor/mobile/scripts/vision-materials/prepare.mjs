import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Crops are measured from the generated source atlases after visual inspection.
// Only extraction, alpha cleanup and encoding occur here; paper/folds are photographed assets.
const sourceDir = resolve(process.argv[2] ?? '/workspace/generated_images');
const emitShell = process.argv.includes('--emit-shell');
const commands = ['#!/bin/sh', 'set -eu'];
const quote = value => "'" + String(value).replaceAll("'", "'\\''") + "'";
const run = args => emitShell ? commands.push(['magick', ...args].map(quote).join(' ')) : execFileSync('magick', args);
const output = fileURLToPath(new URL('../../src/assets/vision/materials/', import.meta.url));
mkdirSync(resolve(output, 'thumbnails'), { recursive: true });
const atlases = [
  ['exec-31c0e911-a0fe-4b78-b23e-915f8c4daf76.png', 'sticky', [
    ['blush-pink', 54,45,570,575], ['butter-yellow',655,45,574,575], ['sky-blue',55,650,565,570], ['sage-green',655,650,574,575]]],
  ['exec-8d7f9f6a-14aa-4175-a2d3-0ea8246716b3.png', 'sticky', [
    ['lavender',63,45,557,574], ['peach',656,48,565,573], ['warm-ivory',62,641,561,575], ['rose-lined',655,640,563,575]]],
  ['exec-bbd178cd-06a5-48cf-acbe-bfb6f988acf0.png', 'paper', [
    ['ivory-rough',44,43,575,565], ['cream-fiber',657,45,574,567], ['warm-beige',44,637,579,570], ['torn-edge',655,638,578,579]]],
  ['exec-4bb6a4e4-839a-45cf-af96-ae80c988edb6.png', 'editorial', [
    ['classic-ivory',55,52,573,559], ['warm-cream',662,53,577,559], ['oyster',55,640,573,568], ['soft-parchment',661,640,581,566]]],
  ['exec-fa5db515-850b-4139-a09f-49ec575a121b.png', 'tape', [
    ['cream',48,109,810,184], ['muted-pink',930,108,809,185], ['beige',70,385,788,175], ['translucent-clear',943,387,782,176], ['textured-ivory',78,660,775,167], ['torn-cream',929,656,804,187]]],
  ['exec-f34d21ba-9177-4e10-bec9-2dc7c4e98539.png', 'polaroid', [
    ['classic',42,33,517,619], ['torn-bottom',596,34,520,617], ['rough-edge',30,696,531,623], ['wide-bottom',596,696,522,631]]],
];
const report = [];
for (const [atlas, family, crops] of atlases) {
  for (const [variant,x,y,width,height] of crops) {
    const name = `${family}-${variant}`;
    const destination = resolve(output, `${name}.webp`);
    const args = [resolve(sourceDir, atlas), '-crop', `${width}x${height}+${x}+${y}`, '+repage'];
    // Remove isolated alpha debris without changing the physical paper/curl silhouette.
    args.push('(', '+clone', '-alpha', 'extract', '-threshold', '2%', '-define', 'connected-components:area-threshold=180', '-define', 'connected-components:mean-color=true', '-connected-components', '8', '-threshold', '50%', '-alpha', 'copy', ')', '-compose', 'DstIn', '-composite', '-compose', 'Over');
    const target = family === 'tape' ? [512,160] : family === 'polaroid' ? [600,720] : [600,600];
    if (family === 'polaroid') {
      args.push('-resize', '600x720!', '-channel', 'A', '-region', variant === 'wide-bottom' ? '528x461+36+43' : '528x519+36+43', '-evaluate', 'set', '0', '+region', '+channel');
    } else {
      args.push('-resize', family === 'tape' ? '488x136' : '576x576', '-gravity', 'center', '-background', 'none', '-extent', `${target[0]}x${target[1]}`);
      if (family === 'tape') args.push('-channel', 'A', '-evaluate', 'Multiply', variant === 'translucent-clear' ? '0.34' : '0.66', '+channel');
    }
    args.push('-strip', '-quality', '86', '-define', 'webp:alpha-quality=100', '-define', 'webp:method=6', destination);
    run(args);
    if (!['tape','polaroid'].includes(family)) {
      run([destination, '-resize', '128x128', '-strip', '-quality', '82', resolve(output, 'thumbnails', `${name}.webp`)]);
    }
    report.push({ filename: `${name}.webp`, width: target[0], height: target[1], sourceAtlas: atlas, sourceCrop: {x,y,width,height} });
  }
}
writeFileSync(resolve(output, 'inventory.json'), JSON.stringify(report, null, 2) + '\n');
if (emitShell) writeFileSync('/tmp/prepare-vision-materials.sh', commands.join('\n') + '\n');
console.log(`Prepared ${report.length} separate material assets and 16 palette thumbnails.`);
