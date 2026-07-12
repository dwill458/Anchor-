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
    intentionText: 'steady focus',
    style: 'architectural_trace',
  },
  {
    name: 'Confidence / courage',
    intentionText: 'radiant confidence',
    style: 'solar_halo',
  },
  {
    name: 'Abundance / growth',
    intentionText: 'abundance and growth',
    style: 'verdigris_relic',
  },
  {
    name: 'Healing / peace',
    intentionText: 'peace and healing',
    style: 'tideglass',
  },
  {
    name: 'Love / relationship',
    intentionText: 'deeper connection in my relationship',
    style: 'prism_veil',
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
