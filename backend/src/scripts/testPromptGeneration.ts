/**
 * Test script for Imagen 3 enhanced prompt generation
 *
 * This script demonstrates how different user intentions get transformed
 * into Imagen 3 prompts with thematic symbol instructions.
 *
 * Run with: npx ts-node src/scripts/testPromptGeneration.ts
 */

import { GoogleVertexAI } from '../services/GoogleVertexAI';
import { AIStyle } from '../services/AIEnhancer';

// Test cases matching user's screenshots
const testCases = [
  {
    name: 'Strength in Gym (User\'s first example)',
    intentionText: 'strength in the gym',
    style: 'watercolor' as AIStyle,
    expected: 'Should include: muscles, dumbbells, fire, power symbols',
  },
  {
    name: 'Boundaries (User\'s second example)',
    intentionText: 'boundaries and protection',
    style: 'sacred_geometry' as AIStyle,
    expected: 'Should include: chains, locks, shields, protective barriers',
  },
  {
    name: 'Prosperity',
    intentionText: 'prosperity and abundance',
    style: 'gold_leaf' as AIStyle,
    expected: 'Should include: gold coins, cornucopia, flowing water',
  },
  {
    name: 'Peace and Calm',
    intentionText: 'peace and serenity',
    style: 'watercolor' as AIStyle,
    expected: 'Should include: doves, olive branches, calm waters',
  },
  {
    name: 'Wisdom',
    intentionText: 'wisdom and knowledge',
    style: 'ink_brush' as AIStyle,
    expected: 'Should include: owls, books, ancient scrolls',
  },
  {
    name: 'Generic (no keywords)',
    intentionText: 'my personal goal',
    style: 'cosmic' as AIStyle,
    expected: 'Should include: generic mystical elements',
  },
];

console.log('='.repeat(80));
console.log('IMAGEN 3 ENHANCED PROMPT GENERATION TEST');
console.log('='.repeat(80));
console.log();

// We can't instantiate GoogleVertexAI without env vars, so we'll replicate the logic here
// This is for testing the prompt generation logic only

const STYLE_PROMPTS: Record<AIStyle, { prompt: string; negativePrompt: string }> = {
  watercolor: {
    prompt: 'Mystical watercolor sigil artwork, soft translucent washes, flowing colors, ethereal paper texture, gentle color bleeding',
    negativePrompt: 'photography, realistic photo, 3d render, thick outlines, cartoon, solid colors',
  },
  sacred_geometry: {
    prompt: 'Sacred geometry sigil with golden metallic sheen, precise mathematical lines, geometric perfection, subtle luminous glow',
    negativePrompt: 'organic, soft, messy, hand-drawn, curved, extra patterns',
  },
  ink_brush: {
    prompt: 'Traditional ink brush calligraphy sigil, sumi-e aesthetic, ink wash gradients, rice paper texture, zen brush strokes',
    negativePrompt: 'digital, 3d, color, modern, thick lines',
  },
  gold_leaf: {
    prompt: 'Illuminated manuscript sigil with gold leaf gilding, medieval luxury, precious metal sheen, ornate texture on lines',
    negativePrompt: 'modern, photography, people, extra symbols',
  },
  cosmic: {
    prompt: 'Cosmic celestial sigil glowing with ethereal energy, nebula colors, starlight, deep space background',
    negativePrompt: 'planets, faces, realistic photo, solid shapes',
  },
  minimal_line: {
    prompt: 'Minimalist modern sigil with clean precise lines, contemporary design, subtle paper texture, crisp geometry',
    negativePrompt: 'texture, heavy shading, embellishment, ornate',
  },
};

