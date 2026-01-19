/**
 * Spike Phase: Generate Test Sigils
 *
 * This script generates 10 test sigils with varied complexity for ControlNet validation.
 * Outputs both SVG and rasterized PNG versions.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { rasterizeSVG, rasterizeToFile } from '../utils/svgRasterizer';

// ============================================================================
// TRADITIONAL SIGIL GENERATOR (Copied from mobile app)
// ============================================================================

type SigilVariant = 'dense' | 'balanced' | 'minimal';

interface SigilGenerationResult {
  svg: string;
  variant: SigilVariant;
}

const NUMEROLOGY_MAP: Record<string, number> = {
  A: 1, J: 1, S: 1,
  B: 2, K: 2, T: 2,
  C: 3, L: 3, U: 3,
  D: 4, M: 4, V: 4,
  E: 5, N: 5, W: 5,
  F: 6, O: 6, X: 6,
  G: 7, P: 7, Y: 7,
  H: 8, Q: 8, Z: 8,
  I: 9, R: 9
};

const GRID_COORDS: Record<number, { x: number; y: number }> = {
  1: { x: 20, y: 20 }, 2: { x: 50, y: 20 }, 3: { x: 80, y: 20 },
  4: { x: 20, y: 50 }, 5: { x: 50, y: 50 }, 6: { x: 80, y: 50 },
  7: { x: 20, y: 80 }, 8: { x: 50, y: 80 }, 9: { x: 80, y: 80 }
};

function processIntent(letters: string[] | string, variant: SigilVariant): number[] {
  let rawText = '';
  if (Array.isArray(letters)) {
    rawText = letters.join('').toUpperCase().replace(/[^A-Z]/g, '');
  } else if (typeof letters === 'string') {
    rawText = letters.toUpperCase().replace(/[^A-Z]/g, '');
  }

  if (!rawText) return [5];

  let processed = rawText;

  if (processed.length > 3) {
    processed = processed.replace(/[AEIOU]/g, '');
  }

  processed = Array.from(new Set(processed.split(''))).join('');

  let points = processed.split('').map(char => NUMEROLOGY_MAP[char] || 5);

  if (variant === 'minimal' && points.length > 5) {
    points = points.filter((_, i) => i % 2 === 0);
  }

  return points;
}

function jitter(val: number, intensity: number = 2): number {
  return val + (Math.random() * intensity - intensity / 2);
}

function createSigilPath(points: number[]): string {
  if (points.length === 0) return '';

  const start = GRID_COORDS[points[0]];
  if (!start) return '';

  let path = `M ${jitter(start.x)},${jitter(start.y)}`;

  for (let i = 1; i < points.length; i++) {
    const curr = GRID_COORDS[points[i]];
    if (curr) {
      path += ` L ${jitter(curr.x)},${jitter(curr.y)}`;
    }
  }

  return path;
}

function createBorder(variant: SigilVariant): string {
  if (variant === 'minimal') return '';

  const r = 42;
  const c = 50;
  const d = `
    M ${c + r},${c}
    Q ${c + r},${c + r} ${c},${c + r}
    Q ${c - r},${c + r} ${c - r},${c}
    Q ${c - r},${c - r} ${c},${c - r}
    Q ${c + r},${c - r} ${c + r},${c}
  `;

  if (variant === 'dense') {
    return `
      <path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />
      <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="0.5" fill="none" opacity="0.4" />
    `;
  }

  return `<path d="${d}" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.8" />`;
}

function generateTrueSigil(
  letters: string | string[],
  variant: SigilVariant = 'balanced'
): SigilGenerationResult {
  const points = processIntent(letters, variant);
  const pathData = createSigilPath(points);
  const strokeWidth = variant === 'dense' ? 3 : 2;

  const svg = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" color="#FFFFFF">
      <g>
        ${createBorder(variant)}

        <path
          d="${pathData}"
          stroke="currentColor"
          stroke-width="${strokeWidth}"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
  `;

  return {
    svg,
    variant,
  };
}

// ============================================================================
// TEST SIGIL DEFINITIONS
// ============================================================================

interface TestSigil {
  id: number;
  intention: string;
  distilledLetters: string;
  complexity: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  variant: SigilVariant;
  purpose: string;
}

const TEST_SIGILS: TestSigil[] = [
  {
    id: 1,
    intention: 'I attract wealth',
    distilledLetters: 'TRCTWLTH',
    complexity: 'Medium',
    variant: 'balanced',
    purpose: 'Baseline test',
  },
  {
    id: 2,
    intention: 'I am confident',
    distilledLetters: 'MCNFDNT',
    complexity: 'Medium',
    variant: 'balanced',
    purpose: 'Standard complexity',
  },
  {
    id: 3,
    intention: 'Protect my home',
    distilledLetters: 'PRTCTMYHM',
    complexity: 'High',
    variant: 'dense',
    purpose: 'Complex structure',
  },
  {
    id: 4,
    intention: 'Find peace',
    distilledLetters: 'FNDPC',
    complexity: 'Low',
    variant: 'minimal',
    purpose: 'Simple structure',
  },
  {
    id: 5,
    intention: 'Creative power',
    distilledLetters: 'CRTVPWR',
    complexity: 'Medium',
    variant: 'dense',
    purpose: 'Dense variant test',
  },
  {
    id: 6,
    intention: 'Heal my body',
    distilledLetters: 'HLMYBDY',
    complexity: 'Medium',
    variant: 'balanced',
    purpose: 'Organic flow',
  },
  {
    id: 7,
    intention: 'Success flows',
    distilledLetters: 'SCCSFLWS',
    complexity: 'High',
    variant: 'dense',
    purpose: 'Complex dense',
  },
  {
    id: 8,
    intention: 'Love returns',
    distilledLetters: 'LVRTNS',
    complexity: 'Low',
    variant: 'minimal',
    purpose: 'Simple minimal',
  },
  {
    id: 9,
    intention: 'Transform self',
    distilledLetters: 'TRNSFRMSLF',
    complexity: 'Very High',
    variant: 'dense',
    purpose: 'Edge case complexity',
  },
  {
    id: 10,
    intention: 'Be free',
    distilledLetters: 'BFR',
    complexity: 'Very Low',
    variant: 'minimal',
    purpose: 'Edge case simplicity',
  },
];

// ============================================================================
// MAIN SCRIPT
// ============================================================================

async function main() {
  console.log('🚀 Spike Phase: Generating Test Sigils\n');
  console.log('=' .repeat(60));

  // Create output directories
  const outputDir = path.join(process.cwd(), 'spike-phase');
  const svgDir = path.join(outputDir, 'test-sigils-svg');
  const pngDir = path.join(outputDir, 'test-sigils-png');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(svgDir, { recursive: true });
  await fs.mkdir(pngDir, { recursive: true });

  console.log(`\n📁 Output directories created:`);
  console.log(`   SVG: ${svgDir}`);
  console.log(`   PNG: ${pngDir}\n`);

  const results: any[] = [];

  // Generate each test sigil
  for (const test of TEST_SIGILS) {
    console.log(`\n[${test.id}/10] ${test.intention}`);
    console.log(`   Letters: ${test.distilledLetters}`);
    console.log(`   Complexity: ${test.complexity} | Variant: ${test.variant}`);
    console.log(`   Purpose: ${test.purpose}`);

    try {
      // Generate sigil SVG
      const result = generateTrueSigil(test.distilledLetters, test.variant);

      // Save SVG
      const svgFilename = `sigil_${test.id}_${test.variant}_${test.complexity.toLowerCase().replace(' ', '_')}.svg`;
      const svgPath = path.join(svgDir, svgFilename);
      await fs.writeFile(svgPath, result.svg);
      console.log(`   ✅ SVG saved: ${svgFilename}`);

      // Rasterize to PNG
      const pngFilename = `sigil_${test.id}_${test.variant}_${test.complexity.toLowerCase().replace(' ', '_')}.png`;
      const pngPath = path.join(pngDir, pngFilename);
      await rasterizeToFile(result.svg, pngPath);

      // Get PNG metadata
      const pngBuffer = await fs.readFile(pngPath);

      results.push({
        ...test,
        svgPath: svgFilename,
        pngPath: pngFilename,
        svgSize: result.svg.length,
        pngSize: pngBuffer.length,
      });

    } catch (error) {
      console.error(`   ❌ Error generating sigil ${test.id}:`, error);
    }
  }

  // Generate summary report
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Generation Summary\n');

  console.log(`Total sigils generated: ${results.length}/10`);
  console.log(`\nComplexity breakdown:`);
  console.log(`   Very Low: ${results.filter(r => r.complexity === 'Very Low').length}`);
  console.log(`   Low:      ${results.filter(r => r.complexity === 'Low').length}`);
  console.log(`   Medium:   ${results.filter(r => r.complexity === 'Medium').length}`);
  console.log(`   High:     ${results.filter(r => r.complexity === 'High').length}`);
  console.log(`   Very High: ${results.filter(r => r.complexity === 'Very High').length}`);

  console.log(`\nVariant breakdown:`);
  console.log(`   Dense:    ${results.filter(r => r.variant === 'dense').length}`);
  console.log(`   Balanced: ${results.filter(r => r.variant === 'balanced').length}`);
  console.log(`   Minimal:  ${results.filter(r => r.variant === 'minimal').length}`);

  // Save metadata JSON
  const metadataPath = path.join(outputDir, 'test-sigils-metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ Metadata saved: test-sigils-metadata.json`);

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Test sigils generation complete!\n');
  console.log('Next steps:');
  console.log('1. Review PNGs in spike-phase/test-sigils-png/');
  console.log('2. Test ControlNet with these images');
  console.log('3. Evaluate structure preservation\n');
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
