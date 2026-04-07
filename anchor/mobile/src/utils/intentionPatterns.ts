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

/** Analyze intention and return guidance flags */
export function analyzeIntention(text: string): IntentionPatternDetection {
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
