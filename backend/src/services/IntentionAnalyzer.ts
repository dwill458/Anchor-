/**
 * Anchor App - Intention Analyzer Service
 *
 * Uses NLP to extract themes from intention text and intelligently select
 * mystical symbols for AI-enhanced sigil generation.
 */

import nlp from 'compromise';
import { Symbol, SYMBOL_DATABASE, getSymbolsByTheme } from '../data/symbols';

export interface AnalysisResult {
  intentionText: string;
  keywords: string[]; // Extracted keywords (nouns, verbs, adjectives)
  themes: string[]; // Archetypal themes detected
  selectedSymbols: Symbol[]; // 2-4 symbols chosen for AI enhancement
  aesthetic: AestheticApproach; // Visual style for AI generation
  explanation: string; // Human-readable explanation of choices
}

export type AestheticApproach =
  | 'grimoire' // Medieval, manuscript-style, ornate
  | 'minimal' // Clean, modern, abstract
  | 'cosmic' // Celestial, starfield, mystical
  | 'geometric' // Sacred geometry, mathematical
  | 'organic'; // Natural, flowing, botanical

/**
 * Keyword to theme mapping
 * Maps common intention keywords to archetypal themes
 */
const KEYWORD_TO_THEME: Record<string, string[]> = {
  // Wealth & Prosperity
  money: ['wealth', 'prosperity', 'abundance'],
  wealth: ['wealth', 'prosperity', 'abundance'],
  rich: ['wealth', 'prosperity', 'abundance'],
  prosper: ['wealth', 'prosperity', 'growth'],
  abundance: ['abundance', 'wealth', 'growth'],
  financial: ['wealth', 'prosperity', 'success'],
  income: ['wealth', 'abundance', 'growth'],

  // Success & Achievement
  success: ['success', 'victory', 'achievement'],
  achieve: ['success', 'victory', 'accomplishment'],
  win: ['victory', 'success', 'triumph'],
  victory: ['victory', 'success', 'power'],
  accomplish: ['success', 'achievement', 'completion'],
  goal: ['success', 'achievement', 'focus'],
  complete: ['completion', 'success', 'wholeness'],

  // Career & Business
  career: ['success', 'growth', 'leadership'],
  job: ['success', 'stability', 'abundance'],
  business: ['wealth', 'success', 'growth'],
  deal: ['success', 'communication', 'negotiation'],
  close: ['completion', 'success', 'achievement'],
  promotion: ['success', 'growth', 'recognition'],
  contract: ['success', 'partnership', 'completion'],

  // Love & Relationships
  love: ['love', 'attraction', 'harmony'],
  relationship: ['love', 'partnership', 'harmony'],
  partner: ['partnership', 'balance', 'union'],
  attract: ['attraction', 'magnetism', 'beauty'],
  romance: ['love', 'passion', 'attraction'],
  marriage: ['union', 'partnership', 'commitment'],
  connection: ['communication', 'relationship', 'harmony'],

  // Health & Vitality
  health: ['vitality', 'healing', 'strength'],
  heal: ['healing', 'restoration', 'wholeness'],
  energy: ['vitality', 'power', 'strength'],
  strength: ['strength', 'power', 'resilience'],
  vitality: ['vitality', 'health', 'energy'],
  wellness: ['health', 'balance', 'harmony'],
  recovery: ['healing', 'restoration', 'renewal'],

  // Communication & Learning
  communicate: ['communication', 'clarity', 'expression'],
  speak: ['communication', 'expression', 'voice'],
  learn: ['learning', 'wisdom', 'growth'],
  study: ['learning', 'focus', 'intellect'],
  understand: ['clarity', 'wisdom', 'insight'],
  clarity: ['clarity', 'vision', 'understanding'],
  negotiate: ['communication', 'balance', 'diplomacy'],

  // Protection & Boundaries
  protect: ['protection', 'boundaries', 'defense'],
  safe: ['protection', 'security', 'stability'],
  defend: ['protection', 'strength', 'boundaries'],
  boundary: ['boundaries', 'protection', 'structure'],
  shield: ['protection', 'defense', 'safety'],

  // Personal Growth
  grow: ['growth', 'expansion', 'evolution'],
  transform: ['transformation', 'change', 'renewal'],
  change: ['transformation', 'transition', 'evolution'],
  evolve: ['evolution', 'growth', 'transformation'],
  develop: ['growth', 'expansion', 'mastery'],
  improve: ['growth', 'enhancement', 'progress'],

  // Spiritual & Inner Work
  manifest: ['manifestation', 'creation', 'intention'],
  create: ['creation', 'manifestation', 'artistry'],
  intuition: ['intuition', 'insight', 'wisdom'],
  peace: ['harmony', 'tranquility', 'balance'],
  balance: ['balance', 'harmony', 'equilibrium'],
  harmony: ['harmony', 'balance', 'unity'],
  wisdom: ['wisdom', 'knowledge', 'insight'],
};

/**
 * Aesthetic determination based on themes
 */
