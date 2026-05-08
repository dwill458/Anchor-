/**
 * Intention Pattern Detection
 *
 * Simple regex patterns to detect future tense and negation in intention strings.
 * Used to provide guide hints in Guide Mode.
 *
 * Patterns:
 * - Future tense: "I will", "I'm going to", "going to", "someday"
 * - Negation: "don't", "stop", "won't", "not"
 */

export interface IntentionPatternDetection {
  hasFutureTense: boolean;
  hasNegation: boolean;
  shouldShowGuidance: boolean;
}

let lastAnalyzedText = '';

/** Detect if intention uses future tense language */
export function detectFutureTense(text: string): boolean {
  const futurePhrases = [
    /\bi\s+will\b/i,      // "I will"
    /\bi['']m\s+going\s+to\b/i, // "I'm going to"
    /\bgoing\s+to\b/i,    // "going to"
    /\bsomeday\b/i,       // "someday"
  ];
  return futurePhrases.some((pattern) => pattern.test(text));
}

/** Detect if intention uses negation language */
export function detectNegation(text: string): boolean {
  const negationPhrases = [
    /\bdon['']t\b/i,      // "don't"
    /\bstop\b/i,          // "stop"
    /\bwon['']t\b/i,      // "won't"
    /\bnot\b/i,           // "not"
  ];
  return negationPhrases.some((pattern) => pattern.test(text));
}

export function detectGibberish(text: string): boolean {
  if (text.trim().length < 6) return false;
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return false;
  const vowels = letters.replace(/[^aeiouAEIOU]/g, '');
  const vowelRatio = vowels.length / letters.length;
  const unique = new Set(letters.toLowerCase()).size;
  const uniqueRatio = unique / letters.length;
  return vowelRatio < 0.15 && uniqueRatio < 0.5;
}

/** Analyze intention and return guidance flags */
export function analyzeIntention(text: string): IntentionPatternDetection {
  lastAnalyzedText = text;
  const hasFutureTense = detectFutureTense(text);
  const hasNegation = detectNegation(text);

  return {
    hasFutureTense,
    hasNegation,
    // Show guidance if either pattern is detected
    shouldShowGuidance: hasFutureTense || hasNegation,
  };
}

/** Get guidance text based on detected patterns */
export function getGuidanceText(
  hasFutureTense: boolean,
  hasNegation: boolean
): string {
  if (detectGibberish(lastAnalyzedText)) {
    return "That doesn't look like an intention. What do you actually want?";
  }
  if (hasFutureTense && hasNegation) {
    return 'Try present tense & affirmative: "I choose…" or "I return…"';
  }
  if (hasFutureTense) {
    return 'Try present tense: "I choose…" "I am…" or "I return…"';
  }
  if (hasNegation) {
    return 'Try affirmative: "I choose…" instead of "I don\'t…"';
  }
  return '';
}
