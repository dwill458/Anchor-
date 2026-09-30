import sharp from 'sharp';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/chart/world');
const source = process.argv[2] ?? 'E:/downloads/Untitled design (12)';
const names = ['master', 'sky', 'city', 'midground', 'road', 'foreground'];
const widths = [0, 720, 1080, 1080, 1440, 1080];
await mkdir(path.join(root, 'masters'), { recursive: true });
await mkdir(path.join(root, 'runtime'), { recursive: true });
const layers = [];
for (let i = 0; i < names.length; i++) {
  const name = `chart_${String(i).padStart(2, '0')}_${names[i]}`;
  const input = path.join(source, `${i+1}.png`);
  const metadata = await sharp(input).metadata();
  if (metadata.width !== 3240 || metadata.height !== 5760) throw new Error(`Unexpected master size: ${name}`);
  await copyFile(input, path.join(root, 'masters', `${name}.png`));
  if (!i) continue;
  const width = widths[i], height = width * 16/9;
  const filename = `${name}.${i === 1 ? 'jpg' : 'png'}`;
  let image = sharp(input).resize(width, height, { kernel: 'lanczos3' });
  image = i === 1 ? image.jpeg({ quality: 92 }) : image.png({ compressionLevel: 9 });
  await image.toFile(path.join(root, 'runtime', filename));
  layers.push({ id: names[i], filename, width, height, decodedBytes: width*height*4 });
}
const decodedBytes = layers.reduce((sum, layer) => sum+layer.decodedBytes, 0);
if (decodedBytes > 48*1024*1024) throw new Error('Chart decoded texture budget exceeded');
await writeFile(path.join(root, 'runtime', 'manifest.json'), JSON.stringify({ master: { width:3240,height:5760 }, decodedBytes, decodedBudgetBytes:48*1024*1024, gpuBudgetBytes:96*1024*1024, layers }, null, 2)+'\n');
console.log(`Chart runtime textures: ${(decodedBytes/1024/1024).toFixed(2)} MiB decoded; native GPU/cache measurement still required.`);
