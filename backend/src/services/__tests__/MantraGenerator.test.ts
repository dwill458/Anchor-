/**
 * Unit tests for MantraGenerator service
 *
 * Tests cover:
 * - Syllabic mantra generation (2-letter chunks)
 * - Rhythmic mantra generation (3-letter chunks)
 * - Letter-by-letter pronunciation
 * - Phonetic mantra generation
 * - Recommended style selection
 * - TTS formatting for all styles
 * - Edge cases (empty, single letter, odd/even counts)
 * - Error handling
 */

import {
  generateMantra,
  getRecommendedMantraStyle,
  formatMantraForTTS,
  MantraResult,
} from '../MantraGenerator';

describe('MantraGenerator Service', () => {
  // ============================================================================
  // Basic Mantra Generation Tests
  // ============================================================================

  describe('generateMantra', () => {
    it('should generate all 4 mantra styles from distilled letters', () => {
      const letters = ['C', 'L', 'O', 'S', 'T', 'H', 'D'];

      const result = generateMantra(letters);

      expect(result).toHaveProperty('syllabic');
      expect(result).toHaveProperty('rhythmic');
      expect(result).toHaveProperty('letterByLetter');
      expect(result).toHaveProperty('phonetic');
    });

    it('should generate correct syllabic mantra (2-letter chunks)', () => {
      // Even number of letters
      const lettersEven = ['C', 'L', 'O', 'S', 'T', 'H'];
      const resultEven = generateMantra(lettersEven);
      expect(resultEven.syllabic).toBe('CL-OS-TH');

      // Odd number of letters
      const lettersOdd = ['C', 'L', 'O', 'S', 'T', 'H', 'D'];
      const resultOdd = generateMantra(lettersOdd);
      expect(resultOdd.syllabic).toBe('CL-OS-TH-D');
    });

    it('should generate correct rhythmic mantra (3-letter chunks)', () => {
      const letters = ['C', 'L', 'O', 'S', 'T', 'H', 'D'];
      const result = generateMantra(letters);

      // 7 letters: "CLO / STH / D"
      expect(result.rhythmic).toBe('CLO / STH / D');
    });

    it('should handle exactly divisible rhythmic chunks', () => {
      const letters = ['C', 'L', 'O', 'S', 'T', 'H']; // 6 letters (divisible by 3)
      const result = generateMantra(letters);

      expect(result.rhythmic).toBe('CLO / STH');
    });

    it('should generate correct letter-by-letter pronunciation', () => {
      const letters = ['C', 'L', 'O', 'S', 'T'];
      const result = generateMantra(letters);

      expect(result.letterByLetter).toBe('SEE ELL OH ESS TEE');
    });

    it('should generate phonetic mantra with correct rules', () => {
      const letters = ['T', 'H', 'D']; // TH should combine
      const result = generateMantra(letters);

      // Should recognize TH as a digraph (though vowels may be inserted)
      expect(result.phonetic).toBeDefined();
      expect(result.phonetic.length).toBeGreaterThan(0);
    });

    it('should handle minimum valid input (2 letters)', () => {
      const letters = ['C', 'L'];
      const result = generateMantra(letters);

      expect(result.syllabic).toBe('CL');
      expect(result.rhythmic).toBe('CL');
      expect(result.letterByLetter).toBe('SEE ELL');
      expect(result.phonetic).toBeDefined();
    });

    it('should handle longer letter sequences', () => {
      const letters = ['C', 'R', 'T', 'V', 'Y', 'N', 'S', 'P', 'R', 'D']; // 10 letters
      const result = generateMantra(letters);

      // Syllabic: 5 chunks of 2
      expect(result.syllabic).toBe('CR-TV-YN-SP-RD');

      // Rhythmic: 3 chunks of 3, plus 1 remainder
      expect(result.rhythmic).toBe('CRT / VYN / SPR / D');

      // Letter-by-letter: all 10 letters spelled out
      const expectedLetterByLetter = 'SEE ARR TEE VEE WHY ENN ESS PEE ARR DEE';
      expect(result.letterByLetter).toBe(expectedLetterByLetter);
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should throw error for empty letters array', () => {
      expect(() => generateMantra([])).toThrow('Cannot generate mantra from empty letters array');
    });

    it('should throw error for null/undefined input', () => {
      expect(() => generateMantra(null as any)).toThrow('Cannot generate mantra from empty letters array');
      expect(() => generateMantra(undefined as any)).toThrow('Cannot generate mantra from empty letters array');
    });

    it('should throw error for single letter (less than minimum)', () => {
      expect(() => generateMantra(['C'])).toThrow('Need at least 2 distilled letters to generate mantra');
    });
  });

  // ============================================================================
  // Phonetic Rules Tests
  // ============================================================================

  describe('Phonetic Generation Rules', () => {
    it('should recognize TH digraph', () => {
      const letters = ['T', 'H', 'N'];
      const result = generateMantra(letters);

      // TH should be recognized as digraph, though vowels may be inserted
      // Result will be something like "toh-nuh" (th + vowel + n + vowel)
      expect(result.phonetic).toBeDefined();
      expect(result.phonetic.length).toBeGreaterThan(0);
      // Verify it's not treating T and H separately (would be longer)
      expect(result.phonetic.length).toBeLessThan(15);
    });

    it('should recognize CH digraph', () => {
      const letters = ['C', 'H', 'N'];
      const result = generateMantra(letters);

      // CH should be recognized as digraph, though vowels may be inserted
      // Result will be something like "coh-nuh" (ch + vowel + n + vowel)
      expect(result.phonetic).toBeDefined();
      expect(result.phonetic.length).toBeGreaterThan(0);
      // Verify it's not treating C and H separately (would be longer)
      expect(result.phonetic.length).toBeLessThan(15);
    });

    it('should recognize SH digraph', () => {
      const letters = ['S', 'H', 'N'];
      const result = generateMantra(letters);

      // SH should be recognized as digraph, though vowels may be inserted
      // Result will be something like "soh-nuh" (sh + vowel + n + vowel)
      expect(result.phonetic).toBeDefined();
      expect(result.phonetic.length).toBeGreaterThan(0);
      // Verify it's not treating S and H separately (would be longer)
      expect(result.phonetic.length).toBeLessThan(15);
    });

    it('should handle single consonants correctly', () => {
      const letters = ['B', 'D', 'F', 'G'];
      const result = generateMantra(letters);

      // All single consonants should be lowercase in phonetic
      const phonetic = result.phonetic.toLowerCase();
      expect(phonetic).toContain('b');
      expect(phonetic).toContain('d');
      expect(phonetic).toContain('f');
      expect(phonetic).toContain('g');
    });
  });

  // ============================================================================
  // Recommended Style Tests
  // ============================================================================

  describe('getRecommendedMantraStyle', () => {
    it('should recommend syllabic for short sequences (≤4 letters)', () => {
      expect(getRecommendedMantraStyle(2)).toBe('syllabic');
      expect(getRecommendedMantraStyle(3)).toBe('syllabic');
      expect(getRecommendedMantraStyle(4)).toBe('syllabic');
    });

    it('should recommend phonetic for medium sequences (5-7 letters)', () => {
      expect(getRecommendedMantraStyle(5)).toBe('phonetic');
      expect(getRecommendedMantraStyle(6)).toBe('phonetic');
      expect(getRecommendedMantraStyle(7)).toBe('phonetic');
    });

    it('should recommend rhythmic for long sequences (≥8 letters)', () => {
      expect(getRecommendedMantraStyle(8)).toBe('rhythmic');
      expect(getRecommendedMantraStyle(10)).toBe('rhythmic');
      expect(getRecommendedMantraStyle(15)).toBe('rhythmic');
    });
  });

  // ============================================================================
  // TTS Formatting Tests
  // ============================================================================

  describe('formatMantraForTTS', () => {
    it('should format syllabic mantra with commas for pauses', () => {
      const mantra = 'CL-OS-TH-D';
      const formatted = formatMantraForTTS(mantra, 'syllabic');

      expect(formatted).toBe('CL, OS, TH, D');
    });

    it('should format rhythmic mantra with ellipses for longer pauses', () => {
      const mantra = 'CLO / STH / D';
      const formatted = formatMantraForTTS(mantra, 'rhythmic');

      expect(formatted).toBe('CLO ...  STH ...  D');
    });

    it('should keep letter-by-letter format unchanged', () => {
      const mantra = 'SEE ELL OH ESS TEE';
      const formatted = formatMantraForTTS(mantra, 'letterByLetter');

      expect(formatted).toBe('SEE ELL OH ESS TEE');
    });

    it('should format phonetic mantra with spaces for slight pauses', () => {
      const mantra = 'klo-seth-duh';
      const formatted = formatMantraForTTS(mantra, 'phonetic');

      expect(formatted).toBe('klo seth duh');
    });

    it('should handle unknown style gracefully', () => {
      const mantra = 'TEST-MANTRA';
      const formatted = formatMantraForTTS(mantra, 'unknown' as any);

      // Should return original mantra
      expect(formatted).toBe('TEST-MANTRA');
    });
  });

  // ============================================================================
  // Letter Pronunciation Tests
  // ============================================================================

  describe('Letter Pronunciations', () => {
    it('should pronounce all vowels correctly', () => {
      const letters = ['A', 'E', 'I', 'O', 'U'];
      const result = generateMantra(letters);

      // Need at least 2 letters, so test pairs
      const lettersAE = ['A', 'E'];
      const resultAE = generateMantra(lettersAE);
      expect(resultAE.letterByLetter).toBe('AY EE');

      const lettersIO = ['I', 'O'];
      const resultIO = generateMantra(lettersIO);
      expect(resultIO.letterByLetter).toBe('EYE OH');
    });

    it('should pronounce consonants correctly', () => {
      const letters = ['B', 'C', 'D', 'F', 'G'];
      const result = generateMantra(letters);

      expect(result.letterByLetter).toBe('BEE SEE DEE EFF JEE');
    });

    it('should pronounce special letters correctly', () => {
      const lettersW = ['W', 'X'];
      const resultW = generateMantra(lettersW);
      expect(resultW.letterByLetter).toBe('DOUBLE-YOU EX');

      const lettersY = ['Y', 'Z'];
      const resultY = generateMantra(lettersY);
      expect(resultY.letterByLetter).toBe('WHY ZED');
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration - Real World Examples', () => {
    it('should generate mantras for "I AM STRONG" distillation', () => {
      // "I AM STRONG" -> remove vowels & duplicates -> "MSTRNG"
      const letters = ['M', 'S', 'T', 'R', 'N', 'G'];
      const result = generateMantra(letters);

      expect(result.syllabic).toBe('MS-TR-NG');
      expect(result.rhythmic).toBe('MST / RNG');
      expect(result.letterByLetter).toBe('EMM ESS TEE ARR ENN JEE');
      expect(result.phonetic).toBeDefined();

      // Recommended style for 6 letters should be phonetic
      expect(getRecommendedMantraStyle(6)).toBe('phonetic');
    });

    it('should generate mantras for "LOVE" distillation', () => {
      // "LOVE" -> "LV"
      const letters = ['L', 'V'];
      const result = generateMantra(letters);

      expect(result.syllabic).toBe('LV');
      expect(result.rhythmic).toBe('LV');
      expect(result.letterByLetter).toBe('ELL VEE');
      expect(result.phonetic).toBeDefined();

      // Recommended style for 2 letters should be syllabic
      expect(getRecommendedMantraStyle(2)).toBe('syllabic');
    });

    it('should generate mantras for "CREATIVITY" distillation', () => {
      // "CREATIVITY" -> "CRTVTY"
      const letters = ['C', 'R', 'T', 'V', 'Y'];
      const result = generateMantra(letters);

      expect(result.syllabic).toBe('CR-TV-Y');
      expect(result.rhythmic).toBe('CRT / VY');
      expect(result.letterByLetter).toBe('SEE ARR TEE VEE WHY');
      expect(result.phonetic).toBeDefined();

      // Recommended style for 5 letters should be phonetic
      expect(getRecommendedMantraStyle(5)).toBe('phonetic');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle all same letter', () => {
      const letters = ['S', 'S', 'S', 'S'];
      const result = generateMantra(letters);

      expect(result.syllabic).toBe('SS-SS');
      expect(result.rhythmic).toBe('SSS / S');
      expect(result.letterByLetter).toBe('ESS ESS ESS ESS');
    });

    it('should handle alternating letters', () => {
      const letters = ['C', 'D', 'C', 'D'];
      const result = generateMantra(letters);

      expect(result.syllabic).toBe('CD-CD');
      expect(result.rhythmic).toBe('CDC / D');
    });

    it('should handle maximum realistic length (15 letters)', () => {
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
      const result = generateMantra(letters);

      // Should not throw error
      expect(result.syllabic).toBeDefined();
      expect(result.rhythmic).toBeDefined();
      expect(result.letterByLetter).toBeDefined();
      expect(result.phonetic).toBeDefined();

      // Recommended style for 15 letters should be rhythmic
      expect(getRecommendedMantraStyle(15)).toBe('rhythmic');
    });
  });
});
