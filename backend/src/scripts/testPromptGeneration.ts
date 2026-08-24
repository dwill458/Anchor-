/**
 * Smoke script for the Anchor style prompt library.
 *
 * Run with: npx ts-node src/scripts/testPromptGeneration.ts
 */

import {
  VALID_AI_STYLES,
  buildStylePrompt,
  deriveIntentionSignal,
  getStyleNegativePrompt,
  type AIStyle,
} from '../services/stylePromptLibrary';

const testCases: Array<{ name: string; intentionText: string; style: AIStyle }> = [
  {
    name: 'Focus / discipline',
    intentionText: 'steady deep work and execution discipline',
    style: 'architectural_trace',
  },
  {
    name: 'Confidence / courage',
    intentionText: 'unshakable courage and leadership power',
    style: 'solar_halo',
  },
  {
    name: 'Abundance / growth',
    intentionText: 'exponential financial growth and scaling momentum',
    style: 'verdigris_relic',
  },
  {
    name: 'Recovery / reset',
    intentionText: 'deep recovery, rest, and mental reset',
    style: 'tideglass',
  },
  {
    name: 'Love / relationship',
    intentionText: 'deeper connection, trust, and intimacy in my relationship',
    style: 'prism_veil',
  },
  {
    name: 'Protection / stability',
    intentionText: 'unshakable boundary and bedrock stability',
    style: 'obsidian_mono',
  },
  {
    name: 'Creativity / expression',
    intentionText: 'innovative craftsmanship, creative design, and original vision',
    style: 'cosmic',
  },
];

console.log('='.repeat(80));
console.log('ANCHOR STYLE PROMPT LIBRARY SMOKE TEST');
console.log('='.repeat(80));
console.log(`Styles: ${VALID_AI_STYLES.length}`);
console.log();

for (const testCase of testCases) {
  const signal = deriveIntentionSignal(testCase.intentionText);
  const prompt = buildStylePrompt(testCase.intentionText, testCase.style, 0);

  console.log('-'.repeat(80));
  console.log(`Test Case: ${testCase.name}`);
  console.log(`Style: ${testCase.style}`);
  console.log(`Signal Theme: ${signal.theme}`);
  console.log('-'.repeat(80));
  console.log(prompt);
  console.log('-'.repeat(80));
  console.log(`Negative Prompt: ${getStyleNegativePrompt(testCase.style)}`);
  console.log();
}

console.log('TEST COMPLETE');
