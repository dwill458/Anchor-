/**
 * Anchor App - Mystical Symbol Database
 *
 * Categorized symbols for AI-enhanced sigil generation.
 * Based on traditional occult systems: planetary seals, runes, sacred geometry, etc.
 */

export interface Symbol {
  id: string;
  name: string;
  category: SymbolCategory;
  themes: string[]; // Keywords this symbol resonates with
  description: string;
  unicode?: string; // Unicode character if available
  svgPath?: string; // SVG path data for custom symbols
}

export type SymbolCategory =
  | 'planetary'
  | 'rune'
  | 'elemental'
  | 'geometry'
  | 'lunar'
  | 'zodiac';

/**
 * Complete symbol database
 */
export const SYMBOL_DATABASE: Symbol[] = [
  // PLANETARY SEALS (Intelligence seals from grimoire tradition)
  {
    id: 'jupiter_seal',
    name: 'Seal of Jupiter',
    category: 'planetary',
    themes: ['wealth', 'abundance', 'success', 'expansion', 'growth', 'prosperity', 'business'],
    description: 'Jupiter governs expansion, abundance, and material success. Ideal for business ventures and financial growth.',
    unicode: '♃',
  },
  {
    id: 'mercury_seal',
    name: 'Seal of Mercury',
    category: 'planetary',
    themes: ['communication', 'intellect', 'learning', 'speed', 'travel', 'negotiation', 'clarity'],
    description: 'Mercury rules communication, quick thinking, and adaptability. Perfect for deals, learning, and mental clarity.',
    unicode: '☿',
  },
  {
    id: 'venus_seal',
    name: 'Seal of Venus',
    category: 'planetary',
    themes: ['love', 'beauty', 'relationships', 'harmony', 'attraction', 'art', 'pleasure'],
    description: 'Venus governs love, beauty, and harmonious relationships. Use for romantic intentions and creative pursuits.',
    unicode: '♀',
  },
  {
    id: 'mars_seal',
    name: 'Seal of Mars',
    category: 'planetary',
    themes: ['strength', 'courage', 'action', 'victory', 'competition', 'energy', 'power'],
    description: 'Mars rules courage, assertiveness, and decisive action. Ideal for competition and overcoming obstacles.',
    unicode: '♂',
  },
  {
    id: 'saturn_seal',
    name: 'Seal of Saturn',
    category: 'planetary',
    themes: ['discipline', 'structure', 'patience', 'karma', 'time', 'boundaries', 'mastery'],
    description: 'Saturn governs discipline, long-term goals, and karmic lessons. Use for building lasting foundations.',
    unicode: '♄',
  },
  {
    id: 'sun_seal',
    name: 'Seal of the Sun',
    category: 'planetary',
    themes: ['vitality', 'success', 'leadership', 'confidence', 'health', 'energy', 'power'],
    description: 'The Sun rules vitality, leadership, and self-confidence. Perfect for personal empowerment and health.',
    unicode: '☉',
  },
  {
    id: 'moon_seal',
    name: 'Seal of the Moon',
    category: 'planetary',
    themes: ['intuition', 'emotions', 'dreams', 'subconscious', 'feminine', 'cycles', 'reflection'],
    description: 'The Moon governs intuition, emotions, and the subconscious. Use for inner work and emotional healing.',
    unicode: '☽',
  },

  // ELDER FUTHARK RUNES
  {
    id: 'rune_fehu',
    name: 'Fehu (Wealth)',
    category: 'rune',
    themes: ['wealth', 'money', 'prosperity', 'abundance', 'cattle', 'possession'],
    description: 'The rune of mobile wealth and material abundance. Ancient symbol of prosperity.',
    unicode: 'ᚠ',
  },
  {
    id: 'rune_ansuz',
    name: 'Ansuz (Communication)',
    category: 'rune',
    themes: ['communication', 'wisdom', 'divine', 'inspiration', 'speech', 'clarity'],
    description: 'The rune of divine communication and wisdom. Associated with Odin and inspired speech.',
    unicode: 'ᚨ',
  },
  {
    id: 'rune_thurisaz',
    name: 'Thurisaz (Protection)',
    category: 'rune',
    themes: ['protection', 'defense', 'strength', 'thorn', 'boundaries', 'power'],
    description: 'The rune of defense and reactive force. A protective thorn against adversity.',
    unicode: 'ᚦ',
  },
  {
    id: 'rune_gebo',
    name: 'Gebo (Partnership)',
    category: 'rune',
    themes: ['partnership', 'gift', 'balance', 'relationship', 'exchange', 'harmony'],
    description: 'The rune of gifts and balanced exchange. Symbolizes partnership and mutual benefit.',
    unicode: 'ᚷ',
  },
  {
    id: 'rune_tiwaz',
    name: 'Tiwaz (Victory)',
    category: 'rune',
    themes: ['victory', 'honor', 'courage', 'justice', 'warrior', 'success'],
    description: 'The rune of the warrior spirit and righteous victory. Associated with Tyr, god of war.',
    unicode: 'ᛏ',
  },
  {
    id: 'rune_sowilo',
    name: 'Sowilo (Success)',
    category: 'rune',
    themes: ['success', 'sun', 'victory', 'wholeness', 'power', 'energy'],
    description: 'The rune of the sun and success. Represents life force and achievement.',
    unicode: 'ᛋ',
  },

  // ELEMENTAL SYMBOLS
  {
    id: 'fire_element',
    name: 'Fire',
    category: 'elemental',
    themes: ['passion', 'transformation', 'energy', 'action', 'courage', 'willpower'],
    description: 'Fire represents transformation, passion, and willpower. The spark of creation.',
    unicode: '🜂',
  },
  {
    id: 'water_element',
    name: 'Water',
    category: 'elemental',
    themes: ['emotion', 'intuition', 'flow', 'healing', 'cleansing', 'subconscious'],
    description: 'Water governs emotions, intuition, and the flow of life. Healing and adaptive.',
    unicode: '🜄',
  },
  {
    id: 'air_element',
    name: 'Air',
    category: 'elemental',
    themes: ['thought', 'communication', 'intellect', 'freedom', 'clarity', 'inspiration'],
    description: 'Air rules the mental realm, communication, and new ideas. The breath of inspiration.',
    unicode: '🜁',
  },
  {
    id: 'earth_element',
    name: 'Earth',
    category: 'elemental',
    themes: ['grounding', 'stability', 'material', 'growth', 'foundation', 'abundance'],
    description: 'Earth represents stability, material manifestation, and grounded growth.',
    unicode: '🜃',
  },

  // SACRED GEOMETRY
  {
    id: 'vesica_piscis',
    name: 'Vesica Piscis',
    category: 'geometry',
    themes: ['creation', 'birth', 'union', 'duality', 'balance', 'harmony'],
    description: 'Two intersecting circles symbolizing creation, balance, and the union of opposites.',
  },
  {
    id: 'pentagram',
    name: 'Pentagram',
    category: 'geometry',
    themes: ['protection', 'balance', 'elements', 'spirit', 'mastery', 'wholeness'],
    description: 'Five-pointed star representing the five elements in balance under spirit.',
    unicode: '⛤',
  },
  {
    id: 'hexagram',
    name: 'Hexagram',
    category: 'geometry',
    themes: ['balance', 'harmony', 'union', 'masculine', 'feminine', 'unity'],
    description: 'Two interlocking triangles symbolizing the union of masculine and feminine energies.',
    unicode: '✡',
  },
  {
    id: 'spiral',
    name: 'Spiral',
    category: 'geometry',
    themes: ['growth', 'evolution', 'expansion', 'journey', 'transformation', 'consciousness'],
    description: 'The spiral represents growth, evolution, and the journey of consciousness expanding.',
  },

  // LUNAR PHASES
  {
    id: 'new_moon',
    name: 'New Moon',
    category: 'lunar',
    themes: ['beginnings', 'intention', 'potential', 'darkness', 'seeding', 'manifestation'],
    description: 'The new moon is for setting intentions and planting seeds for manifestation.',
    unicode: '🌑',
  },
  {
    id: 'waxing_moon',
    name: 'Waxing Moon',
    category: 'lunar',
    themes: ['growth', 'building', 'attraction', 'increase', 'progress', 'momentum'],
    description: 'The waxing moon supports growth, building energy, and attracting desires.',
    unicode: '🌒',
  },
  {
    id: 'full_moon',
    name: 'Full Moon',
    category: 'lunar',
    themes: ['completion', 'power', 'illumination', 'peak', 'culmination', 'celebration'],
    description: 'The full moon represents peak power, completion, and illumination of truth.',
    unicode: '🌕',
  },
  {
    id: 'waning_moon',
    name: 'Waning Moon',
    category: 'lunar',
    themes: ['release', 'banishing', 'decrease', 'letting go', 'cleansing', 'rest'],
    description: 'The waning moon supports release, banishing negativity, and rest.',
    unicode: '🌘',
  },
];

/**
 * Get symbols by category
 */
export function getSymbolsByCategory(category: SymbolCategory): Symbol[] {
  return SYMBOL_DATABASE.filter(symbol => symbol.category === category);
}

/**
 * Get symbols by theme keyword
 */
export function getSymbolsByTheme(theme: string): Symbol[] {
  const normalizedTheme = theme.toLowerCase();
  return SYMBOL_DATABASE.filter(symbol =>
    symbol.themes.some(t => t.toLowerCase().includes(normalizedTheme))
  );
}

/**
 * Get symbol by ID
 */
export function getSymbolById(id: string): Symbol | undefined {
  return SYMBOL_DATABASE.find(symbol => symbol.id === id);
}
