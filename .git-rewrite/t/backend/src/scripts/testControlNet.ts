/**
 * Spike Phase: ControlNet Quality Validation
 *
 * Tests ControlNet + SDXL with 6 AI styles across 10 test sigils
 * to measure structure preservation quality.
 *
 * Prerequisites:
 * 1. Run generateTestSigils.ts first
 * 2. Set REPLICATE_API_TOKEN in environment
 * 3. Review generated PNGs in spike-phase/test-sigils-png/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import Replicate from 'replicate';

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_KEY = process.env.REPLICATE_API_TOKEN;

if (!API_KEY) {
  console.error('❌ Error: REPLICATE_API_TOKEN environment variable not set');
  console.log('\nPlease set your Replicate API token:');
  console.log('export REPLICATE_API_TOKEN="your-token-here"\n');
  process.exit(1);
}

const replicate = new Replicate({
  auth: API_KEY,
});

// ============================================================================
// AI STYLE DEFINITIONS
// ============================================================================

interface AIStyle {
  name: string;
  method: 'canny' | 'lineart';
  prompt: string;
  negativePrompt: string;
  category: 'organic' | 'geometric' | 'hybrid';
}

const AI_STYLES: AIStyle[] = [
  {
    name: 'watercolor',
    method: 'lineart',
    category: 'organic',
    prompt: 'flowing watercolor painting, soft edges, translucent washes, mystical sigil symbol, artistic brushstrokes',
    negativePrompt: 'new shapes, additional symbols, text, faces, people, photography, realistic, 3d',
  },
  {
    name: 'sacred_geometry',
    method: 'canny',
    category: 'geometric',
    prompt: 'sacred geometry, precise golden lines, geometric perfection, mystical symbol etched in gold, mathematical precision',
    negativePrompt: 'new shapes, additional symbols, text, faces, organic, soft, messy, hand-drawn',
  },
  {
    name: 'ink_brush',
    method: 'lineart',
    category: 'organic',
    prompt: 'traditional ink brush calligraphy, flowing brushstrokes, zen aesthetic, black ink on paper, japanese sumi-e',
    negativePrompt: 'new shapes, additional symbols, text, digital, 3d, color, modern',
  },
  {
    name: 'gold_leaf',
    method: 'canny', // Test both in actual run
    category: 'hybrid',
    prompt: 'illuminated manuscript, gold leaf gilding, ornate medieval style, precious metal, luxurious texture',
    negativePrompt: 'new shapes, additional symbols, text, modern, photography, people',
  },
  {
    name: 'cosmic',
    method: 'lineart',
    category: 'organic',
    prompt: 'cosmic energy, nebula, starlight, glowing ethereal sigil in deep space, celestial magic',
    negativePrompt: 'new shapes, additional symbols, text, faces, planets, realistic, photography',
  },
  {
    name: 'minimal_line',
    method: 'canny',
    category: 'geometric',
    prompt: 'minimal line art, clean precise lines, modern minimalist, single color on white, graphic design',
    negativePrompt: 'new shapes, additional symbols, texture, shading, embellishment, ornate',
  },
];

// ============================================================================
// CONTROLNET SETTINGS
// ============================================================================

interface ControlNetConfig {
  conditioning_scale: number;
  guidance_scale: number;
  num_inference_steps: number;
}

const CONTROLNET_CONFIGS: Record<string, ControlNetConfig> = {
  default: {
    conditioning_scale: 0.8,
    guidance_scale: 7.5,
    num_inference_steps: 30,
  },
  strict: {
    conditioning_scale: 0.9,
    guidance_scale: 10,
    num_inference_steps: 50,
  },
  balanced: {
    conditioning_scale: 0.8,
    guidance_scale: 7.5,
    num_inference_steps: 30,
  },
  loose: {
    conditioning_scale: 0.7,
    guidance_scale: 7.5,
    num_inference_steps: 30,
  },
};

// ============================================================================
// MAIN TESTING LOGIC
// ============================================================================

interface TestResult {
  sigilId: number;
  styleName: string;
  method: 'canny' | 'lineart';
  config: string;
  success: boolean;
  outputUrl?: string;
  error?: string;
  generationTimeMs?: number;
}

async function testControlNet(
  imagePath: string,
  style: AIStyle,
  config: ControlNetConfig,
  configName: string
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    console.log(`      Testing ${style.name} with ${style.method} (${configName})...`);

    // Read image and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    // Determine ControlNet model based on method
    const model = style.method === 'canny'
      ? 'thibaud/controlnet-sd21:4f7051fa33eb78dd45589a094eb1f3b19cd05cc1c06a4ab3fd0c90456dc10fb0'
      : 'thibaud/controlnet-sd21:4f7051fa33eb78dd45589a094eb1f3b19cd05cc1c06a4ab3fd0c90456dc10fb0'; // Same model, different preprocessing

    // Run ControlNet
    const output = await replicate.run(
      model,
      {
        input: {
          image: dataUrl,
          prompt: style.prompt,
          negative_prompt: style.negativePrompt,
          structure: style.method, // 'canny' or 'lineart'
          controlnet_conditioning_scale: config.conditioning_scale,
          guidance_scale: config.guidance_scale,
          num_inference_steps: config.num_inference_steps,
          num_outputs: 1,
        },
      }
    ) as any;

    const generationTimeMs = Date.now() - startTime;

    // Extract output URL
    const outputUrl = Array.isArray(output) ? output[0] : output;

    console.log(`      ✅ Success in ${generationTimeMs}ms`);

    return {
      sigilId: 0, // Will be set by caller
      styleName: style.name,
      method: style.method,
      config: configName,
      success: true,
      outputUrl,
      generationTimeMs,
    };

  } catch (error) {
    const generationTimeMs = Date.now() - startTime;
    console.log(`      ❌ Failed after ${generationTimeMs}ms`);
    console.log(`      Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

    return {
      sigilId: 0,
      styleName: style.name,
      method: style.method,
      config: configName,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      generationTimeMs,
    };
  }
}

async function downloadResult(url: string, outputPath: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(buffer));
  } catch (error) {
    console.error(`Failed to download: ${error}`);
  }
}

async function main() {
  console.log('🧪 Spike Phase: ControlNet Quality Validation\n');
  console.log('='.repeat(70));
  console.log('\nThis script will test ControlNet with 6 AI styles across 10 sigils.');
  console.log('Each test generates 1 image (60 total images).');
  console.log('Estimated time: 40-60 minutes\n');

  // Load test sigil metadata
  const metadataPath = path.join(process.cwd(), 'spike-phase', 'test-sigils-metadata.json');
  let metadata: any[];

  try {
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(metadataContent);
  } catch (error) {
    console.error('❌ Error: Could not load test sigil metadata.');
    console.log('Please run generateTestSigils.ts first.\n');
    process.exit(1);
  }

  // Create output directories
  const outputDir = path.join(process.cwd(), 'spike-phase', 'controlnet-results');
  await fs.mkdir(outputDir, { recursive: true });

  for (const styleDef of AI_STYLES) {
    const styleDir = path.join(outputDir, styleDef.name);
    await fs.mkdir(styleDir, { recursive: true });
  }

  const results: TestResult[] = [];

  // Test each sigil with each style
  let testCount = 0;
  const totalTests = metadata.length * AI_STYLES.length;

  for (const sigil of metadata) {
    console.log(`\n[Sigil ${sigil.id}/10] ${sigil.intention}`);
    console.log(`   Variant: ${sigil.variant} | Complexity: ${sigil.complexity}`);

    const imagePath = path.join(
      process.cwd(),
      'spike-phase',
      'test-sigils-png',
      sigil.pngPath
    );

    for (const style of AI_STYLES) {
      testCount++;
      console.log(`   [Test ${testCount}/${totalTests}] Style: ${style.name}`);

      const result = await testControlNet(
        imagePath,
        style,
        CONTROLNET_CONFIGS.balanced,
        'balanced'
      );

      result.sigilId = sigil.id;
      results.push(result);

      // Download successful results
      if (result.success && result.outputUrl) {
        const outputFilename = `sigil_${sigil.id}_${style.name}.png`;
        const outputPath = path.join(outputDir, style.name, outputFilename);
        await downloadResult(result.outputUrl, outputPath);
        console.log(`      💾 Saved to: ${style.name}/${outputFilename}`);
      }

      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(70));
  console.log('\n📊 Testing Complete - Summary\n');

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(`Total tests: ${results.length}`);
  console.log(`✅ Successful: ${successCount} (${((successCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failureCount} (${((failureCount / results.length) * 100).toFixed(1)}%)`);

  console.log('\n📈 Results by Style:\n');

  for (const style of AI_STYLES) {
    const styleResults = results.filter(r => r.styleName === style.name);
    const styleSuccess = styleResults.filter(r => r.success).length;
    const avgTime = styleResults
      .filter(r => r.generationTimeMs)
      .reduce((sum, r) => sum + (r.generationTimeMs || 0), 0) / styleResults.length;

    console.log(`   ${style.name}:`);
    console.log(`      Success: ${styleSuccess}/${styleResults.length} | Avg Time: ${Math.round(avgTime)}ms | Method: ${style.method}`);
  }

  // Save full results
  const resultsPath = path.join(outputDir, 'test-results.json');
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Full results saved: controlnet-results/test-results.json`);

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 Next Steps:\n');
  console.log('1. Review generated images in spike-phase/controlnet-results/');
  console.log('2. Evaluate structure preservation visually');
  console.log('3. Rate each result (structure, edges, style, drift)');
  console.log('4. Compile evaluation scores\n');
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