function determineAesthetic(themes: string[]): AestheticApproach {
  // Grimoire: Traditional mystical, ancient wisdom themes
  if (themes.some(t => ['wisdom', 'ancient', 'tradition', 'mastery'].includes(t))) {
    return 'grimoire';
  }

  // Cosmic: Celestial, expansive, universal themes
  if (themes.some(t => ['universe', 'cosmic', 'star', 'celestial', 'infinite'].includes(t))) {
    return 'cosmic';
  }

  // Geometric: Structural, mathematical, balance themes
  if (themes.some(t => ['structure', 'balance', 'geometry', 'symmetry', 'order'].includes(t))) {
    return 'geometric';
  }

  // Organic: Natural, flowing, growth themes
  if (themes.some(t => ['growth', 'nature', 'organic', 'flow', 'healing'].includes(t))) {
    return 'organic';
  }

  // Default: Minimal for modern, clean approaches
  return 'minimal';
}

/**
 * Generate explanation of symbol choices
 */
function generateExplanation(
  intentionText: string,
  keywords: string[],
  themes: string[],
  symbols: Symbol[],
  aesthetic: AestheticApproach
): string {
  const parts: string[] = [];

  // Opening
  parts.push(`Your intention "${intentionText}" carries powerful themes.`);

  // Keywords analysis
  if (keywords.length > 0) {
    parts.push(
      `I've identified key elements: ${keywords.slice(0, 3).join(', ')}.`
    );
  }

  // Themes
  if (themes.length > 0) {
    parts.push(
      `This resonates with archetypal forces of ${themes.slice(0, 3).join(', ')}.`
    );
  }

  // Symbols
  if (symbols.length > 0) {
    const symbolNames = symbols.map(s => s.name).join(', ');
    parts.push(
      `I've selected ${symbolNames} to amplify your intention.`
    );
  }

  // Aesthetic
  const aestheticDesc: Record<AestheticApproach, string> = {
    grimoire: 'The AI will render this in a grimoire style—ornate, manuscript-inspired, with ancient mystical energy.',
    minimal: 'The AI will render this in a minimal style—clean, modern, with focused clarity.',
    cosmic: 'The AI will render this in a cosmic style—celestial, expansive, with universal energy.',
    geometric: 'The AI will render this in a geometric style—sacred patterns, mathematical harmony.',
    organic: 'The AI will render this in an organic style—flowing, natural, with living energy.',
  };
  parts.push(aestheticDesc[aesthetic]);

  return parts.join(' ');
}

/**
 * Main analysis function
 */
export function analyzeIntention(intentionText: string): AnalysisResult {
  // Step 1: Extract keywords using NLP
  const doc = nlp(intentionText.toLowerCase());

  // Get nouns, verbs, and adjectives
  const nouns = doc.nouns().out('array') as string[];
  const verbs = doc.verbs().out('array') as string[];
  const adjectives = doc.adjectives().out('array') as string[];

  // Combine and deduplicate
  const allKeywords = [...nouns, ...verbs, ...adjectives];
  const keywords = [...new Set(allKeywords)].filter(k => k.length > 2); // Filter short words

  // Step 2: Map keywords to themes
  const themeSet = new Set<string>();
  keywords.forEach(keyword => {
    const mappedThemes = KEYWORD_TO_THEME[keyword];
    if (mappedThemes) {
      mappedThemes.forEach(theme => themeSet.add(theme));
    }
  });
  const themes = Array.from(themeSet);

  // Step 3: Select appropriate symbols (2-4 symbols)
  const symbolScores: Map<Symbol, number> = new Map();

  SYMBOL_DATABASE.forEach(symbol => {
    let score = 0;

    // Score based on theme matches
    symbol.themes.forEach(symbolTheme => {
      if (themes.includes(symbolTheme)) {
        score += 3; // High weight for direct theme match
      }
      // Partial match (keyword appears in theme)
      keywords.forEach(keyword => {
        if (symbolTheme.includes(keyword)) {
          score += 1;
        }
      });
    });

    if (score > 0) {
      symbolScores.set(symbol, score);
    }
  });

  // Sort by score and take top 2-4
  const selectedSymbols = Array.from(symbolScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([symbol]) => symbol);

  // If no symbols matched, pick default symbols based on general positivity
  if (selectedSymbols.length === 0) {
    selectedSymbols.push(
      SYMBOL_DATABASE.find(s => s.id === 'sun_seal')!,
      SYMBOL_DATABASE.find(s => s.id === 'pentagram')!
    );
  }

  // Step 4: Determine aesthetic approach
  const aesthetic = determineAesthetic(themes);

  // Step 5: Generate explanation
  const explanation = generateExplanation(
    intentionText,
    keywords,
    themes,
    selectedSymbols,
    aesthetic
  );

  return {
    intentionText,
    keywords: keywords.slice(0, 5), // Top 5 keywords
    themes: themes.slice(0, 5), // Top 5 themes
    selectedSymbols,
    aesthetic,
    explanation,
  };
}

/**
 * Get aesthetic prompt for Stable Diffusion
 */
export function getAestheticPrompt(aesthetic: AestheticApproach): string {
  const basePrompts: Record<AestheticApproach, string> = {
    grimoire:
      'medieval grimoire manuscript, ornate borders, aged parchment texture, occult symbols, mystical energy, golden ink, elaborate filigree',
    minimal:
      'minimalist modern design, clean lines, abstract geometric, high contrast, professional, elegant simplicity, contemporary art',
    cosmic:
      'cosmic celestial energy, starfield background, nebula colors, universe, mystical space, ethereal glow, infinite depth',
    geometric:
      'sacred geometry, mathematical precision, golden ratio, mandala patterns, symmetrical design, architectural harmony',
    organic:
      'organic flowing forms, natural botanical elements, living energy, fluid curves, nature-inspired, growth patterns',
  };

  return basePrompts[aesthetic];
}
