/**
 * Anchor App - Letter Distillation Algorithm
 *
 * Implements the Austin Osman Spare method for sigil creation.
 * Distills written intentions into essential letters by removing vowels and duplicates.
 *
 * Process:
 * 1. Remove spaces
 * 2. Remove vowels (a, e, i, o, u)
 * 3. Remove duplicate letters (keep first occurrence)
 * 4. Return uppercase letters
 *
 * Example:
 * "Close the deal" → CLOSETHEDEAL → CLSTHD → ["C","L","O","S","T","H","D"]
 *
 * @see Handoff Document Section 5.1
 */

/**
 * Result of the letter distillation process
 */
export interface DistillationResult {
  /** Original input text */
  original: string;
  /** Final distilled letters in uppercase */
  finalLetters: string[];
  /** Vowels that were removed */
  removedVowels: string[];
  /** Duplicate letters that were removed */
  removedDuplicates: string[];
}

/**
 * Set of vowels to remove (case-insensitive)
 */
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']);

/**
 * Distill an intention text into essential letters using the Austin Osman Spare method
 *
 * @param intentionText - The user's intention text to distill
 * @returns DistillationResult with final letters and removed characters
 *
 * @example
 * const result = distillIntention("Close the deal");
 * // result.finalLetters = ["C", "L", "O", "S", "T", "H", "D"]
 *
 * @example
 * const result = distillIntention("Find inner peace");
 * // result.finalLetters = ["F", "N", "D", "R", "P", "C"]
 */
export function distillIntention(intentionText: string): DistillationResult {
  // Store original input
  const original = intentionText;

  // Step 1: Remove spaces
  const withoutSpaces = intentionText.replace(/\s+/g, '');

  // Step 2: Remove vowels and track them
  const removedVowels: string[] = [];
  let withoutVowels = '';

  for (const char of withoutSpaces) {
    if (VOWELS.has(char)) {
      removedVowels.push(char.toUpperCase());
    } else if (/[a-zA-Z]/.test(char)) {
      // Only keep alphabetic characters (skip numbers, punctuation)
      withoutVowels += char;
    }
  }

  // Step 3: Remove duplicate letters (keep first occurrence)
  const removedDuplicates: string[] = [];
  const finalLetters: string[] = [];
  const seen = new Set<string>();

  for (const char of withoutVowels) {
    const upperChar = char.toUpperCase();

    if (!seen.has(upperChar)) {
      seen.add(upperChar);
      finalLetters.push(upperChar);
    } else {
      removedDuplicates.push(upperChar);
    }
  }

  return {
    original,
    finalLetters,
    removedVowels,
    removedDuplicates,
  };
}

/**
 * Get a human-readable summary of the distillation process
 *
 * @param result - The distillation result
 * @returns A formatted string describing the process
 *
 * @example
 * const result = distillIntention("Close the deal");
 * const summary = getDistillationSummary(result);
 * // "CLOSETHEDEAL → CLSTHD → C L O S T H D"
 */
export function getDistillationSummary(result: DistillationResult): string {
  const withoutSpaces = result.original.replace(/\s+/g, '').toUpperCase();
  const withoutVowels = result.finalLetters.join('') + result.removedDuplicates.join('');
  const final = result.finalLetters.join(' ');

  return `${withoutSpaces} → ${withoutVowels} → ${final}`;
}

/**
 * Validate that an intention text can be distilled
 *
 * @param intentionText - The text to validate
 * @returns Object with isValid flag and optional error message
 */
export function validateIntention(intentionText: string): {
  isValid: boolean;
  error?: string;
} {
  // Check if empty
  if (!intentionText || intentionText.trim().length === 0) {
    return {
      isValid: false,
      error: 'Intention cannot be empty',
    };
  }

  // Check if contains at least one letter
  if (!/[a-zA-Z]/.test(intentionText)) {
    return {
      isValid: false,
      error: 'Intention must contain at least one letter',
    };
  }

  // Check if too short (less than 3 characters)
  if (intentionText.trim().length < 3) {
    return {
      isValid: false,
      error: 'Intention must be at least 3 characters long',
    };
  }

  // Check if too long (more than 100 characters)
  if (intentionText.trim().length > 100) {
    return {
      isValid: false,
      error: 'Intention must be 100 characters or less',
    };
  }

  // Test distillation to ensure we get at least 2 letters
  const result = distillIntention(intentionText);
  if (result.finalLetters.length < 2) {
    return {
      isValid: false,
      error: 'Intention must produce at least 2 unique letters after distillation',
    };
  }

  return { isValid: true };
}
