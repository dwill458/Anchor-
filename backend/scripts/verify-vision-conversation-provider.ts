/** Explicit, bounded live provider acceptance. No database or production application writes. */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { imageGenerationService } from '../src/services/image';
import { buildVisionConversationPrompt } from '../src/services/v2/visionConversationPrompt';

async function main() {
  if (!process.argv.includes('--run')) throw new Error('Pass --run to authorize four billable provider images.');
  if (!process.env.OPENAI_API_KEY) throw new Error('Local OpenAI credentials unavailable.');
  const outputFlag = process.argv.indexOf('--output');
  const output = resolve(outputFlag >= 0 ? process.argv[outputFlag + 1] : '../.codex-vision-provider-qa');
  await mkdir(output, { recursive: true });
  const receipts: unknown[] = [];
  const fetchOriginal = global.fetch;
  global.fetch = async (...args) => {
    const response = await fetchOriginal(...args);
    if (response.ok && String(args[0]).startsWith('https://api.openai.com/v1/images/')) {
      const body = await response.clone().json() as { usage?: unknown };
      receipts.push({ endpoint: String(args[0]).split('/').pop(), usage: body.usage ?? null });
    }
    return response;
  };
  const startedAt = Date.now();
  const description = 'A believable editorial photograph of a quiet sunlit oak writing desk beside a window. A red ceramic mug sits on the left, an open notebook is in the center, and a small green potted plant is on the right. No people. Natural morning light. Keep all three objects clearly visible.';
  const original = await Promise.all([0, 1].map(async index => {
    const result = await imageGenerationService.generate({ type: 'vision', operation: 'CREATE',
      prompt: buildVisionConversationPrompt('CREATE', description, 'A peaceful creative life', index),
      devImageModel: 'gpt-image-2.5-flare', generationRequestId: `vision-acceptance-create-${startedAt}-${index}` });
    const buffer = result.images[0].buffer;
    await writeFile(resolve(output, `original-option-${index + 1}.png`), buffer);
    return buffer;
  }));
  const instruction = 'Keep everything the same, including the exact desk, notebook, plant, viewpoint and object positions. Change only the red mug to blue and the morning sunlight to warm sunset light.';
  await Promise.all([0, 1].map(async index => {
    const result = await imageGenerationService.generate({ type: 'vision', operation: 'EDIT',
      prompt: buildVisionConversationPrompt('EDIT', instruction, '', index),
      referenceImages: [{ buffer: original[1], mimeType: 'image/png', role: 'edit_source' }],
      devImageModel: 'gpt-image-2.5-sunburst', generationRequestId: `vision-acceptance-edit-${startedAt}-${index}` });
    await writeFile(resolve(output, `refined-option-${index + 1}.png`), result.images[0].buffer);
  }));
  await writeFile(resolve(output, 'receipt.json'), JSON.stringify({ description, instruction,
    exactSource: 'original-option-2.png', images: 4, elapsedMs: Date.now() - startedAt, receipts }, null, 2));
  console.log(JSON.stringify({ images: 4, output, elapsedMs: Date.now() - startedAt, receipts }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Provider validation failed'); process.exitCode = 1; });
