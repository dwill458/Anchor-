/**
 * Anchor App - Mantra Generator Service
 *
 * Creates pronounceable mantras from distilled letters using three different styles.
 * Optionally generates audio using Google Text-to-Speech.
 */

export interface MantraResult {
  syllabic: string; // 2-letter syllables: "CLO-STH-D"
  rhythmic: string; // 3-letter chunks with pauses: "CLO / STH / D"
  letterByLetter: string; // Individual pronunciation: "CEE ELL OH ESS..."
  phonetic: string; // Simplified phonetic: "klo-seth-duh"
}

/**
 * Letter pronunciation mapping for letter-by-letter style
 */
const LETTER_PRONUNCIATIONS: Record<string, string> = {
  A: 'AY',
  B: 'BEE',
  C: 'SEE',
  D: 'DEE',
  E: 'EE',
  F: 'EFF',
  G: 'JEE',
  H: 'AYCH',
  I: 'EYE',
  J: 'JAY',
  K: 'KAY',
  L: 'ELL',
  M: 'EMM',
  N: 'ENN',
  O: 'OH',
  P: 'PEE',
  Q: 'CUE',
  R: 'ARR',
  S: 'ESS',
  T: 'TEE',
  U: 'YOU',
  V: 'VEE',
  W: 'DOUBLE-YOU',
  X: 'EX',
  Y: 'WHY',
  Z: 'ZED',
};

/**
 * Phonetic rules for simplified pronunciation
 * Maps letter combinations to sounds
 */
const PHONETIC_RULES: Record<string, string> = {
  // Consonant clusters
  TH: 'th',
  CH: 'ch',
  SH: 'sh',
  PH: 'f',
  GH: 'g',

  // Single consonants (lowercase for flow)
  B: 'b',
  C: 'k',
  D: 'd',
  F: 'f',
  G: 'g',
  H: 'h',
  J: 'j',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  P: 'p',
  Q: 'k',
  R: 'r',
  S: 's',
  T: 't',
  V: 'v',
  W: 'w',
  X: 'x',
  Y: 'y',
  Z: 'z',
};

/**
 * Generate syllabic mantra (2-letter chunks)
 * Example: ['C', 'L', 'O', 'S', 'T', 'H', 'D'] → "CLO-STH-D"
 */
function generateSyllabic(letters: string[]): string {
  const syllables: string[] = [];

  for (let i = 0; i < letters.length; i += 2) {
    if (i + 1 < letters.length) {
      syllables.push(letters[i] + letters[i + 1]);
    } else {
      // Odd letter out - add solo
      syllables.push(letters[i]);
    }
  }

  return syllables.join('-');
}

/**
 * Generate rhythmic mantra (3-letter chunks with pauses)
 * Example: ['C', 'L', 'O', 'S', 'T', 'H', 'D'] → "CLO / STH / D"
 */
function generateRhythmic(letters: string[]): string {
  const chunks: string[] = [];

  for (let i = 0; i < letters.length; i += 3) {
    const chunk = letters.slice(i, i + 3).join('');
    chunks.push(chunk);
  }

  return chunks.join(' / ');
}

/**
 * Generate letter-by-letter pronunciation
 * Example: ['C', 'L', 'O', 'S', 'T'] → "SEE ELL OH ESS TEE"
 */
function generateLetterByLetter(letters: string[]): string {
  return letters.map(letter => LETTER_PRONUNCIATIONS[letter] || letter).join(' ');
}

/**
 * Generate phonetic mantra (simplified pronunciation with vowel insertion)
 * Example: ['C', 'L', 'S', 'T', 'H', 'D'] → "klo-seth-duh"
 */
function generatePhonetic(letters: string[]): string {
  // Convert letters to phonetic sounds
  let phonetic = '';

  for (let i = 0; i < letters.length; i++) {
    const current = letters[i];
    const next = letters[i + 1];

    // Check for two-letter combinations
    if (next && PHONETIC_RULES[current + next]) {
      phonetic += PHONETIC_RULES[current + next];
      i++; // Skip next letter (already processed)
    } else {
      phonetic += PHONETIC_RULES[current] || current.toLowerCase();
    }
  }

  // Insert vowels for pronounceability (simple heuristic: insert 'uh' or 'oh' every 2-3 consonants)
  const syllables: string[] = [];
  let currentSyllable = '';

  for (let i = 0; i < phonetic.length; i++) {
    currentSyllable += phonetic[i];

    // Create syllable breaks every 2-3 characters
    if (currentSyllable.length >= 2 && (i === phonetic.length - 1 || Math.random() > 0.5)) {
      // Add vowel sound for pronounceability
      if (currentSyllable.length === 1) {
        syllables.push(currentSyllable + 'uh');
      } else if (currentSyllable.length === 2) {
        // Insert vowel in middle
        syllables.push(currentSyllable[0] + 'o' + currentSyllable[1]);
      } else {
        syllables.push(currentSyllable + 'uh');
      }
      currentSyllable = '';
    }
  }

  // Add any remaining
  if (currentSyllable.length > 0) {
    syllables.push(currentSyllable + 'uh');
  }

  return syllables.join('-');
}

/**
 * Main mantra generation function
 */
export function generateMantra(distilledLetters: string[]): MantraResult {
  // Validate input
  if (!distilledLetters || distilledLetters.length === 0) {
    throw new Error('Cannot generate mantra from empty letters array');
  }

  if (distilledLetters.length < 2) {
    throw new Error('Need at least 2 distilled letters to generate mantra');
  }

  // Generate all three styles
  const syllabic = generateSyllabic(distilledLetters);
  const rhythmic = generateRhythmic(distilledLetters);
  const letterByLetter = generateLetterByLetter(distilledLetters);
  const phonetic = generatePhonetic(distilledLetters);

  return {
    syllabic,
    rhythmic,
    letterByLetter,
    phonetic,
  };
}

/**
 * Get recommended mantra based on letter count
 */
export function getRecommendedMantraStyle(letterCount: number): keyof MantraResult {
  if (letterCount <= 4) {
    return 'syllabic'; // Short and punchy
  } else if (letterCount <= 7) {
    return 'phonetic'; // Balanced and pronounceable
  } else {
    return 'rhythmic'; // Easier to remember with pauses
  }
}

/**
 * Format mantra for TTS (Google Text-to-Speech)
 * Adds proper spacing and phonetic hints
 */
export function formatMantraForTTS(mantra: string, style: keyof MantraResult): string {
  switch (style) {
    case 'syllabic':
      // Replace hyphens with pauses
      return mantra.replace(/-/g, ', ');

    case 'rhythmic':
      // Replace slashes with longer pauses
      return mantra.replace(/\//g, '... ');

    case 'letterByLetter':
      // Already formatted with spaces
      return mantra;

    case 'phonetic':
      // Replace hyphens with slight pauses
      return mantra.replace(/-/g, ' ');

    default:
      return mantra;
  }
}