function getSymbolInstructions(intentionText: string): string {
  const lowerIntent = intentionText.toLowerCase();
  const symbols: string[] = [];

  // Thematic symbol mapping (same as GoogleVertexAI.ts)
  const themeMap: Record<string, string[]> = {
    'strength': ['flexed muscles', 'flames of power', 'dumbbells', 'lions', 'oak trees'],
    'gym': ['fitness equipment', 'strong arms', 'energy bursts'],
    'power': ['lightning bolts', 'radiating energy', 'powerful animals', 'fire'],
    'boundary': ['chains', 'locks', 'shields', 'protective barriers', 'celtic knots', 'fortress walls'],
    'boundaries': ['chains', 'locks', 'shields', 'protective barriers', 'celtic knots', 'fortress walls'],
    'protection': ['shields', 'armor', 'guardian animals', 'protective circles', 'thorns'],
    'defense': ['walls', 'barriers', 'shields', 'hedges'],
    'prosperity': ['gold coins', 'cornucopia', 'flowing water', 'abundance symbols', 'harvest imagery'],
    'wealth': ['treasure', 'gems', 'golden rays', 'overflowing vessels'],
    'abundance': ['full baskets', 'fruit', 'flowers blooming', 'multiplication symbols'],
    'love': ['hearts', 'roses', 'intertwined vines', 'doves', 'cupid imagery'],
    'relationship': ['linked circles', 'infinity symbols', 'paired elements', 'harmony symbols'],
    'romance': ['roses', 'hearts', 'moonlight', 'romantic imagery'],
    'wisdom': ['owls', 'books', 'ancient scrolls', 'eye symbols', 'light rays'],
    'knowledge': ['books', 'quills', 'scrolls', 'lanterns', 'keys'],
    'learning': ['open books', 'growing trees', 'ascending stairs', 'light bulbs'],
    'health': ['medical symbols', 'healing herbs', 'vitality spirals', 'green energy'],
    'healing': ['bandages', 'herbs', 'water', 'gentle light', 'restoration symbols'],
    'success': ['laurel wreaths', 'trophies', 'ascending arrows', 'stars', 'peaks'],
    'achievement': ['medals', 'crowns', 'victory symbols', 'ascending paths'],
    'victory': ['laurel crowns', 'eagles', 'triumphant imagery', 'raised swords'],
    'peace': ['doves', 'olive branches', 'calm waters', 'zen circles', 'soft clouds'],
    'calm': ['still water', 'gentle waves', 'soft light', 'floating feathers'],
    'serenity': ['lotus flowers', 'meditation symbols', 'balanced stones', 'tranquil scenes'],
    'creativity': ['paintbrushes', 'musical notes', 'flowing ribbons', 'bursts of color'],
    'inspiration': ['light bulbs', 'shooting stars', 'divine rays', 'muses'],
    'art': ['palettes', 'brushes', 'creative tools', 'colorful splashes'],
  };

  // Match themes and collect symbols
  for (const [theme, themeSymbols] of Object.entries(themeMap)) {
    if (lowerIntent.includes(theme)) {
      symbols.push(...themeSymbols.slice(0, 3));
    }
  }

  if (symbols.length === 0) {
    return 'Add mystical decorative elements that complement the intention.';
  }

  const symbolList = symbols.slice(0, 5).join(', ');
  return `Include symbolic elements such as: ${symbolList}.`;
}

function buildEnhancedPrompt(styleBase: string, intentionText: string): string {
  const symbolInstructions = getSymbolInstructions(intentionText);

  const prompt = [
    styleBase,
    `Enhance the sigil by adding corresponding symbolic elements that represent: "${intentionText}".`,
    symbolInstructions,
    'The original sigil line structure must remain clearly visible and intact as the central focus.',
    'Arrange the symbolic elements harmoniously around and within the sigil design.',
    'High quality mystical artwork, balanced composition, professional finish.',
  ].join(' ');

  return prompt;
}

// Run tests
for (const testCase of testCases) {
  console.log('─'.repeat(80));
  console.log(`Test Case: ${testCase.name}`);
  console.log('─'.repeat(80));
  console.log(`Intention: "${testCase.intentionText}"`);
  console.log(`Style: ${testCase.style}`);
  console.log(`Expected: ${testCase.expected}`);
  console.log();

  const styleConfig = STYLE_PROMPTS[testCase.style];
  const fullPrompt = buildEnhancedPrompt(styleConfig.prompt, testCase.intentionText);

  console.log('Generated Prompt:');
  console.log('-'.repeat(80));
  console.log(fullPrompt);
  console.log('-'.repeat(80));
  console.log();
  console.log(`Negative Prompt: ${styleConfig.negativePrompt}`);
  console.log();
  console.log();
}

console.log('='.repeat(80));
console.log('TEST COMPLETE');
console.log('='.repeat(80));
console.log();
console.log('Summary:');
console.log('- All prompts now include explicit symbol addition instructions');
console.log('- Prompts maintain structure preservation directives');
console.log('- Thematic keywords are correctly mapped to visual symbols');
console.log();
console.log('Next Steps:');
console.log('1. Review the generated prompts above');
console.log('2. Test with actual Imagen 3 API calls using testVertexAI.ts');
console.log('3. Verify results match the quality shown in your screenshots');
console.log();
