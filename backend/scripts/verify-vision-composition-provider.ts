/** Bounded live COMPOSE + existing Photo Fit expansion acceptance; no database writes. */
import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { imageGenerationService } from '../src/services/image';
import type { ImageReference } from '../src/services/image/types';
import { buildVisionConversationPrompt } from '../src/services/v2/visionConversationPrompt';
import { expandPhotoToVision } from '../src/services/v2/visionPhotoExpand';
import { GeminiImageService } from '../src/services/GeminiImageService';

async function main() {
  if (!process.argv.includes('--run')) throw new Error('Pass --run to authorize two composition images and one expansion.');
  const output = resolve('../.codex-vision-provider-qa');
  const source = await readFile(resolve(output, 'original-option-2.png'));
  const mood = await readFile(resolve(output, 'refined-option-1.png'));
  const receipts: unknown[] = [];
  const fetchOriginal = global.fetch;
  global.fetch = async (...args) => {
    const response = await fetchOriginal(...args);
    const url = String(args[0] instanceof Request ? args[0].url : args[0]);
    if (response.ok && (url.includes('api.openai.com/v1/images/') || url.includes('generativelanguage.googleapis.com'))) {
      const body = await response.clone().json() as { usage?: unknown; usageMetadata?: unknown };
      receipts.push({ provider: url.includes('openai.com') ? 'openai' : 'gemini', usage: body.usage ?? body.usageMetadata ?? null });
    }
    return response;
  };
  const crop = async (left: number, top: number, width: number, height: number) =>
    sharp(source).extract({ left, top, width, height }).resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const references: ImageReference[] = [
    { buffer: await crop(0, 900, 400, 500), mimeType: 'image/jpeg', role: 'object', label: 'Red mug' },
    { buffer: await crop(240, 1080, 800, 300), mimeType: 'image/jpeg', role: 'object', label: 'Open notebook' },
    { buffer: await crop(730, 530, 422, 600), mimeType: 'image/jpeg', role: 'object', label: 'Potted plant' },
    { buffer: await sharp(source).resize({ height: 1280 }).jpeg({ quality: 85 }).toBuffer(), mimeType: 'image/jpeg', role: 'place', label: 'Wood textures only' },
    { buffer: await sharp(mood).resize({ height: 1280 }).jpeg({ quality: 85 }).toBuffer(), mimeType: 'image/jpeg', role: 'inspiration', label: 'Warm light' },
  ];
  const startedAt = Date.now();
  const description = 'Compose a completely new eye-level wide photograph of a modern creative studio overlooking the sea at sunset. Put the selected red mug, open notebook, and plant on an oak desk across the lower third. Show a broad sea view and the horizon through a large window. Use wood textures from the place reference and warm light from the inspiration reference. Do not preserve the previous desk viewpoint or room layout.';
  await Promise.all([0, 1].map(async index => {
    const result = await imageGenerationService.generate({ type: 'vision', operation: 'COMPOSE',
      prompt: buildVisionConversationPrompt('COMPOSE', description, 'A creative life by the sea', index),
      referenceImages: references, devImageModel: 'gpt-image-2.5-flare',
      generationRequestId: `vision-acceptance-compose-${startedAt}-${index}` });
    await writeFile(resolve(output, `compose-option-${index + 1}.png`), result.images[0].buffer);
  }));
  const photo = await sharp(source).extract({ left: 0, top: 700, width: 1152, height: 1152 }).jpeg({ quality: 90 }).toBuffer();
  await writeFile(resolve(output, 'expansion-source.jpg'), photo);
  const expanded = process.argv.includes('--skip-expansion') ? null : await expandPhotoToVision(photo, new GeminiImageService());
  if (expanded) await writeFile(resolve(output, 'expanded-photo.jpg'), expanded.image);
  const receipt = { description, referenceRoles: references.map(ref => ({ role: ref.role, label: ref.label })),
    images: expanded ? 3 : 2, elapsedMs: Date.now() - startedAt, expansion: expanded ? { width: expanded.width, height: expanded.height } : null, receipts };
  await writeFile(resolve(output, 'composition-receipt.json'), JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Provider validation failed'); process.exitCode = 1; });
